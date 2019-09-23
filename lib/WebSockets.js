var io = require('socket.io')

var allowedOrigins = 'http://localhost:* http://127.0.0.1:*'

var socketServer = undefined
var socket_path = '/socket'

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
  })
}

function emit(message) {
  try {
    socketServer.emit('payments', message)
  } catch (error) {
    console.log('error ws emit payments: ', error.message)
    return error.message
  }
}

module.exports = {
  emit,
  start
}
