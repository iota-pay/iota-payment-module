var paymentModule = require('..')

async function run() {
  // get all payments
  console.log("All payments:");
  await paymentModule.payments.getPayments().then(payments => {
    console.log(payments)
  })

  // get all open payments
  console.log("Open payments:");
  await paymentModule.payments.getOpenPayments().then(payments => {
    console.log(payments)
  })

  // create a payment
  console.log("Create payment:");
  let id;
  await paymentModule.payments.createPayment(0, { "test": "123" }).then(payment => {
    console.log(payment)
    id = payment.id
  })

  // get a specific payment
  console.log("Get payment:");
  await paymentModule.payments.getPaymentByID(id).then(payment => {
    console.log(payment)
  })
}
run()