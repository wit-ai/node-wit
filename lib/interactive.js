'use strict';

const {DEFAULT_MAX_STEPS} = require('./config');
const logger = require('./log.js');
const readline = require('readline');

module.exports = (wit, handleMessage, context) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.setPrompt('> ');
  const prompt = () => {
    rl.prompt();
    rl.write(null, {ctrl: true, name: 'e'});
  };
  prompt();
  rl.on('line', (line) => {
    line = line.trim();
    if (!line) {
      return prompt();
    }
    wit.message(line, context)
    .then((rsp) => {
      if (handleMessage) {
        handleMessage(rsp);
      } else {
        console.log(JSON.stringify(rsp));
      }
      prompt();
    })
    .catch(err => console.error(err))
  });
};
