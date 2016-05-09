'use strict';

var openWeatherApiKey = process.env.OPENWEATHER_KEY

// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const Wit = require('../').Wit;

const token = (() => {
  if (process.argv.length !== 3) {
    console.log('usage: node examples/weather.js <wit-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

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
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const loc = firstEntityValue(entities, 'location');
    if (loc) {
      context.loc = loc;
    }

    const date = firstEntityValue(entities, 'datetime');
    if (date) {
      context.date = Math.round((new Date(date)).getTime()/1000);
      // context.date = date;
    }

    console.log('unix date: ' + context.date);
    
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
  ['fetch-weather'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
    var Weather = require('./weather')(openWeatherApiKey).get(context.loc, context.date, (err, forecast) => { 
      if (err) throw err; 
      context.forecast = forecast; 

      cb(context); 
    });
  },
};

const client = new Wit(token, actions);
client.interactive();
