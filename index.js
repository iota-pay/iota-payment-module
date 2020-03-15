const { createServer, onEvent } = require('./lib/create-server')
const { getBalance } = require('./lib/Account')
const { createPaymentRequest } = require('./lib/payment')
const { sendPayout } = require('./lib/payout')
const { getPayment,
  getPayments,
  updatePayment,
  getOpenPayments,
  getPaidPayments,
  getPayout,
  updatePayout,
  getPayouts,
  getOpenPayouts,
  getPaidPayouts } = require('./lib/Database')

module.exports = {
  createServer,
  onEvent,
  getBalance,
  createPaymentRequest,
  getOpenPayments,
  getPaidPayments,
  getPayment,
  getPayments,
  updatePayment,
  sendPayout,
  updatePayout,
  getPayout,
  getPayouts,
  getOpenPayouts,
  getPaidPayouts,
}