var paymentModule = require('..')
var app = require('express')()

app.get("/", function (req, res) {
    res.sendFile(__dirname + '/06_websocket.html');
});

var options = {
    mount: '/payments',
    value: 0,
    websockets: true
    // ...
}

let server = paymentModule.createServer(app, options)

// Start server with iota-payment module on '/custom'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})