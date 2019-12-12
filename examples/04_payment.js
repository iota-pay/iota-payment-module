var paymentModule = require('..')

async function run() {
  // get all payments
  console.log("All payments:");
  let allPayments = await paymentModule.payment.getPayments()
  console.log(allPayments)

  // get all open payments
  console.log("Open payments:");
  let openPayments = await paymentModule.payment.getOpenPayments()
  console.log(openPayments)

  // create a payment
  console.log("Create payment:");
  let payment = await paymentModule.payment.createPayment({ value: 1, data: { "test": "123" } })
  console.log(payment)

  // get a specific payment
  console.log("Get payment:");
  let specificPayment = await paymentModule.payment.getPaymentByID(payment.id)
  console.log(specificPayment)

}
run()