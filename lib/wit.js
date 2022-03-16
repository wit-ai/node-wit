/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const {DEFAULT_API_VERSION, DEFAULT_WIT_URL} = require('./config');
const log = require('./log');
const fetch = require('isomorphic-fetch');
const Url = require('url');
const HttpsProxyAgent = require('https-proxy-agent');
const {Readable} = require('stream');

function Wit(opts) {
  if (!(this instanceof Wit)) {
    return new Wit(opts);
  }

  const {accessToken, apiVersion, headers, logger, witURL, proxy} =
    (this.config = Object.freeze(validate(opts)));

  this.message = (q, context, n) => {
    if (typeof q !== 'string') {
      throw new Error('Please provide a text input (string).');
    }

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
  };

  this.speech = (contentType, body, context, n) => {
    if (typeof contentType !== 'string') {
      throw new Error('Please provide a content-type (string).');
    }

    if (!body instanceof Readable) {
      throw new Error('Please provide an audio stream (Readable).');
    }

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

    return fetch(fullURL, {
      body,
      method,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Transfer-Encoding': 'chunked',
      },
    })
      .then(response => Promise.all([response.text(), response.status]))
      .then(([contents, status]) => {
        const chunks = contents
          .split('\r\n')
          .map(x => x.trim())
          .filter(x => x.length > 0);
        return [JSON.parse(chunks[chunks.length - 1]), status];
      })
      .catch(e => e)
      .then(makeWitResponseHandler(logger, 'speech'));
  };
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
