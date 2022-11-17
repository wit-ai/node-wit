/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const fs = require('fs');
const mic = require('mic');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const sessionId = uuidv4();

const AUDIO_PATH = '/tmp/output.raw';
const MIC_TIMEOUT_MS = 3000;
const MSG_PREFIX_COMMAND = '!message';

module.exports = (wit, handleResponse, initContextMap) => {
  let contextMap = typeof initContextMap === 'object' ? initContextMap : {};

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.setPrompt('> ');

  const prompt = () => {
    rl.prompt();
    rl.write(null, {ctrl: true, name: 'e'});
  };
  prompt();

  const makeResponseHandler = rsp => {
    const {context_map} = rsp;
    if (typeof context_map === 'object') {
      contextMap = context_map;
    }

    if (handleResponse) {
      handleResponse(rsp);
    } else {
      console.log(JSON.stringify(rsp));
    }

    return rsp;
  };

  const openMic = onComplete => {
    const microphone = mic({
      bitwidth: '16',
      channels: '1',
      encoding: 'signed-integer',
      endian: 'little',
      fileType: 'raw',
      rate: '16000',
    });

    const inputAudioStream = microphone.getAudioStream();
    const outputFileStream = fs.WriteStream(AUDIO_PATH);
    inputAudioStream.pipe(outputFileStream);

    inputAudioStream.on('startComplete', () => {
      setTimeout(() => {
        microphone.stop();
      }, MIC_TIMEOUT_MS);
    });
    inputAudioStream.on('stopComplete', () => onComplete());

    microphone.start();
    console.log('🎤 Listening...');
  };

  wit.on('partialTranscription', text => {
    console.log(text + '...');
  });
  wit.on('fullTranscription', text => {
    console.log(text + ' (final)');
  });
  wit.on('partialUnderstanding', rsp => {
    console.log('Live understanding: ' + JSON.stringify(rsp));
  });
  wit.on('response', ({text}) => {
    console.log('< ' + text);
  });

  rl.on('line', line => {
    line = line.trim();
    if (!line) {
      return prompt();
    }

    // POST /converse
    if (line === '!converse') {
      const onComplete = () => {
        const stream = fs.ReadStream(AUDIO_PATH);
        wit
          .runComposerAudio(
            sessionId,
            'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
            stream,
            contextMap,
          )
          .then(makeResponseHandler)
          .then(({expects_input}) => {
            if (expects_input) {
              openMic(onComplete);
            } else {
              prompt();
            }
          })
          .catch(console.error);
      };

      return openMic(onComplete);
    }

    // POST /speech
    if (line === '!speech') {
      const onComplete = () => {
        const stream = fs.ReadStream(AUDIO_PATH);
        wit
          .speech(
            'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
            stream,
          )
          .then(makeResponseHandler)
          .then(prompt)
          .catch(console.error);
      };
      return openMic(onComplete);
    }

    if (line.startsWith(MSG_PREFIX_COMMAND)) {
      // GET /message
      return wit
        .message(line.slice(MSG_PREFIX_COMMAND.length))
        .then(makeResponseHandler)
        .then(prompt)
        .catch(console.error);
    }

    // POST /event
    wit
      .runComposer(sessionId, contextMap, line)
      .then(makeResponseHandler)
      .then(prompt)
      .catch(console.error);
  });
};
