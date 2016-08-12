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
    process.exit(1);
  }
  return process.argv[2];
})();

// Joke example
// See https://wit.ai/patapizza/example-joke

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
  send(request, response) {
    console.log('sending...', JSON.stringify(response));
    return Promise.resolve();
  },
  merge({entities, context, message, sessionId}) {
    return new Promise(function(resolve, reject) {
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
      return resolve(context);
    });
  },
  ['select-joke']({entities, context}) {
    return new Promise(function(resolve, reject) {
      // const category = firstEntityValue(entities, 'category') || 'default';
      // const sentiment = firstEntityValue(entities, 'sentiment');
      // if (sentiment) {
      //   context.ack = sentiment === 'positive' ? 'Glad you liked it.' : 'Hmm.';
      // } else {
      //   delete context.ack;
      // }

      const jokes = allJokes[context.cat || 'default'];
      context.joke = jokes[Math.floor(Math.random() * jokes.length)];
      return resolve(context);
    });
  },
};

const client = new Wit({accessToken, actions});
interactive(client);
