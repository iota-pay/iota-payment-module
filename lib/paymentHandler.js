module.exports = { start }

const iotaCore = require('@iota/core')
const { getOpenPayments } = require('./payments')
const db = require('./Database')
const eventEmitter = require('./eventEmitter')

const iotaNode = process.env.IOTANODE
const maxPaymentTime = process.env.MAX_PAYMENT_TIME

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
        //console.log(payments)
        // check if the transaction is confirmed
        payments.forEach(payment => {
          //payment.checkPayment()

          iota
            .getBalances([payment.address], 100)
            .then(balances => {
              if (balances.balances[0] >= payment.value) {
                if (balances.balances[0] > payment.value) {
                  console.log('thank you for the donation!')
                }
                console.log(`Payment ${payment.id} successfull`)
                const new_payment = db
                  .get('payments')
                  .find({ id: payment.id })
                  .assign({ payed: true })
                  .write()
                eventEmitter.emit('paymentSuccess', new_payment)
              } else {
                //check if payment is too old
                if ((Date.now() - payment.id) / 60000 > maxPaymentTime) {
                  db.get('payments')
                    .find({ id: payment.id })
                    .assign({ payed: 'timeout' })
                    .write()
                  throw `Payment ${payment.id} timed out`
                }
                if (balances.balances[0] >= 0) {
                  throw 'Not enough iotas found for payment: ' + payment.id
                } else {
                  throw 'No iotas found'
                }
              }
            })
            .catch(err => console.error(err))
        })
      } else {
        console.log('there are no open payments')
        clearInterval(intervall)
        paymentHandler = false
      }
    })
  }
  checkPaymentStatus()
  let intervall = setInterval(checkPaymentStatus, 9000)
  paymentHandler = true
}
