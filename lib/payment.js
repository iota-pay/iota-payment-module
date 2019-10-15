module.exports = {
  createPayment,
  getPayments,
  updatePayment,
  getOpenPayments,
  getPaymentByID
}

const db = require('./Database')
const { getNewAddress } = require('./Account')
const paymentHandler = require('./paymentHandler')
const eventHandler = require('./eventHandler')
const { add_address_to_zmq } = require('./zmq.js')

/**
 * Creates and returns a payment.
 * @param {number} [value] - amount of iotas - default: 0
 * @param {*} [data] data for the payment
 * @returns {object} payment
 * @example
 * // create a payment
 * paymentModule.payment.createPayment(1, { "test": "123" })
 *  .then(payment => {
 *    console.log(payment)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payment:
 * { address:
 *  'QXHAEPJSEIUAMMOUWDGYJD9MPPIGBYOPAQSPOZK9VZSGDVVV9SUJEYVXYRFL9KRRBWSDNIFGBDLH9DBADGABSCFTFD',
 * index: 11,
 * value: 1,
 * data: { test: '123' },
 * payed: false,
 * id: '1570554460662' }
 */
function createPayment(value = 0, data) {
  return new Promise(function(resolve, reject) {
    //validate value
    if (!Number.isInteger(parseInt(value)) || parseInt(value) < 0) {
      throw 'Invalid value'
    }

    getNewAddress().then(res => {
      let payment = {
        address: res.address,
        index: res.index,
        value: value,
        data: data,
        payed: false
      }

      db.get('payments')
        .push(payment)
        .last()
        .assign({ id: Date.now().toString() })
        .write()
      let eventMessage = {
        type: 'payment',
        status: 'paymentCreated',
        payment
      }
      eventHandler.emit(eventMessage)
      paymentHandler.start()
      //add address to zmq monitoring
      if (process.env.fast_but_risky == 'true') {
        add_address_to_zmq(payment.address)
      }
      resolve(payment)
    })
  })
}

/**
 * Returns all payments
 * @returns {Object[]} payments
 * @example
 * // get payments
 * paymentModule.payment.getPayments()
 *  .then(payments => {
 *    console.log(payments)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payments:
 * [ { address:
 *   'CLHNILYEPUQYJWRSGPQGA9BVVKHFHQMDM9ENNSGAHJXJIOLMBARZNHKWZZVGXSSQITOHPD9JXQGVQJJJBKMVRFWSNW',
 *  index: 10,
 *  value: '0',
 *  data: 'test',
 *  payed: true,
 *  id: '1570466750915',
 *  lastTime: 1570466754629 },
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' } ]
 */
function getPayments() {
  return new Promise(function(resolve, reject) {
    resolve(db.get('payments').value())
  })
}

function updatePayment(payment) {
  return new Promise(function(resolve, reject) {
    let updated_payment = db
      .get('payments')
      .chain()
      .find({ id: payment.id })
      .assign(payment)
      .value()
    resolve(updated_payment)
  })
}

/**
 * Returns all open (not payed and not too old) payments
 * @returns {Object[]} open payments
 * @example
 * // get open payments
 * paymentModule.payment.getPayments()
 *  .then(payments => {
 *    console.log(payments)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payments:
 * [ { address:
 *   'QXHAEPJSEIUAMMOUWDGYJD9MPPIGBYOPAQSPOZK9VZSGDVVV9SUJEYVXYRFL9KRRBWSDNIFGBDLH9DBADGABSCFTFD',
 *  index: 11,
 *  value: 1,
 *  data: { test: '123' },
 *  payed: false,
 *  id: '1570554460662' },
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' } ]
 */
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

/**
 * Returns payment by id
 * @returns {Object} payment
 * @example
 * // get payment by id
 * paymentModule.payment.getPaymentByID('1570564499942')
 *  .then(payment => {
 *    console.log(payment)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payment:
 * { address:
 *   'CLTDMWYNTKMPSISD9CBLH9MGATUZQXDALPZQBMHPJQLTKDTWDKFRJQYDKUCPYQFTFPNJBEIHHJRBKQMXXHNSUYEXJC',
 *  index: 12,
 *  value: 1,
 *  payed: false,
 *  id: '1570564499942' }
 */
function getPaymentByID(id) {
  return new Promise(function(resolve, reject) {
    const payment = db
      .get('payments')
      .find({ id: id })
      .value()
    resolve(payment)
  })
}
