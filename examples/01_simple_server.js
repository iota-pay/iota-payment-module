var paymentModule = require('..')
var app = require('express')()

app.get("/", function (req, res) {
    res.send('hello world from 01_simple_server example!');
});

let server = paymentModule.createServer(app)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})