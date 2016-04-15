'use strict';

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('../').Wit;

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/template.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

const actions = {
  say: (sessionId, msg, cb) => {
    console.log(msg);
    cb();
  },
  merge: (sessionId, context, entities, message, cb) => {
    cb(context);
  },
  error: (sessionId, context) => {
    console.log('Oops, I don\'t know what to do.');
  },
};

const client = new Wit(token, actions);
client.interactive();
