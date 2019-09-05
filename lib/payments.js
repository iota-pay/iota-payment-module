module.exports = { createPayment, getPayments, getOpenPayments, getPaymentByID }

const db = require('./Database')
const getNewAddress = require('./tangle')
const paymentHandler = require('./paymentHandler')

function createPayment(data) {
  return new Promise(function (resolve, reject) {
    getNewAddress().then(address => {
      let payment = {
        address: address,
        data: JSON.stringify(data),
        payed: false
      }

      db.get('payments')
        .push(payment)
        .last()
        .assign({ id: Date.now().toString() })
        .write()
      paymentHandler.start()
      resolve(payment)
    })
  })
}

function getPayments() {
  return new Promise(function (resolve, reject) {
    resolve(db.get('payments').value())
  })
}

function getOpenPayments() {
  return new Promise(function (resolve, reject) {
    resolve(db.get('payments').filter({ payed: false }).value())
  })
}

function getPaymentByID(id) {
  return new Promise(function (resolve, reject) {
    const payment = db
      .get('payments')
      .find({ id: id })
      .value()
    resolve(payment)
  })
}