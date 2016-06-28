'use strict';

const DEBUG = 'debug';
const INFO  = 'info';
const WARN  = 'warn';
const ERROR = 'error';

const levels = [DEBUG, INFO, WARN, ERROR];
const funcs = {
  [DEBUG]: console.error.bind(console, '[wit][debug]'),
  [INFO]: console.log.bind(console, '[wit]'),
  [WARN]: console.warn.bind(console, '[wit]'),
  [ERROR]: console.error.bind(console, '[wit]'),
};
const noop = () => {}

const Logger = function(lvl) {
  this.level = lvl || INFO;

  levels.forEach((x) => {
    const should = levels.indexOf(x) >= levels.indexOf(lvl);
    this[x] = should ? funcs[x] : noop;
  });
};

module.exports = { Logger, DEBUG, INFO, WARN, ERROR };
