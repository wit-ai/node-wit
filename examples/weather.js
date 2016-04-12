'use strict';

const Wit = require('node-wit').Wit;

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/weather.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

const actions = {
  say: (sessionId, msg, cb) => {
    console.log(msg);
    cb();
  },
  merge: (context, entities, cb) => {
    cb(context);
  },
  error: (sessionId, msg) => {
    console.log('Oops, I don\'t know what to do.');
  },
  'fetch-forecast': (context, cb) => {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.location)
    context.forecast = 'cloudy';
    cb(context);
  },
};

const client = new Wit(token, actions);
client.interactive();
