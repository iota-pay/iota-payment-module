module.exports = {
  createPayment,
  getPayments,
  updatePayment,
  getOpenPayments,
  getPaymentByID
}

const db = require('./Database')
const getNewAddress = require('./tangle')
const paymentHandler = require('./paymentHandler')

function createPayment(value = 0, data) {
  return new Promise(function(resolve, reject) {
    getNewAddress().then(address => {
      let payment = {
        address: address,
        value: value,
        data: JSON.stringify(data),
        payed: false
      }

      db.get('payments')
        .push(payment)
        .last()
        .assign({ id: Date.now().toString() })
        .write()
      resolve(payment)
      paymentHandler.start() // TODO: check if alreay running and just start if not
    })
  })
}

function getPayments() {
  return new Promise(function(resolve, reject) {
    resolve(db.get('payments').value())
  })
}

function updatePayment(payment) {
  return new Promise(function(resolve, reject) {
    let updated_payment = db('payments')
      .chain()
      .find({ _id: payment._id })
      .assign(payment)
      .value()
    resolve(updated_payment)
  })
}

function getOpenPayments() {
  return new Promise(function(resolve, reject) {
    resolve(
      db
        .get('payments')
        .filter({ payed: false })
        .value()
    )
  })
}

function getPaymentByID(id) {
  return new Promise(function(resolve, reject) {
    const payment = db
      .get('payments')
      .find({ id: id })
      .value()
    resolve(payment)
  })
}
