module.exports = {start}

const iotaCore = require('@iota/core')
const { getOpenPayments } = require('./payments')
const iotaNode = process.env.IOTANODE
const db = require('./Database')
const eventEmitter = require('./eventEmitter')

const iota = iotaCore.composeAPI({
    provider: iotaNode
})
function start() {
    console.log("payment handler started")
    function checkPaymentStatus() {
        // check if there are open payments
        getOpenPayments().then(payments => {
            if (typeof payments !== 'undefined' && payments.length > 0) {
                //console.log(payments)
                // check if the transaction is confirmed
                payments.forEach(payment => {
                    //payment.checkPayment()

                    iota.getBalances([payment.address], 100).then(balances => {
                        if (balances.balances[0] > payment.value) {
                            console.log("thank you for the donation!")
                              const new_payment = db
                                  .get('payments')
                                  .find({ id: payment.id })
                                  .assign({ payed: true })
                                  .write()
                              eventEmitter.emit('paymentSuccess', new_payment)

                        } else if (balances.balances[0] >= payment.value) {
                            console.log(`Payment ${payment.id} successfull`)
                            const new_payment = db
                                .get('payments')
                                .find({ id: payment.id })
                                .assign({ payed: true })
                                .write()
                              eventEmitter.emit('paymentSuccess', new_payment)

                        }
                        else if (balances.balances[0] >= 0) {
                            throw 'Not enough iotas found for payment: '+payment.id
                        }
                        else {
                            throw 'No iotas found'

                        }

                    })
                    .catch(err => console.error(err))

                });
            } else {
                console.log("there are no open payments")
                clearInterval(interval);
            }
        })
    }
    let interval = setInterval(checkPaymentStatus, 9000);
    checkPaymentStatus();
}