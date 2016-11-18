# Wit Node.js SDK [![npm](https://img.shields.io/npm/v/node-wit.svg)](https://www.npmjs.com/package/node-wit)

`node-wit` is the Node.js SDK for [Wit.ai](https://wit.ai).

## Install

In your Node.js project, run:

```bash
npm install --save node-wit
```

## Quickstart

Run in your terminal:

```bash
# Node.js <= 6.x.x, add the flag --harmony_destructuring
node --harmony_destructuring examples/basic.js <MY_TOKEN>
# Node.js >= v6.x.x
node examples/basic.js <MY_TOKEN>
```

See `examples` folder for more examples.

### Messenger integration example

See `examples/messenger.js` for a thoroughly documented tutorial.

### Overview

The Wit module provides a Wit class with the following methods:
* `message` - the Wit [message](https://wit.ai/docs/http/20160330#get-intent-via-text-link) API
* `converse` - the low-level Wit [converse](https://wit.ai/docs/http/20160330#converse-link) API
* `runActions` - a higher-level method to the Wit converse API

You can also require a library function to test out your bot in the terminal. `require('node-wit').interactive`

### Wit class

The Wit constructor takes the following parameters:
* `accessToken` - the access token of your Wit instance
* `actions` - (optional if only using `.message()`) the object with your actions
* `logger` - (optional) the object handling the logging.
* `apiVersion` - (optional) the API version to use instead of the recommended one

The `actions` object has action names as properties, and action functions as values.
Action implementations must return Promises (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
You must provide at least an implementation for the special action `send`.

* `send` takes 2 parameters: `request` and `response`
* custom actions take 1 parameter: `request`

#### Request
* `sessionId` (string) - a unique identifier describing the user session
* `context` (object) - the object representing the session state
* `text` (string) - the text message sent by your end-user
* `entities` (object) - the entities extracted by Wit's NLU

#### Response
* `text` (string) - The text your bot needs to send to the user (as described in your Wit.ai Stories)
* `quickreplies`

The `logger` object should implement the methods `debug`, `info`, `warn` and `error`.
They can receive an arbitrary number of parameters to log.
For convenience, we provide a `Logger` class, taking a log level parameter

Example:
```js
const {Wit, log} = require('node-wit');

const client = new Wit({
  accessToken: MY_TOKEN,
  actions: {
    send(request, response) {
      return new Promise(function(resolve, reject) {
        console.log(JSON.stringify(response));
        return resolve();
      });
    },
    myAction({sessionId, context, text, entities}) {
      console.log(`Session ${sessionId} received ${text}`);
      console.log(`The current context is ${JSON.stringify(context)}`);
      console.log(`Wit extracted ${JSON.stringify(entities)}`);
      return Promise.resolve(context);
    }
  },
  logger: new log.Logger(log.DEBUG) // optional
});
```

### message

The Wit [message](https://wit.ai/docs/http/20160330#get-intent-via-text-link) API.

Takes the following parameters:
* `message` - the text you want Wit.ai to extract the information from
* `context` - (optional) the object representing the session state

Example:
```js
const client = new Wit({accessToken: 'MY_TOKEN'});
client.message('what is the weather in London?', {})
.then((data) => {
  console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
})
.catch(console.error);
```

### runActions

A higher-level method to the Wit converse API.
`runActions` resets the last turn on new messages and errors.

Takes the following parameters:
* `sessionId` - a unique identifier describing the user session
* `message` - the text received from the user
* `context` - the object representing the session state
* `maxSteps` - (optional) the maximum number of actions to execute (defaults to 5)

Example:

```js
const sessionId = 'my-user-session-42';
const context0 = {};
client.runActions(sessionId, 'what is the weather in London?', context0)
.then((context1) => {
  console.log('The session state is now: ' + JSON.stringify(context1));
  return client.runActions(sessionId, 'and in Brussels?', context1);
})
.then((context2) => {
  console.log('The session state is now: ' + JSON.stringify(context2));
})
.catch((e) => {
  console.log('Oops! Got an error: ' + e);
});
```

See `./examples/messenger.js` for a full-fledged example

### converse

The low-level Wit [converse](https://wit.ai/docs/http/20160330#converse-link) API.

Takes the following parameters:
* `sessionId` - a unique identifier describing the user session
* `message` - the text received from the user
* `context` - the object representing the session state
* `reset` - (optional) whether to reset the last turn

Example:
```js
client.converse('my-user-session-42', 'what is the weather in London?', {})
.then((data) => {
  console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
})
.catch(console.error);
```

### interactive

Starts an interactive conversation with your bot.

Example:
```js
const {interactive} = require('node-wit');
interactive(client);
```

See the [docs](https://wit.ai/docs) for more information.


## Changing the API version

On 2016, May 11th, the /message API was updated to reflect the new Bot Engine model: intent are now entities.
We updated the SDK to the latest version: 20160516.
You can target a specific version by passing the `apiVersion` parameter when creating the `Wit` object.

```json
{
  "msg_id" : "e86468e5-b9e8-4645-95ce-b41a66fda88d",
  "_text" : "hello",
  "entities" : {
    "intent" : [ {
      "confidence" : 0.9753469589149633,
      "value" : "greetings"
    } ]
  }
}
```

Version prior to 20160511 will return the old format:

```json
{
  "msg_id" : "722fc79b-725c-4ca1-8029-b7f57ff88f54",
  "_text" : "hello",
  "outcomes" : [ {
    "_text" : "hello",
    "confidence" : null,
    "intent" : "default_intent",
    "entities" : {
      "intent" : [ {
        "confidence" : 0.9753469589149633,
        "value" : "greetings"
      } ]
    }
  } ],
  "WARNING" : "DEPRECATED"
}
```

## Running tests

1. Create a new app in wit.ai web console using tests/wit-ai-app-for-tests.zip
2. Copy the Server Access Token from app settings
3. Run `WIT_TOKEN=XXX npm test`, where XXX is the Server Access Token
