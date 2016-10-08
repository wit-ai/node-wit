module.exports = {
  log: require('./lib/log'),
  Wit: require('./lib/wit'),
  interactive: require('./lib/interactive'),
  legacy: {
    log: require('./bin/log'),
    Wit: require('./bin/wit'),
    interactive: require('./bin/interactive')
  }
};
