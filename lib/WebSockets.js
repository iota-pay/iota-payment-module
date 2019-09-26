var io = require('socket.io')

var allowedOrigins = 'http://localhost:* http://127.0.0.1:*'

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
    console.log(`User '${socket.id}' connected`)

    socket.on('storeClientInfo', function(data) {
      var clientInfo = new Object()
      clientInfo.customId = data.customId
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
    let clientid = clients.filter(e => e.customId == message.payment)
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
