const eventEmitter = require('./eventEmitter')
const WebSockets = require('./WebSockets.js')

function emit(object) {
  if (typeof object.payment == 'undefined') {
    eventEmitter.emit(object.status, object.payout)
  } else {
    eventEmitter.emit(object.status, object.payment)
  }
  WebSockets.emit(object)
}

module.exports = { emit }
