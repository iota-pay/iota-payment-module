module.exports = createRoutes

const { createPayment, getPayments, getPaymentByID } = require('./payment.js')
const { getPayouts, getPayoutByID } = require('./payout.js')
const { getBalance } = require('./Account.js')

function createRoutes(app, mount = 'payments', value = 0) {
  app.post(mount, function(request, response) {
    var body = request.body
    createPayment(value, body).then(payment => {
      // send reponse with address.
      response.send({
        message: `Payment created. Please pay ${value} iota to provided address.`,
        payment: payment
      })
    })
  })

  //return all payments
  app.get(mount + '/payments', function(request, response) {
    getPayments().then(payments => {
      response.send(payments)
    })
  })

  //return payment by id
  app.get(mount + '/payments/:id', function(request, response) {
    getPaymentByID(request.params.id).then(payment => {
      if (typeof payment == 'undefined') {
        payment = 'id not found'
      }
      response.send(payment)
    })
  })

  //return all payouts
  app.get(mount + '/payouts', function(request, response) {
    getPayouts().then(payouts => {
      response.send(payouts)
    })
  })

  //return payout by id
  app.get(mount + '/payouts/:id', function(request, response) {
    getPayoutByID(request.params.id).then(payment => {
      if (typeof payment == 'undefined') {
        payment = 'id not found'
      }
      response.send(payment)
    })
  })

  //return total balance
  app.get(mount + '/getbalance', function(request, response) {
    getBalance().then(balance => {
      response.send(String(balance))
    })
  })
}
