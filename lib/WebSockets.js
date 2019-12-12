var io = require('socket.io')

var allowedOrigins =
  process.env.socket_origins || 'http://localhost:* http://127.0.0.1:*'

var socketServer = undefined
var socket_path = '/iotapay/socket'
var clients = []

function start(server) {
  if (socketServer) return

  console.log(`start socketServer on '${socket_path}'`)

  socketServer = io(server, {
    origins: allowedOrigins,
    path: socket_path
  })

  socketServer.on('connection', function(socket) {
    if (process.env.debug == 'full') {
      console.log(`User '${socket.id}' connected`)
    }

    socket.on('storeClientInfo', function(data) {
      var clientInfo = new Object()
      clientInfo.paymentOrPayoutId = data.paymentOrPayoutId
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
    let clientId
    if (typeof message.payout == 'undefined') {
      clientid = clients.filter(e => e.paymentOrPayoutId == message.payment.id)
    } else {
      clientid = clients.filter(e => e.paymentOrPayoutId == message.payout.id)
    }
    if (typeof clientid[0] != 'undefined') {
      if (message.type == 'payment') {
        socketServer.to(clientid[0].clientId).emit('payments', message)
      } else {
        socketServer.to(clientid[0].clientId).emit('payouts', message)
      }
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
