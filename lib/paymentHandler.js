module.exports = {
  start,
  checkPaymentsBalance,
  getlastPaymentConfirmation,
  checkForTransactions
}

const { getCurrentPayoutIndex } = require('./Account')
const iotaCore = require('@iota/core')
const Converter = require('@iota/converter')

const { getOpenPayments } = require('./payment')
const db = require('./Database')
const eventHandler = require('./eventHandler')

let maxPaymentTime = process.env.MAX_PAYMENT_TIME

const iota = iotaCore.composeAPI({
  provider: process.env.IOTANODE
})
let paymentHandler = false
let lastPaymentConfirmation = 0
let paymentIntervall = 60000
//increase intervall if zmq is enabled
if (process.env.zmq == 'true' || process.env.fast_but_risky == 'true') {
  paymentIntervall = paymentIntervall * 3
}

function getlastPaymentConfirmation() {
  return lastPaymentConfirmation
}

function start() {
  if (paymentHandler) {
    if (process.env.debug == 'basic' || process.env.debug == 'full') {
      console.log('payment handler already started.')
    }
    return
  }
  if (process.env.debug == 'basic' || process.env.debug == 'full') {
    console.log('payment handler started')
  }
  async function checkPaymentStatus() {
    try {
      // check if there are open payments
      let payments = await getOpenPayments()
      if (typeof payments !== 'undefined' && payments.length > 0) {
        //check payments by time
        let timePayments = payments.filter(p => p.type == 'time')
        checkTimePayments(timePayments)

        let valuePayments = payments.filter(p => p.type == 'value')
        // check if the transaction is confirmed
        const paymentsToCheck = filterpaymentsToCheck(valuePayments)
        // look for incoming value transactions
        await checkForTransactions(paymentsToCheck)

        //check balances
        checkPaymentsBalance(paymentsToCheck)
      } else {
        if (process.env.debug == 'basic' || process.env.debug == 'full') {
          console.log('there are no open payments')
        }
        clearInterval(intervall)
        paymentHandler = false
      }
    } catch (err) {
      console.log('Error in checkPaymentStatus: ', err)
    }
  }
  const intervall = setInterval(checkPaymentStatus, paymentIntervall)
  //start immediately
  checkPaymentStatus()
  paymentHandler = true
}

function checkTimePayments(timePayments) {
  let currentTime = Math.floor(Date.now() / 1000)
  for (timePayment of timePayments) {
    //set confirmed if time is reached
    if (timePayment.confirmationTime < currentTime) {
      if (process.env.debug == 'basic' || process.env.debug == 'full') {
        console.log(
          `Paymenttime reached! ${
            timePayment.id
          } Address: ${timePayment.address.slice(0, 6)}...`
        )
      }
      const newPayment = db
        .get('payments')
        .find({ id: timePayment.id })
        .assign({ payed: true })
        .write()

      const eventMessage = {
        type: 'payment',
        status: 'paymentSuccess',
        payment: newPayment
      }
      eventHandler.emit(eventMessage)

      // check if index < payoutIndex, add to extra list so it can be used for inputs
      if (timePayment.index < getCurrentPayoutIndex()) {
        db.get('indexesForPayouts')
          .push(timePayment.index)
          .write()
      }
      lastPaymentConfirmation = Date.now()
    }
  }
}
function checkPaymentsBalance(paymentsToCheck) {
  return new Promise(async (resolve, reject) => {
    try {
      const addresses = paymentsToCheck.map(payment => payment.address)
      let balances = await iota.getBalances(addresses, 100)
      balances.balances.forEach((balance, index) => {
        if (balance >= paymentsToCheck[index].value) {
          if (balance > paymentsToCheck[index].value) {
            if (process.env.debug == 'full') {
              // console.log('thank you for the donation!')
              console.log(
                `Received ${balance -
                  paymentsToCheck[index].value}i more than required`
              )
            }
          }
          //check if already confirmed because it can be called from zmq at the same time
          let checkPaymentStatus = db
            .get('payments')
            .find({ id: paymentsToCheck[index].id })
            .value()
          if (checkPaymentStatus.payed == true) {
            return
          }

          if (process.env.debug == 'basic' || process.env.debug == 'full') {
            console.log(
              `Payment ${
                paymentsToCheck[index].id
              } successfull! Address: ${paymentsToCheck[index].address.slice(
                0,
                6
              )}...`
            )
          }

          const newPayment = db
            .get('payments')
            .find({ id: paymentsToCheck[index].id })
            .assign({ payed: true })
            .write()

          // ignore already accepted payments
          if (typeof paymentsToCheck[index].earlyAccepted === 'undefined') {
            const eventMessage = {
              type: 'payment',
              status: 'paymentSuccess',
              payment: newPayment
            }
            eventHandler.emit(eventMessage)
          }

          // check if index < payoutIndex, add to extra list so it can be used for inputs
          if (paymentsToCheck[index].index < getCurrentPayoutIndex()) {
            db.get('indexesForPayouts')
              .push(paymentsToCheck[index].index)
              .write()
          }
          lastPaymentConfirmation = Date.now()
        } else {
          // exit early if payment is already accepted
          if (paymentsToCheck[index].earlyAccepted === true) {
            return
          }
          if (balances >= 0) {
            // todo add emitter? or remove the if check?
            if (process.env.debug == 'full') {
              console.log(
                `Not enough iotas found for payment ${paymentsToCheck[index].id}: ${balance} of ${paymentsToCheck[index].value}`
              )
            }
          } else {
            const eventMessage = {
              type: 'payment',
              status: 'paymentPending',
              payment: paymentsToCheck[index]
            }
            eventHandler.emit(eventMessage)
            if (process.env.debug == 'full') {
              console.log(
                `No iotas found for payment ${paymentsToCheck[index].id}. Address: ${paymentsToCheck[index].address}`
              )
            }
          }
        }
      })

      // update lastTime
      paymentsToCheck.forEach(payment => {
        // can maybe optimized with let database = db.get('payments') one line above and then use database.find() if that works
        db.get('payments')
          .find({ id: payment.id })
          .assign({ lastTime: Date.now() })
          .write()
      })
      resolve()
    } catch (err) {
      console.log(err)
    }
  })
}

