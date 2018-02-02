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
    console.log('usage: node examples/quickstart.js <wit-access-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

// Quickstart example
// See https://wit.ai/aforaleka/wit-example-app

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

const handleMessage = ({entities}) => {
  const getWeather = firstEntityValue(entities, 'getWeather');
  const location = firstEntityValue(entities, 'location');
  if (getWeather) {
    if (location) {
      console.log('sunny in ' + location); // we should call a weather API here
    } else {
      console.log('umm where?'); // missing location
    }
  } else {
    console.log('ask me about the weather in San Francisco!');
  }
};

const client = new Wit({accessToken, handleMessage});
interactive(client);
