var paymentModule = require('..')
var app = require('express')()

var options = {
    mount: '/',
    value: 1
    // ...
}
app.get("/", function (req, res) {
    res.send('hello world from 03_events example!');
});

let server = paymentModule.createServer(app, options)

// Start server with iota-payment module on '/'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})

//Create an event handler which is called, when a payment was created
var onPaymentCreated = function (payment) {
    console.log('payment created!', payment);
}

//Create an event handler which is called, when a payment was created
var onPaymentIncoming = function (payment) {
    console.log('payment incoming!', payment);
}


//Create an event handler which is called, when a payment was successfull
var onPaymentSuccess = function (payment) {
    console.log('payment success!', payment);
}

//Assign the event handler to the events:
paymentModule.on('paymentCreated', onPaymentCreated);
paymentModule.on('paymentIncoming', onPaymentIncoming);
paymentModule.on('payoutSent', onPaymentSuccess);