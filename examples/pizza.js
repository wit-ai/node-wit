/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
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
    console.log('usage: node examples/pizza.js <wit-access-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

const actions = {
  process_order(contextMap) {
    const {order} = contextMap;
    if (typeof order !== 'object') {
      console.log('could not find order');
      return {context_map: contextMap};
    }

    const pizze = Array.from(order.pizze || []);
    const pizze_number = pizze.length;
    if (pizze_number < 1) {
      console.log('could not find any pizze in the order');
      return {context_map: contextMap};
    }

    const processed = pizze.length;
    const order_number = pizze[0].type.substring(0, 3).toUpperCase() + '-42X6';

    return {context_map: {...contextMap, pizze_number, order_number}};
  },
  make_summary(contextMap) {
    const {order} = contextMap;
    if (typeof order !== 'object') {
      console.log('could not find order');
      return {context_map: contextMap};
    }

    const pizze = Array.from(order.pizze || []);
    if (pizze.length < 1) {
      console.log('could not find any pizze in the order');
      return {context_map: contextMap};
    }

    const order_summary = pizze
      .map(({size, type}) => 'a ' + size + ' ' + type)
      .join(', ');

    return {context_map: {...contextMap, order_summary}, stop: true};
  },
};

const client = new Wit({accessToken, actions});
interactive(client);
