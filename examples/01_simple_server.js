var paymentModule = require('..')
var app = require('express')()

let server = paymentModule.createServer(app)

// Start server with iota-payment module on '/'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})