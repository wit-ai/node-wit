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
const MULTI_RESPONSES_API_VERSION = 20230215;

class Wit extends EventEmitter {
  constructor(opts) {
    super();
    this.config = Object.freeze(validate(opts));
  }

  runComposer(sessionId, contextMap, message) {
    return this.event(sessionId, contextMap, message).then(
      this.makeComposerHandler(sessionId),
    );
  }

  runComposerAudio(sessionId, contentType, body, contextMap) {
    return this.converse(sessionId, contentType, body, contextMap).then(
      this.makeComposerHandler(sessionId),
    );
  }

  converse(sessionId, contentType, body, contextMap) {
    if (typeof sessionId !== 'string') {
      throw new Error('Please provide a session ID (string).');
    }

    if (typeof contentType !== 'string') {
      throw new Error('Please provide a content-type (string).');
    }

    if (!body instanceof Readable) {
      throw new Error('Please provide an audio stream (Readable).');
    }

    const {actions, apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      session_id: sessionId,
      v: apiVersion,
    };

    if (typeof contextMap === 'object') {
      params.context_map = JSON.stringify(contextMap);
    }

    const method = 'POST';
    const fullURL = witURL + '/converse?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    const multi_responses_enabled = apiVersion >= MULTI_RESPONSES_API_VERSION;

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
        resp =>
          new Promise((resolve, reject) => {
            logger.debug('status', resp.status);
            const bodyStream = resp.body;

            bodyStream.on('readable', () => {
              let chunk;
              let contents = '';
              while (null !== (chunk = bodyStream.read())) {
                contents += chunk.toString();
              }

              for (const rsp of parseResponse(contents)) {
                const {action, context_map, error, is_final, response, text} =
                  rsp;

                // Live transcription
                if (!(error || is_final)) {
                  logger.debug('[converse] partialTranscription:', text);
                  this.emit('partialTranscription', text);
                }

                // Multi-responses
                if (
                  multi_responses_enabled &&
                  !(error || is_final) &&
                  (action || response)
                ) {
                  if (response) {
                    logger.debug('[converse] partialResponse:', response);
                    this.emit('response', response);
                  }

                  if (action) {
                    logger.debug('[converse] got partial action:', action);
                    runAction(logger, actions, action, context_map);
                  }
                }
              }
            });
          }),
      )
      .catch(e =>
        logger.error('[converse] could not parse partial response', e),
      );

    return req
      .then(response => Promise.all([response.text(), response.status]))
      .then(([contents, status]) => {
        const finalResponse = parseResponse(contents).pop();
        const {text} = finalResponse;

        logger.debug('[converse] fullTranscription:', text);
        this.emit('fullTranscription', text);

        return [finalResponse, status];
      })
      .catch(e => e)
      .then(makeWitResponseHandler(logger, 'converse'));
  }

  event(sessionId, contextMap, message) {
    if (typeof sessionId !== 'string') {
      throw new Error('Please provide a session ID (string).');
    }

    const {actions, apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      session_id: sessionId,
      v: apiVersion,
    };

    if (typeof contextMap === 'object') {
      params.context_map = JSON.stringify(contextMap);
    }

    const body = {};
    if (typeof message === 'string') {
      body.type = 'message';
      body.message = message;
    }

    const method = 'POST';
    const fullURL = witURL + '/event?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    const req = fetch(fullURL, {
      body: JSON.stringify(body),
      method,
      headers,
      proxy,
    });

    // Multi-responses
    if (apiVersion >= MULTI_RESPONSES_API_VERSION) {
      const _partialResponses = req
        .then(
          resp =>
            new Promise((resolve, reject) => {
              logger.debug('status', resp.status);
              const bodyStream = resp.body;

              bodyStream.on('readable', () => {
                let chunk;
                let contents = '';
                while (null !== (chunk = bodyStream.read())) {
                  contents += chunk.toString();
                }

                for (const rsp of parseResponse(contents)) {
                  const {action, context_map, error, is_final, response} = rsp;

                  if (!(error || is_final) && (action || response)) {
                    if (response) {
                      logger.debug('[event] partialResponse:', response);
                      this.emit('response', response);
                    }

                    if (action) {
                      logger.debug('[event] got partial action:', action);
                      runAction(logger, actions, action, context_map);
                    }
                  }
                }
              });
            }),
        )
        .catch(e =>
          logger.error('[event] could not parse partial response', e),
        );
    }

    return req
      .then(response => Promise.all([response.text(), response.status]))
      .then(([contents, status]) => ([parseResponse(contents).pop(), status]))
      .catch(e => e)
      .then(makeWitResponseHandler(logger, 'event'));
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
                if (!error) {
                  if (!is_final) {
                    logger.debug('[dictation] partial transcription:', text);
                    this.emit('partialTranscription', text);
                  } else {
                    logger.debug(
                      '[dictation] full sentence transcription:',
                      text,
                    );
                    this.emit('fullTranscription', text);
                  }
                }
              }
            });
          }),
      )
      .catch(e =>
        logger.error('[dictation] could not parse partial response', e),
      );

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

  synthesize(
    q,
    voice,
    style = 'default',
    speed = 100,
    pitch = 100,
    gain = 100,
  ) {
    if (typeof q !== 'string') {
      throw new Error('Please provide a text input (string).');
    }
    if (typeof voice !== 'string') {
      throw new Error('Please provide a voice input (string).');
    }

    const {apiVersion, headers, logger, proxy, witURL} = this.config;

    const params = {
      v: apiVersion,
    };

    const body = {
      q: q,
      voice: voice,
      style: style,
      speed: speed,
      pitch: pitch,
      gain: gain,
    };

    const method = 'POST';
    const fullURL = witURL + '/synthesize?' + encodeURIParams(params);
    logger.debug(method, fullURL);

    return fetch(fullURL, {
      body: JSON.stringify(body),
      method,
      proxy,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    })
      .then(response => Promise.all([response, response.status]))
      .then(makeWitResponseHandler(logger, 'synthesize'));
  }

  makeComposerHandler(sessionId) {
    const {actions, logger} = this.config;

    return ({context_map, action, expects_input, response}) => {
      if (typeof context_map !== 'object') {
        throw new Error(
          'Unexpected context_map in API response: ' +
            JSON.stringify(context_map),
        );
      }

      if (response) {
        logger.debug('[composer] response:', response);
        this.emit('response', response);
      }

      if (action) {
        logger.debug('[composer] got action', action);
        return runAction(logger, actions, action, context_map).then(
          ({context_map, stop}) => {
            if (expects_input && !stop) {
              return this.runComposer(sessionId, context_map);
            }
            return {context_map};
          },
        );
      }

      return {context_map, expects_input};
    };
  }
}

const runAction = (logger, actions, name, ...rest) => {
  logger.debug('Running action', name);
  return Promise.resolve(actions[name](...rest));
};

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

  if (opts.actions && typeof opts.actions !== 'object') {
    throw new Error('Please provide actions mapping (string -> function).');
  }

  return opts;
};

module.exports = Wit;
