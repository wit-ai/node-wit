'use strict';

const fetch = require('node-fetch');
const readline = require('readline');
const uuid = require('node-uuid');
const Logger = require('./logger').Logger;
const logLevels = require('./logger').logLevels;

const DEFAULT_API_VERSION = '20160516';
const DEFAULT_MAX_STEPS = 5;
const CALLBACK_TIMEOUT_MS = 10000;

let l = new Logger(logLevels.LOG);

const makeWitResponseHandler = (endpoint, l, cb) => {
  const error = err => {
    l.error('[' + endpoint + '] Error: ' + err);
    if (cb) {
      cb(err);
    }
  };

  return rsp => {
    if (rsp instanceof Error) {
      return error(rsp);
    }

    const json = rsp[0];
    const status = rsp[1];

    if (json instanceof Error) {
      return error(json);
    }

    const err = json.error || status !== 200 && json.body + ' (' + status + ')';

    if (err) {
      return error(err)
    }

    l.debug('[' + endpoint + '] Response: ' + JSON.stringify(json));
    if (cb) {
      cb(null, json);
    }
  }
};

const validateActions = (actions) => {
  const learnMore = 'Learn more at https://wit.ai/docs/quickstart';
  if (typeof actions !== 'object') {
    throw new Error('The second parameter should be an Object.');
  }
  if (!actions.say) {
    throw new Error('The \'say\' action is missing. ' + learnMore);
  }
  if (!actions.merge) {
    throw new Error('The \'merge\' action is missing. ' + learnMore);
  }
  if (!actions.error) {
    throw new Error('The \'error\' action is missing. ' + learnMore);
  }
  
  Object.keys(actions).forEach(key => {
    if (typeof actions[key] !== 'function') {
      l.warn('The \'' + key + '\' action should be a function.');
    }
    if (key === 'say' && actions.say.length !== 4) {
      l.warn('The \'say\' action should accept 4 arguments: sessionId, context, message, callback. ' + learnMore);
    } else if (key === 'merge' && actions.merge.length !== 5) {
      l.warn('The \'merge\' action should accept 5 arguments: sessionId, context, entities, message, callback. ' + learnMore);
    } else if (key === 'error' && actions.error.length !== 3) {
      l.warn('The \'error\' action should accept 3 arguments: sessionId, context, error. ' + learnMore);
    } else if (key !== 'say' && key !== 'merge' && key !== 'error' && actions[key].length !== 3) {
      l.warn('The \'' + key + '\' action should accept 3 arguments: sessionId, context, callback. ' + learnMore);
    }
  });
  return actions;
};

const makeCallbackTimeout = (ms) => {
  return setTimeout(() => {
    l.warn('I didn\'t get the callback after ' + (ms / 1000) + ' seconds. Did you forget to call me back?');
  }, ms);
};

