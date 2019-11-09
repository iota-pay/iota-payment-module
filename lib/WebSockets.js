var io = require('socket.io')

var allowedOrigins =
  process.env.socket_origins || 'http://localhost:* http://127.0.0.1:*'

var socketServer = undefined
var socket_path = '/socket'
var clients = []

function start(server, mount = '') {
  if (socketServer) return

  if (mount != '/') {
    socket_path = mount + '/socket'
  }
  console.log(`start socketServer on '${socket_path}'`)

  socketServer = io(server, {
    origins: allowedOrigins,
    path: socket_path
  })

  socketServer.on('connection', function(socket) {
    if (process.env.debug == 'true') {
      console.log(`User '${socket.id}' connected`)
    }

    socket.on('storeClientInfo', function(data) {
      var clientInfo = new Object()
      clientInfo.paymentId = data.paymentId
      clientInfo.clientId = socket.id
      clients.push(clientInfo)
    })

    socket.on('disconnect', function(data) {
      for (var i = 0, len = clients.length; i < len; ++i) {
        var c = clients[i]

        if (c.clientId == socket.id) {
          clients.splice(i, 1)
          break
        }
      }
    })
  })
}

function emit(message) {
  try {
    let clientid = clients.filter(e => e.paymentId == message.payment.id)
    if (typeof clientid[0] != 'undefined') {
      socketServer.to(clientid[0].clientId).emit('payments', message)
    }
  } catch (error) {
    console.log('error ws emit payments: ', error.message)
    return error.message
  }
}

module.exports = {
  emit,
  start
}

/**
 * WebSockets with socket.io
 *
 * backend:
 * https://github.com/machineeconomy/iota-payment/blob/master/examples/06_websockets.js
 *
 * frontend:
 * https://github.com/machineeconomy/iota-payment/blob/master/examples/06_websocket.html
 */
