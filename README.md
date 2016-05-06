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
node examples/template.js <your_token>
```

See `examples` folder for more examples.

## API

### Overview

The Wit module provides a Wit class with the following methods:
* `message` - the Wit [message](https://wit.ai/docs/http/20160330#get-intent-via-text-link) API
* `converse` - the low-level Wit [converse](https://wit.ai/docs/http/20160330#converse-link) API
* `runActions` - a higher-level method to the Wit converse API
* `interactive` - starts an interactive conversation with your bot

### Wit class

The Wit constructor takes the following parameters:
* `token` - the access token of your Wit instance
* `actions` - the object with your actions
* `logger` - (optional) the object handling the logging.

The `actions` object has action names as properties, and action implementations as values.
You need to provide at least an implementation for the special actions `say`, `merge` and `error`.

A minimal `actions` object looks like this:
```js
const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
};
```

A custom action takes the following parameters:
* `sessionId` - a unique identifier describing the user session
* `context` - the object representing the session state
* `cb(context)` - a callback function to fire at the end of your action with the updated context.

Example:
```js
const Wit = require('node-wit').Wit;
const client = new Wit(token, actions);
```

The `logger` object should implement the methods `debug`, `log`, `warn` and `error`.
All methods take a single parameter `message`.

For convenience, we provide a `Logger`, taking a log level parameter (provided as `logLevels`).
The following levels are defined: `DEBUG`, `LOG`, `WARN`, `ERROR`.

Example:
```js
const Logger = require('node-wit').Logger;
const levels = require('node-wit').logLevels;
const Wit = require('node-wit').Wit;

const logger = new Logger(levels.DEBUG);
const client = new Wit(token, actions, logger);
```

### message

The Wit [message](https://wit.ai/docs/http/20160330#get-intent-via-text-link) API.

Takes the following parameters:
* `message` - the text you want Wit.ai to extract the information from
* `context` - (optional) the object representing the session state
* `cb(error, data)` - a callback function with the JSON response

Example:
```js
client.message('what is the weather in London?', (error, data) => {
  if (error) {
    console.log('Oops! Got an error: ' + error);
  } else {
    console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
  }
});
```

### runActions

A higher-level method to the Wit converse API.

Takes the following parameters:
* `sessionId` - a unique identifier describing the user session
* `message` - the text received from the user
* `context` - the object representing the session state
* `cb(error, context)` - a callback function with the updated context
* `maxSteps` - (optional) the maximum number of actions to execute (defaults to 5)

Example:
```js
const session = 'my-user-session-42';
const context0 = {};
client.runActions(session, 'what is the weather in London?', context0, (e, context1) => {
  if (e) {
    console.log('Oops! Got an error: ' + e);
    return;
  }
  console.log('The session state is now: ' + JSON.stringify(context1));
  client.runActions(session, 'and in Brussels?', context1, (e, context2) => {
    if (e) {
      console.log('Oops! Got an error: ' + e);
      return;
    }
    console.log('The session state is now: ' + JSON.stringify(context2));
  });
});
```

### converse

The low-level Wit [converse](https://wit.ai/docs/http/20160330#converse-link) API.

Takes the following parameters:
* `sessionId` - a unique identifier describing the user session
* `message` - the text received from the user
* `context` - the object representing the session state
* `cb(error, data)` - a callback function with the JSON response

Example:
```js
client.converse('my-user-session-42', 'what is the weather in London?', {}, (error, data) => {
  if (error) {
    console.log('Oops! Got an error: ' + error);
  } else {
    console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
  }
});
```

### interactive

Starts an interactive conversation with your bot.

Example:
```js
client.interactive();
```

See the [docs](https://wit.ai/docs) for more information.


## Messenger integration example

This quickstart assumes that you have:
* a [Wit.ai bot setup](https://wit.ai/docs/quickstart);
* a [Messenger Platform setup](https://developers.facebook.com/docs/messenger-platform/quickstart).

### Install dependencies

```bash
npm install body-parser express request
```

### Download and install ngrok

From [here](https://ngrok.com/download).

### Run ngrok

```bash
./ngrok http 8445
```

This will provide `your_ngrok_domain` (the `Forwarding` line).

### Run the example

```bash
export WIT_TOKEN=your_access_token
export FB_PAGE_ID=your_page_id
export FB_PAGE_TOKEN=your_page_token
export FB_VERIFY_TOKEN=any_token
node examples/messenger.js
```

### Subscribe your page to Messenger Webhooks

Using your `FB_VERIFY_TOKEN` and `https://<your_ngrok_domain>/fb` as callback URL.

See the [Messenger Platform docs](https://developers.facebook.com/docs/messenger-platform/quickstart).

### Talk to your bot on Messenger!
