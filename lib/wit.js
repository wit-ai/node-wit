'use strict';

const request = require('request');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const uuid = require('node-uuid');
const Logger = require('./logger').Logger;
const logLevels = require('./logger').logLevels;

const DEFAULT_MAX_STEPS = 5;
const CALLBACK_TIMEOUT_MS = 10000;

let l = new Logger(logLevels.LOG);

const makeWitResponseHandler = (endpoint, l, cb) => (
  (error, response, data) => {
    const err = error ||
      data.error ||
      response.statusCode !== 200 && data.body + ' (' + response.statusCode + ')'
    ;
    if (err) {
      l.error('[' + endpoint + '] Error: ' + err);
      if (cb) {
        cb(err);
      }
      return;
    }
    l.debug('[' + endpoint + '] Response: ' + JSON.stringify(data));
    if (cb) {
      cb(null, data);
    }
  }
);

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
      throw new Error('The \'' + key + '\' action should be a function.');
    }
    if (key === 'say' && actions.say.length !== 3) {
      throw new Error('The \'say\' action should accept 3 arguments: sessionId, message, callback. ' + learnMore);
    } else if (key === 'merge' && actions.merge.length !== 3) {
      throw new Error('The \'merge\' action should accept 3 arguments: context, entities, callback. ' + learnMore);
    } else if (key === 'error' && actions.error.length !== 2) {
      throw new Error('The \'error\' action should accept 2 arguments: sessionId, callback. ' + learnMore);
    } else if (key !== 'say' && key !== 'merge' && actions[key].length !== 2) {
      throw new Error('The \'' + key + '\' action should accept 2 arguments: context, callback. ' + learnMore);
    }
  });
  return actions;
};

const makeCallbackTimeout = (ms) => {
  return setTimeout(() => {
    l.warn('I didn\'t get the callback after ' + (ms / 1000) + ' seconds. Did you forget to call me back?');
  }, ms);
};

const Wit = function(token, actions, logger) {
  this.req = request.defaults({
    baseUrl: process.env.WIT_URL || 'https://api.wit.ai',
    strictSSL: false,
    json: true,
    headers: {
      'Authorization': 'Bearer ' + token,
    },
  });
  if (logger) {
    l = logger;
  }
  this.actions = validateActions(actions);

  this.message = (message, cb) => {
    const options = {
      uri: '/message',
      method: 'GET',
      qs: { q: message },
    };
    this.req(options, makeWitResponseHandler('message', l, cb));
  };

  this.converse = (sessionId, message, context, cb) => {
    const options = {
      uri: '/converse',
      method: 'POST',
      qs: { 'session_id': sessionId },
      json: context,
    };
    if (message) {
      options.qs.q = message;
    }
    this.req(options, makeWitResponseHandler('converse', l, cb));
  };

  const makeCallback = (i, sessionId, context, cb) => {
    return (error, json) => {
      let timeoutID;
      l.debug('Context: ' + JSON.stringify(context));
      error = error || !json.type && 'Couldn\'t find type in Wit response';
      if (error) {
        if (cb) {
          cb(error, context);
        }
        return;
      }

      // TODO(jodent) refactor
      if (json.type === 'stop') {
        // End of turn
        if (cb) {
          cb(null, context);
        }
        return;
      } else if (json.type === 'msg') {
        if (!this.actions.say) {
          if (cb) {
            cb('No \'say\' action found.');
          }
          return;
        }
        timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
        l.log('Executing say with message: ' + json.msg);
        this.actions.say(sessionId, json.msg, () => {
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
            makeCallback(--i, sessionId, context, cb).bind(this)
          );
        });
      } else if (json.type === 'merge') {
        if (!this.actions.merge) {
          if (cb) {
            cb('No \'merge\' action found.');
          }
          return;
        }
        l.log('Executing merge action');
        timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
        this.actions.merge(context, json.entities, (newContext) => {
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
            makeCallback(--i, sessionId, context, cb).bind(this)
          );
        });
      } else if (json.type === 'action') {
        const action = json.action;
        if (!this.actions.hasOwnProperty(action)) {
          if (cb) {
            cb('No \'' + action + '\' action found.', context);
          }
          return;
        }

        // Context might be updated in action call
        l.log('Executing action: ' + action);
        timeoutID = makeCallbackTimeout(CALLBACK_TIMEOUT_MS);
        this.actions[action](context, (newContext) => {
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
            makeCallback(--i, sessionId, context, cb).bind(this)
          );
        });
      } else { // error
        if (!this.actions.error) {
          if (cb) {
            cb('No \'error\' action found.');
          }
          return;
        }
        l.log('Executing error action');
        this.actions.error(sessionId, 'No \'error\' action found.');
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
      makeCallback(steps, sessionId, context, cb).bind(this)
    );
  };

  this.interactive = (initContext, maxSteps) => {
    const sessionId = uuid.v1();
    const context = typeof initContext === 'object' ? initContext : {};
    const steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
    rl.setPrompt('> ');
    rl.prompt();
    rl.on('line', ((line) => {
      const msg = line.trim();
      this.runActions(
        sessionId,
        msg,
        context,
        (error, context) => {
          if (error) {
            l.error(error);
          }
          rl.prompt();
        },
        steps
      );
    }).bind(this));
  };
};

module.exports = {
  Wit: Wit,
};
