const eventEmitter = require('./eventEmitter')
const WebSockets = require('./WebSockets.js')

function emit(object) {
  eventEmitter.emit(object)
  WebSockets.emit(object)
}

module.exports = { emit }
