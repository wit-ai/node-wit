'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = require('./config');

var DEFAULT_API_VERSION = _require.DEFAULT_API_VERSION;
var DEFAULT_MAX_STEPS = _require.DEFAULT_MAX_STEPS;
var DEFAULT_WIT_URL = _require.DEFAULT_WIT_URL;

var fetch = require('isomorphic-fetch');
var log = require('./log');
var uuid = require('node-uuid');

var learnMore = 'Learn more at https://wit.ai/docs/quickstart';

function Wit(opts) {
  var _this = this;

  if (!(this instanceof Wit)) {
    return new Wit(opts);
  }

  var _config = this.config = Object.freeze(validate(opts));

  var accessToken = _config.accessToken;
  var apiVersion = _config.apiVersion;
  var actions = _config.actions;
  var headers = _config.headers;
  var logger = _config.logger;
  var witURL = _config.witURL;


  this._sessions = {};

  this.message = function (message, context) {
    var qs = 'q=' + encodeURIComponent(message);
    if (context) {
      qs += '&context=' + encodeURIComponent(JSON.stringify(context));
    }
    var method = 'GET';
    var fullURL = witURL + '/message?' + qs;
    var handler = makeWitResponseHandler(logger, 'message');
    logger.debug(method, fullURL);
    return fetch(fullURL, {
      method: method,
      headers: headers
    }).then(function (response) {
      return Promise.all([response.json(), response.status]);
    }).then(handler);
  };

  this.converse = function (sessionId, message, context, reset) {
    var qs = 'session_id=' + encodeURIComponent(sessionId);
    if (message) {
      qs += '&q=' + encodeURIComponent(message);
    }
    if (reset) {
      qs += '&reset=true';
    }
    var method = 'POST';
    var fullURL = witURL + '/converse?' + qs;
    var handler = makeWitResponseHandler(logger, 'converse');
    logger.debug(method, fullURL);
    return fetch(fullURL, {
      method: method,
      headers: headers,
      body: JSON.stringify(context)
    }).then(function (response) {
      return Promise.all([response.json(), response.status]);
    }).then(handler);
  };

  var continueRunActions = function continueRunActions(sessionId, currentRequest, message, prevContext, i) {
    return function (json) {
      if (i < 0) {
        logger.warn('Max steps reached, stopping.');
        return prevContext;
      }
      if (currentRequest !== _this._sessions[sessionId]) {
        return prevContext;
      }
      if (!json.type) {
        throw new Error('Couldn\'t find type in Wit response');
      }

      logger.debug('Context: ' + JSON.stringify(prevContext));
      logger.debug('Response type: ' + json.type);

      // backwards-compatibility with API version 20160516
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

      var request = {
        sessionId: sessionId,
        context: clone(prevContext),
        text: message,
        entities: json.entities
      };

      if (json.type === 'msg') {
        throwIfActionMissing(actions, 'send');
        var response = {
          text: json.msg,
          quickreplies: json.quickreplies
        };
        return actions.send(request, response).then(function (ctx) {
          if (ctx) {
            throw new Error('Cannot update context after \'send\' action');
          }
          if (currentRequest !== _this._sessions[sessionId]) {
            return ctx;
          }
          return _this.converse(sessionId, null, prevContext).then(continueRunActions(sessionId, currentRequest, message, prevContext, i - 1));
        });
      } else if (json.type === 'action') {
        throwIfActionMissing(actions, json.action);
        return actions[json.action](request).then(function (ctx) {
          var nextContext = ctx || {};
          if (currentRequest !== _this._sessions[sessionId]) {
            return nextContext;
          }
          return _this.converse(sessionId, null, nextContext).then(continueRunActions(sessionId, currentRequest, message, nextContext, i - 1));
        });
      } else {
        logger.debug('unknown response type ' + json.type);
        throw new Error('unknown response type ' + json.type);
      }
    };
  };

  this.runActions = function (sessionId, message, context, maxSteps) {
    var _this2 = this;

    if (!actions) throwMustHaveActions();
    var steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;

    // Figuring out whether we need to reset the last turn.
    // Each new call increments an index for the session.
    // We only care about the last call to runActions.
    // All the previous ones are discarded (preemptive exit).
    var currentRequest = (this._sessions[sessionId] || 0) + 1;
    this._sessions[sessionId] = currentRequest;
    var cleanup = function cleanup(ctx) {
      if (currentRequest === _this2._sessions[sessionId]) {
        delete _this2._sessions[sessionId];
      }
      return ctx;
    };

    return this.converse(sessionId, message, context, currentRequest > 1).then(continueRunActions(sessionId, currentRequest, message, context, steps)).then(cleanup);
  };
};

var makeWitResponseHandler = function makeWitResponseHandler(logger, endpoint) {
  return function (rsp) {
    var error = function error(err) {
      logger.error('[' + endpoint + '] Error: ' + err);
      throw err;
    };

    if (rsp instanceof Error) {
      return error(rsp);
    }

    var _rsp = _slicedToArray(rsp, 2);

    var json = _rsp[0];
    var status = _rsp[1];


    if (json instanceof Error) {
      return error(json);
    }

    var err = json.error || status !== 200 && json.body + ' (' + status + ')';

    if (err) {
      return error(err);
    }

    logger.debug('[' + endpoint + '] Response: ' + JSON.stringify(json));
    return json;
  };
};

var throwMustHaveActions = function throwMustHaveActions() {
  throw new Error('You must provide the `actions` parameter to be able to use runActions. ' + learnMore);
};

var throwIfActionMissing = function throwIfActionMissing(actions, action) {
  if (!actions[action]) {
    throw new Error('No \'' + action + '\' action found.');
  }
};

var validate = function validate(opts) {
  if (!opts.accessToken) {
    throw new Error('Could not find access token, learn more at https://wit.ai/docs');
  }
  opts.witURL = opts.witURL || DEFAULT_WIT_URL;
  opts.apiVersion = opts.apiVersion || DEFAULT_API_VERSION;
  opts.headers = opts.headers || {
    'Authorization': 'Bearer ' + opts.accessToken,
    'Accept': 'application/vnd.wit.' + opts.apiVersion + '+json',
    'Content-Type': 'application/json'
  };
  opts.logger = opts.logger || new log.Logger(log.INFO);
  if (opts.actions) {
    opts.actions = validateActions(opts.logger, opts.actions);
  }

  return opts;
};

var validateActions = function validateActions(logger, actions) {
  if ((typeof actions === 'undefined' ? 'undefined' : _typeof(actions)) !== 'object') {
    throw new Error('Actions should be an object. ' + learnMore);
  }
  if (!actions.send) {
    throw new Error('The \'send\' action is missing. ' + learnMore);
  }

  Object.keys(actions).forEach(function (key) {
    if (typeof actions[key] !== 'function') {
      logger.warn('The \'' + key + '\' action should be a function.');
    }

    if (key === 'say' && actions[key].length > 2 || key === 'merge' && actions[key].length > 2 || key === 'error' && actions[key].length > 2) {
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

var clone = function clone(obj) {
  if (obj !== null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(clone);
    } else {
      var _ret = function () {
        var newObj = {};
        Object.keys(obj).forEach(function (k) {
          newObj[k] = clone(obj[k]);
        });
        return {
          v: newObj
        };
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    }
  } else {
    return obj;
  }
};

module.exports = Wit;