var paymentModule = require('..')
var app = require('express')()

app.get("/", function (req, res) {
    res.send('hello world from example!');
});

var options = {
    mount: '/payments',
    // ...
}

let server = paymentModule.createServer(options, app)

//app.use('/payments', )
server.listen(3000, function () {
    // Started Express app with payment paymentModule on '/payments'
    console.log(`Server started on http://localhost:3000 `)
})