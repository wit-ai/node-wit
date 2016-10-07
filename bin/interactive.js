'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _require = require('./config');

var DEFAULT_MAX_STEPS = _require.DEFAULT_MAX_STEPS;

var logger = require('./log.js');
var readline = require('readline');
var uuid = require('node-uuid');

module.exports = function (wit, initContext, maxSteps) {
  var context = (typeof initContext === 'undefined' ? 'undefined' : _typeof(initContext)) === 'object' ? initContext : {};
  var sessionId = uuid.v1();

  var steps = maxSteps ? maxSteps : DEFAULT_MAX_STEPS;
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.setPrompt('> ');
  var prompt = function prompt() {
    rl.prompt();
    rl.write(null, { ctrl: true, name: 'e' });
  };
  prompt();
  rl.on('line', function (line) {
    line = line.trim();
    if (!line) {
      return prompt();
    }
    wit.runActions(sessionId, line, context, steps).then(function (ctx) {
      context = ctx;
      prompt();
    }).catch(function (err) {
      return console.error(err);
    });
  });
};