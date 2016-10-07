'use strict';

var _funcs;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var DEBUG = 'debug';
var INFO = 'info';
var WARN = 'warn';
var ERROR = 'error';

var levels = [DEBUG, INFO, WARN, ERROR];
var funcs = (_funcs = {}, _defineProperty(_funcs, DEBUG, console.error.bind(console, '[wit][debug]')), _defineProperty(_funcs, INFO, console.log.bind(console, '[wit]')), _defineProperty(_funcs, WARN, console.warn.bind(console, '[wit]')), _defineProperty(_funcs, ERROR, console.error.bind(console, '[wit]')), _funcs);
var noop = function noop() {};

var Logger = function Logger(lvl) {
  var _this = this;

  this.level = lvl || INFO;

  levels.forEach(function (x) {
    var should = levels.indexOf(x) >= levels.indexOf(lvl);
    _this[x] = should ? funcs[x] : noop;
  });
};

module.exports = { Logger: Logger, DEBUG: DEBUG, INFO: INFO, WARN: WARN, ERROR: ERROR };