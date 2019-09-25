module.exports = { start }

const { getCurrentPayoutIndex } = require('./Account')
const iotaCore = require('@iota/core')
const { getOpenPayments } = require('./payments')
const db = require('./Database')
const eventEmitter = require('./eventEmitter')

const iotaNode = process.env.IOTANODE
const maxPaymentTime = process.env.MAX_PAYMENT_TIME

const WebSockets = require('./WebSockets.js')

const iota = iotaCore.composeAPI({
  provider: iotaNode
})
let paymentHandler = false
function start() {
  if (paymentHandler) {
    console.log('payment handler already started.')
    return
  }
  console.log('payment handler started')
  function checkPaymentStatus() {
    // check if there are open payments
    getOpenPayments().then(payments => {
      if (typeof payments !== 'undefined' && payments.length > 0) {
        // check if the transaction is confirmed
        checkPayments(payments)
      } else {
        console.log('there are no open payments')
        clearInterval(intervall)
        paymentHandler = false
      }
    })
  }
  let intervall = setInterval(checkPaymentStatus, 9000)
  paymentHandler = true
}

function checkPayments(payments) {
  let paymentsToCheckNoW = filterPaymentsToCheckNow(payments)

  //look for incoming value transactions
  checkForTransactions(paymentsToCheckNoW)

  let addresses = paymentsToCheckNoW.map(payment => payment.address)
  iota
    .getBalances(addresses, 100)
    .then(balances => {
      balances.balances.forEach((balance, index) => {
        if (balance >= paymentsToCheckNoW[index].value) {
          if (balance > paymentsToCheckNoW[index].value) {
            console.log('thank you for the donation!')
          }
          console.log(`Payment ${paymentsToCheckNoW[index].id} successfull`)
          const new_payment = db
            .get('payments')
            .find({ id: paymentsToCheckNoW[index].id })
            .assign({ payed: true })
            .write()
          eventEmitter.emit('paymentSuccess', new_payment)
          let message = {
            status: 'paymentSuccess',
            payment: new_payment
          }
          WebSockets.emit(message)
          //check if index < payoutIndex, add to extra list so it can be used for inputs
          if (paymentsToCheckNoW[index].index < getCurrentPayoutIndex()) {
            db.get('indexesForPayouts')
              .push(paymentsToCheckNoW[index].index)
              .write()
          }
        } else {
          if (balances >= 0) {
            //todo add emitter?
            console.log(
              `Not enough iotas found for payment ${paymentsToCheckNoW[index].id}: ${balance} of ${paymentsToCheckNoW[index].value}`
            )
          } else {
            let message = {
              status: 'paymentPending',
              payment: paymentsToCheckNoW[index].id
            }
            WebSockets.emit(message)
            console.log(
              `No iotas found for payment ${paymentsToCheckNoW[index].id}`
            )
          }
        }
      })
    })
    .catch(err => console.error(err))

  //update lastTime
  paymentsToCheckNoW.forEach(payment => {
    //can maybe optimized with let database = db.get('payments') one line above and then use database.find() if that works
    db.get('payments')
      .find({ id: payment.id })
      .assign({ lastTime: Date.now() })
      .write()
  })
}

function checkForTransactions(payments) {
  //look for incoming value transactions
  let paymentAdresses = payments.map(e => e.address)
  iota
    .findTransactionObjects({ addresses: paymentAdresses })
    .then(transactions => {
      transactions.forEach(tx => {
        if (tx.value > 0) {
          let payment = payments.find(
            payment => payment.address.slice(0, 81) == tx.address
          )
          console.log(
            `Incoming transaction for payment ${payment.id}: value tx: ${tx.value} value payment: ${payment.value}`
          )
          //todo: add event emitter
        }
      })
    })
    .catch(err => {
      console.log(err)
    })
}

function filterPaymentsToCheckNow(payments) {
  let paymentsToCheckNoW = []

  if (typeof maxPaymentTime == 'undefined') {
    //use 9 days as default
    maxPaymentTime = 12960
  }

  //select payouts to check
  payments.forEach(payment => {
    //remove from payments to check if older than maxPaymentTime
    if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
      db.get('payments')
        .find({ id: payment.id })
        .assign({ payed: 'timeout' })
        .write()
    }

    if (typeof payment.lastTime == 'undefined') {
      paymentsToCheckNoW.push(payment)
      return
    }
    //add if younger than 9 minutes every time
    if ((Date.now() - payment.id) / 60000 < 9) {
      paymentsToCheckNoW.push(payment)
      return
    }
    //add if younger than 90 minutes && last check > 9 minutes
    if (
      (Date.now() - payment.id) / 60000 < 90 &&
      (Date.now() - payment.lastTime) / 60000 > 9
    ) {
      paymentsToCheckNoW.push(payment)
      return
    }
    //add if younger than maxPaymentTime (9 days default) && last check > 90 minutes
    if (
      (Date.now() - payment.id) / 60000 < maxPaymentTime &&
      (Date.now() - payment.lastTime) / 60000 > 90
    ) {
      paymentsToCheckNoW.push(payment)
    }
  })

  return paymentsToCheckNoW
}
