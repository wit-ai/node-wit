/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const {
  DEFAULT_API_VERSION,
  DEFAULT_WIT_URL
} = require('./config');
const fetch = require('isomorphic-fetch');
const log = require('./log');
const Url = require('url');
const HttpsProxyAgent = require('https-proxy-agent');

const learnMore = 'Learn more at https://wit.ai/docs/quickstart';

function getProxyAgent(witURL) {
  const url = Url.parse(witURL);
  const proxy = url.protocol === "http:" ?
      process.env.http_proxy || process.env.HTTP_PROXY :
      process.env.https_proxy || process.env.HTTPS_PROXY;
  const noProxy = process.env.no_proxy || process.env.NO_PROXY;

  const shouldIgnore = noProxy && noProxy.indexOf(url.hostname) > -1;
  if (proxy && !shouldIgnore) {
    return new HttpsProxyAgent(proxy);
  }
  if(!proxy) return null;
}

function Wit(opts) {
  if (!(this instanceof Wit)) {
    return new Wit(opts);
  }

  const {
    accessToken, apiVersion, headers, logger, witURL, proxy
  } = this.config = Object.freeze(validate(opts));

  this._sessions = {};

  this.message = (message, context, n, verbose, junk) => {
    let qs = 'q=' + encodeURIComponent(message);
    if (context) {
      qs += '&context=' + encodeURIComponent(JSON.stringify(context));
    }
    if (typeof n === 'number') {
      qs += '&n=' + encodeURIComponent(JSON.stringify(n));
    }
    if (verbose != null) {
      qs += '&verbose=' + encodeURIComponent(JSON.stringify(verbose));
    }
    if (junk != null) {
      qs += '&junk=true';
    }
    const method = 'GET';
    const fullURL = witURL + '/message?' + qs;
    const handler = makeWitResponseHandler(logger, 'message');
    logger.debug(method, fullURL);
    return fetch(fullURL, {
      method,
      headers,
      proxy,
    })
        .then(response => Promise.all([response.json(), response.status]))
        .then(handler)
        ;
  };
}

const makeWitResponseHandler = (logger, endpoint) => {
  return rsp => {
    const error = err => {
      logger.error('[' + endpoint + '] Error: ' + err);
      throw err;
    };

    if (rsp instanceof Error) {
      return error(rsp);
    }

    const [json, status] = rsp;

    if (json instanceof Error) {
      return error(json);
    }

    const err = json.error || status !== 200 && json.body + ' (' + status + ')';

    if (err) {
      return error(err);
    }

    logger.debug('[' + endpoint + '] Response: ' + JSON.stringify(json));
    return json;
  }
};

const validate = (opts) => {
  if (!opts.accessToken) {
    throw new Error('Could not find access token, learn more at https://wit.ai/docs');
  }
  opts.witURL = opts.witURL || DEFAULT_WIT_URL;
  opts.apiVersion = opts.apiVersion || DEFAULT_API_VERSION;
  opts.headers = opts.headers || {
    'Authorization': 'Bearer ' + opts.accessToken,
    'Accept': 'application/vnd.wit.' + opts.apiVersion + '+json',
    'Content-Type': 'application/json',
  };
  opts.logger = opts.logger || new log.Logger(log.INFO);
  opts.proxy = getProxyAgent(opts.witURL);

  return opts;
};

module.exports = Wit;
