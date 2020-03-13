module.exports = {
  start,
  checkPaymentsBalance,
  getlastPaymentConfirmation,
  checkForTransactions
}

const { getCurrentPayoutIndex } = require('./Account')
const Converter = require('@iota/converter')

const { getOpenPayments } = require('./payment')
const {
  update_payment,
  store_index_for_payouts,
  get_payment
} = require('./Database')
const eventHandler = require('./eventHandler')
const iota = require('./iota')

let maxPaymentTime = process.env.MAX_PAYMENT_TIME

let paymentHandler = false
let lastPaymentConfirmation = 0
let paymentIntervall = 60000
// increase intervall if zmq is enabled
if (process.env.zmq === 'true' || process.env.fast_but_risky === 'true') {
  paymentIntervall = paymentIntervall * 3
}

function getlastPaymentConfirmation() {
  return lastPaymentConfirmation
}

function start() {
  if (paymentHandler) {
    if (process.env.debug === 'basic' || process.env.debug === 'full') {
      console.log('payment handler already started.')
    }
    return
  }
  if (process.env.debug === 'basic' || process.env.debug === 'full') {
    console.log('payment handler started')
  }
  async function checkPaymentStatus() {
    try {
      // check if there are open payments
      const payments = await getOpenPayments()
      if (typeof payments !== 'undefined' && payments.length > 0) {
        // check payments by time
        const timePayments = payments.filter(p => p.type === 'time')
        checkTimePayments(timePayments)

        const valuePayments = payments.filter(p => p.type === 'value')
        // check if the transaction is confirmed
        const paymentsToCheck = filterpaymentsToCheck(valuePayments)
        // look for incoming value transactions
        await checkForTransactions(paymentsToCheck)

        // check balances
        await checkPaymentsBalance(paymentsToCheck)

        // reset paymenthandler if all payments are payed so it can start instant the next time
        const newPayments = await getOpenPayments()
        if (typeof newPayments === 'undefined' || newPayments.length === 0) {
          if (process.env.debug === 'basic' || process.env.debug === 'full') {
            console.log('there are no open payments')
          }
          clearInterval(intervall)
          paymentHandler = false
        }
      } else {
        if (process.env.debug === 'basic' || process.env.debug === 'full') {
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
  // start immediately
  checkPaymentStatus()
  paymentHandler = true
}

async function checkTimePayments(timePayments) {
  const currentTime = Math.floor(Date.now() / 1000)
  for (let timePayment of timePayments) {
    // set confirmed if time is reached
    if (timePayment.confirmationTime < currentTime) {
      if (process.env.debug === 'basic' || process.env.debug === 'full') {
        console.log(
          `Paymenttime reached! ${
            timePayment.id
          } Address: ${timePayment.address.slice(0, 6)}...`
        )
      }
      const newPayment = await update_payment(
        { id: timePayment.id },
        { payed: true }
      )

      const eventMessage = {
        type: 'payment',
        status: 'paymentSuccess',
        payment: newPayment
      }
      eventHandler.emit(eventMessage)

      // check if index < payoutIndex, add to extra list so it can be used for inputs
      if (timePayment.index < getCurrentPayoutIndex()) {
        await store_index_for_payouts(timePayment.index)
      }
      lastPaymentConfirmation = Date.now()
    }
  }
}
function checkPaymentsBalance(paymentsToCheck) {
  return new Promise(async (resolve, reject) => {
    try {
      const addresses = paymentsToCheck.map(payment => payment.address)
      const balances = await iota.getBalances(addresses, 100)
      balances.balances.forEach(async (balance, index) => {
        if (balance >= paymentsToCheck[index].value) {
          if (balance > paymentsToCheck[index].value) {
            if (process.env.debug === 'full') {
              // console.log('thank you for the donation!')
              console.log(
                `Received ${balance -
                  paymentsToCheck[index].value}i more than required`
              )
            }
          }
          // check if already confirmed because it can be called from zmq at the same time
          const checkPaymentStatus = await get_payment({
            id: paymentsToCheck[index].id
          })
          if (checkPaymentStatus.payed === true) {
            return
          }

          if (process.env.debug === 'basic' || process.env.debug === 'full') {
            console.log(
              `Payment ${
                paymentsToCheck[index].id
              } successfull! Address: ${paymentsToCheck[index].address.slice(
                0,
                6
              )}...`
            )
          }

          let newPayment = await update_payment(paymentsToCheck[index].id, {
            payed: true
          })
          if(typeof newPayment.txInfo == 'undefined'){
            newPayment = await update_payment(paymentsToCheck[index].id, {
              txInfo: {value: paymentsToCheck[index].value}
            })
          }

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
            await store_index_for_payouts(paymentsToCheck[index].index)
          }
          lastPaymentConfirmation = Date.now()
        } else {
          // exit early if payment is already accepted
          if (paymentsToCheck[index].earlyAccepted === true) {
            return
          }
          if (balances >= 0) {
            // todo add emitter? or remove the if check?
            if (process.env.debug === 'full') {
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
            if (process.env.debug === 'full') {
              console.log(
                `No iotas found for payment ${paymentsToCheck[index].id}. Address: ${paymentsToCheck[index].address}`
              )
            }
          }
        }
      })

      // update lastTime
      for (payment of paymentsToCheck) {
        await update_payment(payment.id, { lastTime: Date.now() })
      }
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
        transactions.forEach(async tx => {
          if (tx.value > 0) {
            const payment = payments.find(
              payment => payment.address.slice(0, 81) === tx.address
            )
            // check if payment was already successfull
            const uptodatepayment = await get_payment({ id: payment.id })
            if (uptodatepayment.payed === true) {
              return
            }
            if (process.env.debug === 'full') {
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
                hash: tx.hash,
                value: tx.value
              }
              await update_payment(payment.id, { txInfo: txInfo })
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
  payments.forEach(async payment => {
    // remove from payments to check if older than maxPaymentTime
    if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
      await update_payment(payment.id, { payed: 'timeout' })
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
