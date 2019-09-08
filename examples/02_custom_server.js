var paymentModule = require('..')
var app = require('express')()

app.get("/", function (req, res) {
    res.send('hello world from 02_custom_server example!');
});

var options = {
    mount: '/custom',
    value: 1
    // ...
}

let server = paymentModule.createServer(app, options)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})