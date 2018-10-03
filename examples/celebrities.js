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
    console.log('usage: node examples/celebrities.js <wit-access-token>');
    console.log('Please import the corresponding .zip file upon creating an app and grab your access token from the Settings page');
    process.exit(1);
  }
  return process.argv[2];
})();

// Celebrities example
// See https://wit.ai/aforaleka/wit-example-celebrities/

const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return val;
};

const handleMessage = ({entities}) => {
  const greetings = firstEntityValue(entities, 'greetings');
  const celebrity = firstEntityValue(entities, 'notable_person');
  if (celebrity) {
    // We can call wikidata API for more info here
    printWikidataDescription(celebrity);
  } else if (greetings) {
    console.log("Hi! You can say something like 'Tell me about Beyonce'");
  } else {
    console.log("Umm. I don't recognize that name. Which celebrity do you want to learn about?");
  }
};

const printWikidataDescription = (celebrity) => {
  const wikidataID = celebrity.external && celebrity.external.wikidata;
  if (!wikidataID) {
    // in case wikidata id isn't available
    console.log(`I recognize ${celebrity.name}!`);
    return;
  }
  const fullUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&ids=${wikidataID}&props=descriptions&languages=en`;
  return fetch(fullUrl, {
    method: 'GET',
    headers: new Headers({
      'Api-User-Agent': 'wit-ai-example'
    })
  })
    .then(response => Promise.resolve(response.json()))
    .then(data => {
      console.log(`ooo yes I know ${celebrity.name} -- ${data.entities[wikidataID].descriptions.en.value}`);
    })
    .catch(err => console.error(err))
};

const client = new Wit({accessToken});
interactive(client, handleMessage);
