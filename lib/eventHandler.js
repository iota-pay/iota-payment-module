const eventEmitter = require('./eventEmitter')
const WebSockets = require('./WebSockets.js')

function emit(object) {
  eventEmitter.emit(object.status, object.payment)
  WebSockets.emit(object)
}

module.exports = { emit }
