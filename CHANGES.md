## v3.1.0

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
