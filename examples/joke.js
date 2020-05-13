/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 */

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
    console.log('usage: node examples/joke.js <wit-access-token>');
    console.log('Please import the corresponding .zip file upon creating an app and grab your access token from the Settings page');
    process.exit(1);
  }
  return process.argv[2];
})();

// Joke example
// See https://wit.ai/aleka/wit-example-joke-bot/

const allJokes = {
  chuck: [
    'Chuck Norris counted to infinity - twice.',
    'Death once had a near-Chuck Norris experience.',
  ],
  tech: [
    'Did you hear about the two antennas that got married? The ceremony was long and boring, but the reception was great!',
    'Why do geeks mistake Halloween and Christmas? Because Oct 31 === Dec 25.',
  ],
  default: [
    'Why was the Math book sad? Because it had so many problems.',
  ],
};

const firstValue = (obj, key) => {
  const val = obj && obj[key] &&
    Array.isArray(obj[key]) &&
    obj[key].length > 0 &&
    obj[key][0].value
  ;
  if (!val) {
    return null;
  }
  return val;
};

const handleMessage = ({entities, traits}) => {
  const getJoke = firstValue(traits, 'getJoke');
  const greetings = firstValue(traits, 'wit$greetings');
  const category = firstValue(entities, 'category:category');
  const sentiment = firstValue(traits, 'wit$sentiment');
  if (getJoke) {
    if (category) {
      const jokes = allJokes[category];
      console.log(jokes[Math.floor(Math.random() * jokes.length)]);
    } else {
      console.log(allJokes['default'][0]);
    }
  } else if (sentiment) {
    const reply = sentiment === 'positive' ? 'Glad you liked it.' : 'Hmm.';
    console.log(reply);
  } else if (greetings) {
    console.log("hey this is joke bot :)");
  } else {
    console.log("I can tell jokes! Say 'tell me a joke about tech'!");
  }
};

const client = new Wit({accessToken});
interactive(client, handleMessage);
