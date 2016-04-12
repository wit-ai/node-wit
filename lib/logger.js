'use strict';

const LEVELS = {
  DEBUG: 0,
  LOG: 1,
  WARN: 2,
  ERROR: 3,
};

const log = (message, label) => {
  console.log(
    label ? '[' + label + '] ' + message : message
  );
}

const Logger = function(lvl) {
  this.level = lvl === undefined ? LEVELS.LOG : lvl;

  this.debug = (message) => {
    if (LEVELS.DEBUG >= this.level) {
      log(message, 'debug');
    }
  };

  this.log = (message) => {
    if (LEVELS.LOG >= this.level) {
      log(message);
    }
  };

  this.warn = (message) => {
    if (LEVELS.WARN >= this.level) {
      log(message, 'warn');
    }
  };

  this.error = (message) => {
    if (LEVELS.ERROR >= this.level) {
      log(message, 'error');
    }
  };
};

module.exports = {
  Logger: Logger,
  logLevels: LEVELS,
};
