/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const fs = require('fs');
const mic = require('mic');
const readline = require('readline');

const AUDIO_PATH = '/tmp/output.raw';
const MIC_TIMEOUT_MS = 3000;

module.exports = (wit, handleResponse, context) => {
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
    if (handleResponse) {
      handleResponse(rsp);
    } else {
      console.log(JSON.stringify(rsp));
    }
    prompt();
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

  rl.on('line', line => {
    line = line.trim();
    if (!line) {
      return prompt();
    }

    // POST /speech
    if (line === '!speech') {
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
      inputAudioStream.on('stopComplete', () => {
        const stream = fs.ReadStream(AUDIO_PATH);
        wit
          .speech(
            'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
            stream,
            context,
          )
          .then(makeResponseHandler)
          .catch(console.error);
      });

      microphone.start();
      console.log('🎤 Listening...');

      return;
    }

    // GET /message
    wit.message(line, context).then(makeResponseHandler).catch(console.error);
  });
};
