'use strict';

let Wit = null;
let interactive = null;
try {
  // if running from repo
  Wit = require('../').Wit;
  interactive = require('../').interactive;
} catch (e) {
  Wit = require('node-wit').Wit;
  interactive = require('node-wit').interactive;
}

const accessToken = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/basic.js <wit-access-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

const client = new Wit({accessToken});
interactive(client);
