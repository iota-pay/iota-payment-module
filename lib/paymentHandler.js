module.exports = {
  start,
  checkPaymentsBalance,
  getlastPaymentConfirmation,
  checkForTransactions,
}

const Converter = require('@iota/converter')

const {
  updatePayment,
  storeIndexForPayouts,
  getPayment,
  getPayoutIndex,
  getOpenPayments,
  deletePayment,
  deleteKeyFromPayment,
} = require('./Database')
const eventHandler = require('./eventHandler')
const iota = require('./iota')
const config = require('./config.js')

let maxPaymentTime = config.maxPaymentTime

let paymentHandler = false
let lastPaymentConfirmation = 0
let paymentIntervall = 40000
// increase intervall if zmq is enabled
if (config.zmq === 'true' || config.fastButRisky === 'true') {
  paymentIntervall = paymentIntervall * 3
}

function getlastPaymentConfirmation() {
  return lastPaymentConfirmation
}

function start() {
  if (paymentHandler) {
    if (config.debug === 'basic' || config.debug === 'full') {
      console.log('payment handler already started.')
    }
    return
  }
  if (config.debug === 'basic' || config.debug === 'full') {
    console.log('payment handler started')
  }
  async function checkPaymentStatus() {
    try {
      // check if there are open payments
      const payments = await getOpenPayments()
      if (typeof payments !== 'undefined' && payments.length > 0) {
        // check payments by time
        const timePayments = payments.filter((p) => p.type === 'time')
        checkTimePayments(timePayments)

        const valuePayments = payments.filter((p) => p.type === 'value')
        // check if the transaction is confirmed
        const paymentsToCheck = filterpaymentsToCheck(valuePayments)
        if (paymentsToCheck.length == 0) {
          return
        }
        // look for incoming value transactions
        await checkForTransactions(paymentsToCheck)

        // check balances
        await checkPaymentsBalance(paymentsToCheck)

        // reset paymenthandler if all payments are payed so it can start instant the next time
        const newPayments = await getOpenPayments()
        if (typeof newPayments === 'undefined' || newPayments.length === 0) {
          if (config.debug === 'basic' || config.debug === 'full') {
            console.log('there are no open payments')
          }
          clearInterval(intervall)
          paymentHandler = false
        }
      } else {
        if (config.debug === 'basic' || config.debug === 'full') {
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
      if (config.debug === 'basic' || config.debug === 'full') {
        console.log(
          `Paymenttime reached! ${
            timePayment.id
          } Address: ${timePayment.address.slice(0, 6)}...`
        )
      }
      await updatePayment(timePayment.id, { payed: true })
      let newPayment = await deleteKeyFromPayment(timePayment.id, 'lastTime')

      const eventMessage = {
        type: 'payment',
        status: 'paymentSuccess',
        payment: newPayment,
      }
      eventHandler.emit(eventMessage)

      // check if index < payoutIndex, add to extra list so it can be used for inputs
      if (timePayment.index < (await getPayoutIndex())) {
        await storeIndexForPayouts(timePayment.index)
      }
      lastPaymentConfirmation = Date.now()

      //delete confirmed payments to save space if enabeld
      if (config.deletePaidEntries == 'true') {
        if (config.debug === 'basic' || config.debug === 'full') {
          console.log('Delete confirmed payment from db', newPayment)
        }
        await deletePayment(newPayment.id)
      }
    }
  }
}
function checkPaymentsBalance(paymentsToCheck) {
  return new Promise(async (resolve, reject) => {
    try {
      const addresses = paymentsToCheck.map((payment) => payment.address)
      const balances = await iota.getBalances(addresses, 100)
      for ([index, balance] of balances.balances.entries()) {
        // balances.balances.forEach(async (balance, index) => {
        if (balance >= paymentsToCheck[index].value) {
          if (balance > paymentsToCheck[index].value) {
            if (config.debug === 'full') {
              // console.log('thank you for the donation!')
              console.log(
                `Received ${
                  balance - paymentsToCheck[index].value
                }i more than required`
              )
            }
          }
          // check if already confirmed because it can be called from zmq at the same time
          const checkPaymentStatus = await getPayment({
            id: paymentsToCheck[index].id,
          })
          if (checkPaymentStatus.payed === true) {
            return
          }

          if (config.debug === 'basic' || config.debug === 'full') {
            console.log(
              `Payment ${
                paymentsToCheck[index].id
              } successfull! Address: ${paymentsToCheck[index].address.slice(
                0,
                6
              )}...`
            )
          }

          await updatePayment(paymentsToCheck[index].id, {
            payed: true,
          })
          let newPayment = await deleteKeyFromPayment(
            paymentsToCheck[index].id,
            'lastTime'
          )
          if (typeof newPayment.txInfo == 'undefined') {
            newPayment = await updatePayment(paymentsToCheck[index].id, {
              txInfo: { value: paymentsToCheck[index].value },
            })
          }

          // ignore already accepted payments
          if (typeof paymentsToCheck[index].earlyAccepted === 'undefined') {
            const eventMessage = {
              type: 'payment',
              status: 'paymentSuccess',
              payment: newPayment,
            }
            eventHandler.emit(eventMessage)
          }

          // check if index < payoutIndex, add to extra list so it can be used for inputs
          if (paymentsToCheck[index].index < (await getPayoutIndex())) {
            await storeIndexForPayouts(paymentsToCheck[index].index)
          }
          lastPaymentConfirmation = Date.now()

          //delete confirmed payments to save space if enabeld
          if (config.deletePaidEntries == 'true') {
            if (config.debug === 'basic' || config.debug === 'full') {
              console.log('Delete confirmed payment from db', newPayment)
            }
            await deletePayment(newPayment.id)
          }
        } else {
          // exit early if payment is already accepted
          if (paymentsToCheck[index].earlyAccepted === true) {
            return
          }
          if (balances >= 0) {
            // todo add emitter? or remove the if check?
            if (config.debug === 'full') {
              console.log(
                `Not enough iotas found for payment ${paymentsToCheck[index].id}: ${balance} of ${paymentsToCheck[index].value}`
              )
            }
          } else {
            const eventMessage = {
              type: 'payment',
              status: 'paymentPending',
              payment: paymentsToCheck[index],
            }
            eventHandler.emit(eventMessage)
            if (config.debug === 'full') {
              console.log(
                `No iotas found for payment ${paymentsToCheck[index].id}. Address: ${paymentsToCheck[index].address}`
              )
            }
          }
        }
      }

      // update lastTime
      for (payment of paymentsToCheck) {
        let p = await getPayment({ id: payment.id })
        if (p.payed != true) {
          await updatePayment(payment.id, { lastTime: Date.now() })
        }
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
    const paymentsToCheck = payments.filter((e) => e.earlyAccepted !== true)
    const paymentAdresses = paymentsToCheck.map((e) => e.address)
    iota
      .findTransactionObjects({ addresses: paymentAdresses })
      .then((transactions) => {
        transactions.forEach(async (tx) => {
          if (tx.value > 0) {
            const payment = payments.find(
              (payment) => payment.address.slice(0, 81) === tx.address
            )
            // check if payment was already successfull
            const uptodatepayment = await getPayment({ id: payment.id })
            if (uptodatepayment.payed === true) {
              return
            }
            if (config.debug === 'full') {
              console.log(
                `Incoming transaction for payment ${payment.id}: value tx: ${tx.value} value payment: ${payment.value}`
              )
            }
            if (tx.value >= payment.value) {
              const message = Converter.trytesToAscii(
                tx.signatureMessageFragment + '9'
              ).replace(/\0/g, '')
              let txInfo = {
                timestamp: tx.timestamp,
                hash: tx.hash,
                value: tx.value,
              }
              if (message != '') {
                txInfo.message = message
              }
              await updatePayment(payment.id, { txInfo: txInfo })
              const eventMessage = {
                type: 'payment',
                status: 'paymentIncoming',
                payment: payment,
              }
              eventHandler.emit(eventMessage)
            }
          }
        })
        resolve()
      })
      .catch((err) => {
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
  payments.forEach(async (payment) => {
    // remove from payments to check if older than maxPaymentTime
    if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
      await updatePayment(payment.id, { payed: 'timeout' })
      await deleteKeyFromPayment(payment.id, 'lastTime')
      //delete confirmed payments to save space if enabeld
      if (config.deletePaidEntries == 'true') {
        if (config.debug === 'basic' || config.debug === 'full') {
          console.log('Delete timeout payment from db', payment)
        }
        await deletePayment(payment.id)
      }
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
    // add if younger than 90 minutes && last check > 2 minutes
    if (
      (Date.now() - payment.id) / 60000 < 90 &&
      (Date.now() - payment.lastTime) / 60000 > 2
    ) {
      paymentsToCheck.push(payment)
      return
    }
    // add if younger than maxPaymentTime (9 days default) && last check > 30 minutes
    if (
      (Date.now() - payment.id) / 60000 < maxPaymentTime &&
      (Date.now() - payment.lastTime) / 60000 > 30
    ) {
      paymentsToCheck.push(payment)
    }
  })

  return paymentsToCheck
}
