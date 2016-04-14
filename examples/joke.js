'use strict';

// Joke example
// See https://wit.ai/patapizza/example-joke

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('../').Wit;

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/joke.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

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

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

const actions = {
  say: (sessionId, msg, cb) => {
    console.log(msg);
    cb();
  },
  merge: (context, entities, cb) => {
    delete context.joke;
    const category = firstEntityValue(entities, 'category');
    if (category) {
      context.cat = category;
    }
    const sentiment = firstEntityValue(entities, 'sentiment');
    if (sentiment) {
      context.ack = sentiment === 'positive' ? 'Glad you liked it.' : 'Hmm.';
    } else {
      delete context.ack;
    }
    cb(context);
  },
  error: (sessionId, msg) => {
    console.log('Oops, I don\'t know what to do.');
  },
  'select-joke': (context, cb) => {
    const jokes = allJokes[context.cat || 'default'];
    context.joke = jokes[Math.floor(Math.random() * jokes.length)];
    cb(context);
  },
};

const client = new Wit(token, actions);
client.interactive();
