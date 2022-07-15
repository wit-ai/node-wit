/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const {DEFAULT_API_VERSION, DEFAULT_WIT_URL} = require('./config');
const log = require('./log');
const fetch = require('isomorphic-fetch');
const EventEmitter = require('events');
const HttpsProxyAgent = require('https-proxy-agent');
const {Readable} = require('stream');
const Url = require('url');

const LIVE_UNDERSTANDING_API_VERSION = 20220608;

class Wit extends EventEmitter {
  constructor(opts) {
    super();
    this.config = Object.freeze(validate(opts));
  }

  message(q, context, n) {
    if (typeof q !== 'string') {
      throw new Error('Please provide a text input (string).');
    }

    const {apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      q,
      v: apiVersion,
    };

    if (typeof context === 'object') {
      params.context = JSON.stringify(context);
    }

    if (typeof n === 'number') {
      params.n = JSON.stringify(n);
    }

    const method = 'GET';
    const fullURL = witURL + '/message?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    return fetch(fullURL, {
      method,
      headers,
      proxy,
    })
      .then(response => Promise.all([response.json(), response.status]))
      .then(makeWitResponseHandler(logger, 'message'));
  }

  speech(contentType, body, context, n) {
    if (typeof contentType !== 'string') {
      throw new Error('Please provide a content-type (string).');
    }

    if (!body instanceof Readable) {
      throw new Error('Please provide an audio stream (Readable).');
    }

    const {apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      v: apiVersion,
    };

    if (typeof context === 'object') {
      params.context = JSON.stringify(context);
    }

    if (typeof n === 'number') {
      params.n = JSON.stringify(n);
    }

    const method = 'POST';
    const fullURL = witURL + '/speech?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    const live_understanding_enabled =
      apiVersion >= LIVE_UNDERSTANDING_API_VERSION;

    const req = fetch(fullURL, {
      body,
      method,
      proxy,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Transfer-Encoding': 'chunked',
      },
    });

    const _partialResponses = req
      .then(
        response =>
          new Promise((resolve, reject) => {
            logger.debug('status', response.status);
            const bodyStream = response.body;
            bodyStream.on('readable', () => {
              let chunk;
              let contents = '';
              while (null !== (chunk = bodyStream.read())) {
                contents += chunk.toString();
              }

              for (const rsp of parseResponse(contents)) {
                const {error, intents, is_final, text} = rsp;

                // Live transcription
                if (!(error || intents)) {
                  logger.debug('[speech] partialTranscription:', text);
                  this.emit('partialTranscription', text);
                }

                // Live understanding
                if (live_understanding_enabled && intents && !is_final) {
                  logger.debug('[speech] partialUnderstanding:', rsp);
                  this.emit('partialUnderstanding', rsp);
                }
              }
            });
          }),
      )
      .catch(e => logger.error('[speech] could not parse partial response', e));

    return req
      .then(response => Promise.all([response.text(), response.status]))
      .then(([contents, status]) => {
        const finalResponse = parseResponse(contents).pop();
        const {text} = finalResponse;

        logger.debug('[speech] fullTranscription:', text);
        this.emit('fullTranscription', text);

        return [finalResponse, status];
      })
      .catch(e => e)
      .then(makeWitResponseHandler(logger, 'speech'));
  }

  dictation(contentType, body) {
    if (typeof contentType !== 'string') {
      throw new Error('Please provide a content-type (string).');
    }

    if (!body instanceof Readable) {
      throw new Error('Please provide an audio stream (Readable).');
    }

    const {apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      v: apiVersion,
    };

    const method = 'POST';
    const fullURL = witURL + '/dictation?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    const req = fetch(fullURL, {
      body,
      method,
      proxy,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Transfer-Encoding': 'chunked',
      },
    });

    const _partialResponses = req
      .then(
        response =>
          new Promise((resolve, reject) => {
            logger.debug('status', response.status);
            const bodyStream = response.body;
            bodyStream.on('readable', () => {
              let chunk;
              let contents = '';
              while (null !== (chunk = bodyStream.read())) {
                contents += chunk.toString();
              }

              for (const rsp of parseResponse(contents)) {
                const {error, is_final, text} = rsp;

                // Live transcription
                if (!(error)) {
                  if (!is_final) {
                    logger.debug('[dictation] partial transcription:', text);
                    this.emit('partialTranscription', text);
                  } else {
                    logger.debug('[dictation] full sentence transcription:', text);
                    this.emit('fullTranscription', text);
                  }
                }
              }
            });
          }),
      )
      .catch(e => logger.error('[dictation] could not parse partial response', e));

    return req
      .then(response => Promise.all([response.text(), response.status]))
      .then(([contents, status]) => {
        const finalResponse = parseResponse(contents).pop();
        const {text} = finalResponse;

        logger.debug('[dictation] last full sentence transcription:', text);
        this.emit('fullTranscription', text);

        return [finalResponse, status];
      })
      .catch(e => e)
      .then(makeWitResponseHandler(logger, 'dictation'));
  }
}

const makeWitResponseHandler = (logger, endpoint) => rsp => {
  const error = e => {
    logger.error('[' + endpoint + '] Error: ' + e);
    throw e;
  };

  if (rsp instanceof Error) {
    return error(rsp);
  }

  const [json, status] = rsp;

  if (json instanceof Error) {
    return error(json);
  }

  const err = json.error || (status !== 200 && json.body + ' (' + status + ')');

  if (err) {
    return error(err);
  }

  logger.debug('[' + endpoint + '] Response: ' + JSON.stringify(json));
  return json;
};

const getProxyAgent = witURL => {
  const url = Url.parse(witURL);
  const proxy =
    url.protocol === 'http:'
      ? process.env.http_proxy || process.env.HTTP_PROXY
      : process.env.https_proxy || process.env.HTTPS_PROXY;
  const noProxy = process.env.no_proxy || process.env.NO_PROXY;

  const shouldIgnore = noProxy && noProxy.indexOf(url.hostname) > -1;
  if (proxy && !shouldIgnore) {
    return new HttpsProxyAgent(proxy);
  }

  if (!proxy) {
    return null;
  }
};

const encodeURIParams = params =>
  Object.entries(params)
    .map(([key, value]) => key + '=' + encodeURIComponent(value))
    .join('&');

const parseResponse = response => {
  const chunks = response
    .split('\r\n')
    .map(x => x.trim())
    .filter(x => x.length > 0);

  let prev = '';
  let jsons = [];
  for (const chunk of chunks) {
    try {
      prev += chunk;
      jsons.push(JSON.parse(prev));
      prev = '';
    } catch (_e) {}
  }

  return jsons;
};

const validate = opts => {
  if (!opts.accessToken) {
    throw new Error(
      'Could not find access token, learn more at https://wit.ai/docs',
    );
  }

  opts.witURL = opts.witURL || DEFAULT_WIT_URL;
  opts.apiVersion = opts.apiVersion || DEFAULT_API_VERSION;
  opts.headers = opts.headers || {
    Authorization: 'Bearer ' + opts.accessToken,
    'Content-Type': 'application/json',
  };
  opts.logger = opts.logger || new log.Logger(log.INFO);
  opts.proxy = getProxyAgent(opts.witURL);

  return opts;
};

module.exports = Wit;