function checkForTransactions(payments) {
  return new Promise((resolve, reject) => {
    // look for incoming value transactions
    const paymentsToCheck = payments.filter(e => e.earlyAccepted !== true)
    const paymentAdresses = paymentsToCheck.map(e => e.address)
    iota
      .findTransactionObjects({ addresses: paymentAdresses })
      .then(transactions => {
        transactions.forEach(tx => {
          if (tx.value > 0) {
            const payment = payments.find(
              payment => payment.address.slice(0, 81) === tx.address
            )
            // check if payment was already successfull
            const uptodatepayment = db
              .get('payments')
              .find({ id: payment.id })
              .value()
            if (uptodatepayment.payed === true) {
              return
            }
            if (process.env.debug == 'full') {
              console.log(
                `Incoming transaction for payment ${payment.id}: value tx: ${tx.value} value payment: ${payment.value}`
              )
            }
            if (tx.value >= payment.value) {
              const message = tx.signatureMessageFragment
              const txInfo = {
                message: Converter.trytesToAscii(message + '9').replace(
                  /\0/g,
                  ''
                ),
                timestamp: tx.timestamp,
                hash: tx.hash
              }
              db.get('payments')
                .find({ id: payment.id })
                .assign({ txInfo: txInfo })
                .write()
              const eventMessage = {
                type: 'payment',
                status: 'paymentIncoming',
                payment: payment
              }
              eventHandler.emit(eventMessage)
            }
          }
        })
        resolve()
      })
      .catch(err => {
        console.log(err)
      })
  })
}

function filterpaymentsToCheck(payments) {
  const paymentsToCheck = []

  if (typeof maxPaymentTime === 'undefined') {
    // use 9 days as default
    maxPaymentTime = 12960
  }

  // select payouts to check
  payments.forEach(payment => {
    // remove from payments to check if older than maxPaymentTime
    if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
      db.get('payments')
        .find({ id: payment.id })
        .assign({ payed: 'timeout' })
        .write()
    }

    if (typeof payment.lastTime === 'undefined') {
      paymentsToCheck.push(payment)
      return
    }
    // add if younger than 9 minutes every time
    if ((Date.now() - payment.id) / 60000 < 9) {
      paymentsToCheck.push(payment)
      return
    }
    // add if younger than 90 minutes && last check > 9 minutes
    if (
      (Date.now() - payment.id) / 60000 < 90 &&
      (Date.now() - payment.lastTime) / 60000 > 9
    ) {
      paymentsToCheck.push(payment)
      return
    }
    // add if younger than maxPaymentTime (9 days default) && last check > 90 minutes
    if (
      (Date.now() - payment.id) / 60000 < maxPaymentTime &&
      (Date.now() - payment.lastTime) / 60000 > 90
    ) {
      paymentsToCheck.push(payment)
    }
  })

  return paymentsToCheck
}
