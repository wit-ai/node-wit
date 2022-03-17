#!/bin/bash
# Copyright (c) Meta Platforms, Inc. and its affiliates. All rights reserved.

set -ex

mkdir -p dist
cp package.json dist
cp index.js dist
cp -R lib dist/lib
mocha ./tests/dist.js
(
  cd dist
  npm publish
)
rm -rf dist
