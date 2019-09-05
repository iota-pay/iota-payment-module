var paymentModule = require('..')

// get all payments
paymentModule.payments.getPayments().then(payments => {
    console.log(payments)
})

// get all open payments
paymentModule.payments.getOpenPayments().then(payments => {
    console.log(payments)
})
// create a payment
let id;
paymentModule.payments.createPayment({"test": "123"}).then(payment => {
    console.log(payment)
})
// get a specific payment
paymentModule.payments.getPaymentByID("1567714377826").then(payment => {
    console.log(payment)
})