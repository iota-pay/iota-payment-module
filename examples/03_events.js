var paymentModule = require('..')
var app = require('express')()

app.get("/", function (req, res) {
    res.send('hello world from 03_events example!');
});

let server = paymentModule.createServer(app)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})


//Create an event handler which is called, when a payment was successfull
var onPaymentSuccess = function (payment) {
    console.log('payment success!', payment);
}

//Assign the event handler to an event:
paymentModule.on('paymentSuccess', onPaymentSuccess);