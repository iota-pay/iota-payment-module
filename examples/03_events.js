var paymentModule = require('..')

// Start server with iota-payment module on
paymentModule.createServer()

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