const cbIfActionMissing = (actions, action, cb) => {
  if (!actions.hasOwnProperty(action)) {
    if (cb) {
      cb('No \'' + action + '\' action found.');
    }
    return true;
  }
  return false;
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

const Wit = function(token, actions, logger) {
  const baseURL = process.env.WIT_URL || 'https://api.wit.ai';
  const version = process.env.WIT_API_VERSION || DEFAULT_API_VERSION;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.wit.' + version + '+json',
    'Content-Type': 'application/json',
  };
  if (logger) {
    l = logger;
  }
  this.actions = validateActions(actions);

  this.message = (message, context, cb) => {
    if (typeof context === 'function') {
      cb = context;
      context = undefined;
    }
    let qs = 'q=' + encodeURIComponent(message);
    if (context) {
      qs += '&context=' + encodeURIComponent(JSON.stringify(context));
    }
    const handler = makeWitResponseHandler('message', l, cb);
    fetch(baseURL + '/message?' + qs, {
      method: 'GET',
      headers: headers,
    })
    .then(response => Promise.all([response.json(), response.status]))
    .then(handler)
    .catch(handler)
    ;
  };

  this.converse = (sessionId, message, context, cb) => {
    const handler = makeWitResponseHandler('converse', l, cb);
    let qs = 'session_id=' + sessionId;
    if (message) {
      qs += '&q=' + encodeURIComponent(message);
    }
    fetch(baseURL + '/converse?' + qs, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(context),
    })
    .then(response => Promise.all([response.json(), response.status]))
    .then(handler)
    .catch(handler)
    ;
  };

  const makeCallback = (i, sessionId, message, context, cb) => {
    let timeoutID;

    const makeActionCallback = () => {
      timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
      return (newContext) => {
        if (timeoutID) {
          clearTimeout(timeoutID);
          timeoutID = null;
        }
        const context = newContext || {};
        l.debug('Context\': ' + JSON.stringify(context));

        if (i <= 0) {
          l.warn('Max steps reached, halting.');
          if (cb) {
            cb(null, context);
          }
          return;
        }

        // Retrieving action sequence
        this.converse(
          sessionId,
          null,
          context,
          makeCallback(--i, sessionId, message, context, cb).bind(this)
        );
      };
    };

    const makeSayCallback = () => {
      timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
      return function() {
        if (arguments.length > 0) {
          throw new Error('The \'say\' callback should not have any arguments!');
        }
        if (timeoutID) {
          clearTimeout(timeoutID);
          timeoutID = null;
        }
        if (i <= 0) {
          l.warn('Max steps reached, halting.');
          if (cb) {
            cb(null, context);
          }
          return;
        }

        // Retrieving action sequence
        this.converse(
          sessionId,
          null,
          context,
          makeCallback(--i, sessionId, message, context, cb).bind(this)
        );
      };
    };

    return (error, json) => {
      l.debug('Context: ' + JSON.stringify(context));
      error = error || !json.type && 'Couldn\'t find type in Wit response';
      if (error) {
        if (cb) {
          cb(error);
        }
        return;
      }

      var clonedContext = clone(context);
      if (json.type === 'stop') {
        // End of turn
        if (cb) {
          cb(null, context);
        }
        return;
      } else if (json.type === 'msg') {
        if (cbIfActionMissing(this.actions, 'say', cb)) {
          return;
        }
        l.log('Executing say with message: ' + json.msg);
        this.actions.say(sessionId, clonedContext, json.msg, makeSayCallback().bind(this));
      } else if (json.type === 'merge') {
        if (cbIfActionMissing(this.actions, 'merge', cb)) {
          return;
        }
        l.log('Executing merge action');
        this.actions.merge(sessionId, clonedContext, json.entities, message, makeActionCallback());
      } else if (json.type === 'action') {
        const action = json.action;
        if (cbIfActionMissing(this.actions, action, cb)) {
          return;
        }
        l.log('Executing action: ' + action);
        this.actions[action](sessionId, clonedContext, makeActionCallback());
      } else { // error
        if (cbIfActionMissing(this.actions, 'error', cb)) {
          return;
        }
        l.log('Executing error action');
        this.actions.error(sessionId, clonedContext, new Error('Oops, I don\'t know what to do.'));
        return;
      }

    };
  };

  this.runActions = (sessionId, message, context, cb, maxSteps) => {
    const steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    this.converse(
      sessionId,
      message,
      context,
      makeCallback(steps, sessionId, message, context, cb).bind(this)
    );
  };

  this.interactive = (initContext, maxSteps) => {
    const sessionId = uuid.v1();
    this.context = typeof initContext === 'object' ? initContext : {};
    const steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.rl.setPrompt('> ');
    this.rl.prompt();
    this.rl.write(null, {ctrl: true, name: 'e'});
    this.rl.on('line', ((line) => {
      const msg = line.trim();
      this.runActions(
        sessionId,
        msg,
        this.context,
        (error, context) => {
          if (error) {
            l.error(error);
          } else {
            this.context = context;
          }
          this.rl.prompt();
          this.rl.write(null, {ctrl: true, name: 'e'});
        },
        steps
      );
    }).bind(this));
  };
};

module.exports = {
  Wit: Wit,
};
