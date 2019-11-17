module.exports = createRoutes

const { getBalance } = require('./Account.js')

function createRoutes(app, mount = 'payments', value = 0) {


  //return total balance
  app.get(mount + '/getbalance', function (request, response) {
    getBalance().then(balance => {
      response.send(String(balance))
    })
  })
}
