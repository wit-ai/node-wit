/**
 * Copyright (c) Meta Platforms, Inc. and its affiliates. All Rights Reserved.
 */

'use strict';

const fs = require('fs');
const mic = require('mic');
const readline = require('readline');

const AUDIO_PATH = '/tmp/output.raw';
const VOICE_PATH = __dirname + '/audio.wav';
const MIC_TIMEOUT_MS = 10000;
const VOICE = 'Charlie';

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
    console.log('usage: node examples/synthesize-speech.js <wit-access-token>');
    process.exit(1);
  }
  return process.argv[2];
})();

const wit = new Wit({accessToken});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.setPrompt('Enter a phrase, or type `!s` to start recording > ');

var fullTranscript;

const prompt = () => {
  rl.prompt();
  rl.write(null, {ctrl: true, name: 'e'});
  fullTranscript = '';
};
prompt();

const handleTranscription = rsp => {
  console.log(`Synthesizing text: ${fullTranscript}`);

  wit.synthesize(fullTranscript, VOICE)
    .then(saveVoice)
    .catch(console.error);
};

const saveVoice = rsp => {
  rsp.body.pipe(fs.createWriteStream(VOICE_PATH));

  console.log("Saved audio to " + VOICE_PATH);

  prompt();
}

wit.on('partialTranscription', text => {
  console.log(text + '...');
});
wit.on('fullTranscription', text => {
  console.log(text + ' (final)');

  fullTranscript += `${text} `
});

rl.on('line', line => {
  line = line.trim();
  if (!line) {
    return prompt();
  }

  // POST /dictation
  if (line === '!s') {
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
        .dictation(
          'audio/raw;encoding=signed-integer;bits=16;rate=16000;endian=little',
          stream,
        )
        .then(handleTranscription)
        .catch(console.error);
    });

    microphone.start();
    console.log('🎤 Listening...');

    return;
  }

  // POST /synthesize
  wit.synthesize(line, VOICE)
    .then(saveVoice)
    .catch(console.error);
});
