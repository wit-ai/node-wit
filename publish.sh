#!/bin/bash

set -ex

mkdir -p dist
cp package.json dist
npx babel lib --out-dir dist/lib
npx babel index.js --out-file dist/index.js
mocha ./tests/dist.js
(
  cd dist
  npm publish
)
rm -rf dist
