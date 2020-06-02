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

See `examples` folder for more examples. Some examples have associated .zip files, do not forget to import those [when creating a new app](https://wit.ai/v2/apps) and grab your access token from the Settings section.

### Messenger integration example

See `examples/messenger.js` for a thoroughly documented tutorial.

### Overview

The Wit module provides a Wit class with the following methods:
* `message` - the Wit [message](https://wit.ai/docs/http/20200513#get__message_link) API

You can also require a library function to test out your bot in the terminal. `require('node-wit').interactive`

### Wit class

The Wit constructor takes the following parameters:
* `accessToken` - the access token of your Wit instance
* `logger` - (optional) the object handling the logging.
* `apiVersion` - (optional) the API version to use instead of the recommended one

The `logger` object should implement the methods `debug`, `info`, `warn` and `error`.
They can receive an arbitrary number of parameters to log.
For convenience, we provide a `Logger` class, taking a log level parameter

Example:
```js
const {Wit, log} = require('node-wit');

const client = new Wit({
  accessToken: MY_TOKEN,
  logger: new log.Logger(log.DEBUG) // optional
});

console.log(client.message('set an alarm tomorrow at 7am'));
```

### .message()

The Wit [message](https://wit.ai/docs/http/20200513#get__message_link) API.

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

### interactive

Starts an interactive conversation with your bot.

Example:
```js
const {interactive} = require('node-wit');
interactive(client);
```

See the [docs](https://wit.ai/docs) for more information.


## Changing the API version

On May 13th, 2020, the `GET /message` API was updated to reflect the new data model: intents, traits and entities are now distinct.
We updated the SDK to the latest version: `20200513`.
You can target a specific version by passing the `apiVersion` parameter when creating the `Wit` object.

```json
{
  "text": "hello",
  "intents": [ {
    "id": "1353535345345",
    "name": "greet",
    "confidence": 0.9753
  } ],
  "entities": [],
  "traits": []
}
```

## Running tests

1. Create a new app in wit.ai web console using tests/wit-ai-basic-app-for-tests.zip
2. Copy the Server Access Token from app settings
3. Run `WIT_TOKEN=XXX npm test`, where XXX is the Server Access Token

## License

The license for node-wit can be found in LICENSE file in the root directory of this source tree.
