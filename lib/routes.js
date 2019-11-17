module.exports = createRoutes

const { getPayouts, getPayoutByID } = require('./payout.js')
const { getBalance } = require('./Account.js')

function createRoutes(app, mount = 'payments', value = 0) {

  //return all payouts
  app.get(mount + '/payouts', function (request, response) {
    getPayouts().then(payouts => {
      response.send(payouts)
    })
  })

  //return payout by id
  app.get(mount + '/payouts/:id', function (request, response) {
    getPayoutByID(request.params.id).then(payment => {
      if (typeof payment == 'undefined') {
        payment = 'id not found'
      }
      response.send(payment)
    })
  })

  //return total balance
  app.get(mount + '/getbalance', function (request, response) {
    getBalance().then(balance => {
      response.send(String(balance))
    })
  })
}
