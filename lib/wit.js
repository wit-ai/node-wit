'use strict';

const fetch = require('node-fetch');
const readline = require('readline');
const uuid = require('node-uuid');
const log = require('./log');

const DEFAULT_API_VERSION = '20160516';
const DEFAULT_MAX_STEPS = 5;
const DEFAULT_WIT_URL = 'https://api.wit.ai';
const learnMore = 'Learn more at https://wit.ai/docs/quickstart';

function Wit(opts) {
  if (!(this instanceof Wit)) {
    return new Wit(opts);
  }

  const {
    accessToken, apiVersion, actions, headers, logger, witURL
  } = this.config = Object.freeze(validate(opts));

  this.message = (message, context) => {
    let qs = 'q=' + encodeURIComponent(message);
    if (context) {
      qs += '&context=' + encodeURIComponent(JSON.stringify(context));
    }
    const method = 'GET';
    const fullURL = witURL + '/message?' + qs
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

  this.converse = (sessionId, message, context) => {
    let qs = 'session_id=' + encodeURIComponent(sessionId);
    if (message) {
      qs += '&q=' + encodeURIComponent(message);
    }
    const method = 'POST';
    const fullURL = witURL + '/converse?' + qs;
    const handler = makeWitResponseHandler(logger, 'converse');
    logger.debug(method, fullURL);
    return fetch(fullURL, {
      method,
      headers,
      body: JSON.stringify(context),
    })
    .then(response => Promise.all([response.json(), response.status]))
    .then(handler)
    ;
  };

  const continueRunActions = (sessionId, message, prevContext, i) => {
    return (json) => {
      if (i < 0) {
        logger.warn('Max steps reached, stopping.');
        return prevContext;
      }
      if (!json.type) {
        throw new Error('Couldn\'t find type in Wit response');
      }

      logger.debug('Context: ' + JSON.stringify(prevContext));
      logger.debug('Response type: ' + json.type);

      // backwards-cpmpatibility with API version 20160516
      if (json.type === 'merge') {
        json.type = 'action';
        json.action = 'merge';
      }

      if (json.type === 'error') {
        throw new Error('Oops, I don\'t know what to do.');
      }

      if (json.type === 'stop') {
        return prevContext;
      }

      const request = {
        sessionId,
        context: clone(prevContext),
        text: message,
        entities: json.entities,
      };

      if (json.type === 'msg') {
        throwIfActionMissing(actions, 'send');
        const response = {
          text: json.msg,
          quickreplies: json.quickreplies,
        };
        return actions.send(request, response).then((ctx) => {
          if (ctx) {
            throw new Error('Cannot update context after \'send\' action');
          }
          return this.converse(sessionId, null, prevContext).then(
            continueRunActions(sessionId, message, prevContext, i - 1)
          );
        });
      } else if (json.type === 'action') {
        const action = json.action;
        throwIfActionMissing(actions, action);
        return actions[action](request).then((ctx) => {
          const nextContext = ctx || {};
          return this.converse(sessionId, null, nextContext).then(
            continueRunActions(sessionId, message, nextContext, i - 1)
          );
        });
      } else {
        logger.debug('unknown response type', json);
        throw new Error('unknown response type ' + json.type);
      }
    }
  };

  this.runActions = (sessionId, message, context, maxSteps) => {
    if (!actions) throwMustHaveActions();
    const steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    return this.converse(sessionId, message, context).then(
      continueRunActions(sessionId, message, context, steps)
    );
  };

  this.interactive = (initContext, maxSteps) => {
    if (!actions) throwMustHaveActions();
    let context = typeof initContext === 'object' ? initContext : {};
    const sessionId = uuid.v1();
    const steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.setPrompt('> ');
    const prompt = () => {
      rl.prompt();
      rl.write(null, {ctrl: true, name: 'e'});
    };
    prompt();
    rl.on('line', (line) => {
      line = line.trim();
      if (!line) {
        return prompt();
      }
      this.runActions(sessionId, line, context, steps)
      .then((ctx) => {
        context = ctx;
        prompt();
      })
      .catch(logger.error)
    });
  };
};

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

const throwMustHaveActions = () => {
  throw new Error('You must provide the `actions` parameter to be able to use runActions. ' + learnMore)
};

const throwIfActionMissing = (actions, action) => {
  if (!actions[action]) {
    throw new Error('No \'' + action + '\' action found.');
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
  if (opts.actions) {
    opts.actions = validateActions(opts.logger, opts.actions);
  }

  return opts;
};

const validateActions = (logger, actions) => {
  if (typeof actions !== 'object') {
    throw new Error('Actions should be an object. ' + learnMore);
  }
  if (!actions.send) {
    throw new Error('The \'send\' action is missing. ' + learnMore);
  }

  Object.keys(actions).forEach(key => {
    if (typeof actions[key] !== 'function') {
      logger.warn('The \'' + key + '\' action should be a function.');
    }

    if (key === 'say' && actions[key].length > 2 ||
      key === 'merge' && actions[key].length > 2 ||
      key === 'error' && actions[key].length > 2
    ) {
      logger.warn('The \'' + key + '\' action has been deprecated. ' + learnMore);
    }

    if (key === 'send') {
      if (actions[key].length !== 2) {
        logger.warn('The \'send\' action should accept 2 arguments: request and response. ' + learnMore);
      }
    } else if (actions[key].length !== 1) {
      logger.warn('The \'' + key + '\' action should accept 1 argument: request. ' + learnMore);
    }
  });

  return actions;
};

const clone = (obj) => {
  if (obj !== null && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(clone);
    } else {
      const newObj = {};
      Object.keys(obj).forEach(k => {
        newObj[k] = clone(obj[k]);
      });
      return newObj;
    }
  } else {
    return obj;
  }
};

module.exports = {
  Wit,
};
