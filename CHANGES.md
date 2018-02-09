## v5.0.0
The most important change is the removal of `.converse()` and `.runActions()`. Follow the migration tutorial [here](https://github.com/wit-ai/wit-stories-migration-tutorial), or [read more here](https://wit.ai/blog/2017/07/27/sunsetting-stories).

### Breaking changes

- `converse` and `runActions` are removed
- updated and added new examples that leverage the /message API
- updated wit-ai-basic-app-for-tests.zip for testing

## v4.3.0
- `converse` and `runActions` are deprecated
- `interactive` now calls `message`

## v4.2.0

- support actions that do not return promises
- support the case where an action does not return a Promise
- update uuid to version 3.0.0
- Support older versions of node
- 'Use strict' on interactive.js
- Check for bot's message in messenger example

## v4.1.0

- Support for different JS environments
- `converse` now takes `reset` as an optional parameter

### Breaking changes

- `interactive` is no longer a function on the `Wit` client. Instead, you require it from the library: `require('node-wit').interactive`
- `runActions` now resets the last turn on new messages and errors.

## v4.0.0

After a lot of internal dogfooding and bot building, we decided to change the API in a backwards-incompatible way. The changes are described below and aim to simplify user code and accommodate upcoming features.

We moved to a Promise-based API, instead of callbacks. This makes the code simpler and the error-handling more straight-forward. It's also inline with where JS is going with standards like `fetch()` and `async/await` that are based on Promises.

See `./examples` to see how to use the new API.


### Breaking changes

- `say` renamed to `send` to reflect that it deals with more than just text
- Removed built-in actions `merge` and `error`
- Actions signature simplified with `request` and `response` arguments
- Actions need to return promises and do not receive the `cb` parameter anymore
- INFO level replaces LOG level
- configuration is now done when instantiating the `Wit` object, instead of using env vars

## v3.3.2

- allows for overriding API version, by setting `WIT_API_VERSION`

## v3.3.1
- adding API versioning (defaults to `20160516`)
- warns instead of throwing when validating actions
- fixing null values when cloning context

## v3.3.0

- callbacks are not called asynchronously by default, choice is left to the developer (use process.nextTick in your callback to emulate the previous behavior)
- using `node-fetch` instead of `requests`
- the `message()` API takes now an optional context as second parameter

## v3.2.2

- fixing context not updated in interactive mode
- fixing array values in context
- create readline interface only in interactive mode

## v3.2.0

Unifying action parameters.

### breaking

- the `say` action now takes 4 parameters: `sessionId`, `context`, `message`, `cb`
- the `error` action now takes 3 parameters: `sessionId`, `context`, `error`

## v3.1.0

Updating action parameters.

### breaking

- the `merge` action now takes 5 parameters: `sessionId`, `context`, `entities`, `message`, `cb`
- the `error` action now takes the context as second parameter
- custom actions now take 3 parameters: `sessionId`, `context`, `cb`

## v3.0.0

Bot Engine integration

### breaking

- the library now provides a Wit object
- `captureTextIntent` has been moved to `Wit.message` with no token
- audio not supported
