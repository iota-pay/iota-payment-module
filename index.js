module.exports = require('./lib/create-server')
module.exports.payout = require('./lib/payouts')
module.exports.payments = require('./lib/payments')
let { getTotalBalance } = require('./lib/Account')
module.exports.getTotalBalance
