# Wit Node.js SDK

`node-wit` is the Node.js SDK for [Wit.ai](https://wit.ai).

## Install

In your Node.js project, run:

```bash
npm install --save node-wit
```

## Quickstart

Create `index.js`, containing:

```nodejs
'use strict';
const Wit = require('node-wit').Wit;

const actions = {
  say: (sessionId, msg, cb) => {
    console.log(msg);
    cb();
  },
  merge: (context, entities, cb) => {
    cb(context);
  },
  error: (sessionId, msg) => {
    console.log('Oops, I don\'t know what to do.');
  },
  'my-action': (context, cb) => {
    context['name'] = 'Julien';
    cb(context);
  },
};

const client = new Wit('YOUR_TOKEN', actions);
client.interactive();
```

Then run in your terminal:

```bash
node index.js
```

See `examples` folder for more examples.

## API

The Wit module provides a Wit class with the following methods:
* `message` - the Wit message API
* `converse` - the low-level Wit converse API
* `runActions` - a higher-level method to the Wit converse API
* `interactive` - starts an interactive conversation with your bot

See the [docs](https://wit.ai/docs) for more information.
