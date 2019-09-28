module.exports = require('./lib/create-server')
module.exports.payout = require('./lib/payouts')
module.exports.payments = require('./lib/payments')
let { getBalance } = require('./lib/Account')
module.exports.getBalance = getBalance
