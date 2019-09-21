var io = require('socket.io');

var allowedOrigins = "http://localhost:* http://127.0.0.1:*";

var socketServer = undefined;
var socket_path = '/socket';

function start(server, mount = "") {

    if (socketServer) return
    
    if (mount != "/") {
        socket_path = mount + '/socket';
    } 
    console.log(`start socketServer on '${socket_path}'`);

    socketServer = io(server, {
        origins: allowedOrigins,
        path: socket_path
    });

    socketServer.on('connection', function (socket) {
        console.log(`User '${socket.id}' connected`);
    });
}

function emit(message) {
    socketServer.emit("payments", message);
}

module.exports = {
    emit,
    start
}