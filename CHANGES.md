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
