'use strict';

const {
  DEFAULT_API_VERSION,
  DEFAULT_MAX_STEPS,
  DEFAULT_WIT_URL
} = require('./config');
const fetch = require('isomorphic-fetch');
const log = require('./log');

const learnMore = 'Learn more at https://wit.ai/docs/quickstart';

function Wit(opts) {
  if (!(this instanceof Wit)) {
    return new Wit(opts);
  }

  const {
    accessToken, apiVersion, headers, logger, witURL
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

  return opts;
};

module.exports = Wit;
