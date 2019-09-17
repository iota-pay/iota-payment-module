module.exports = { start }

const iotaCore = require('@iota/core')
const {
  getOpenpayouts,
  sendPayout,
  updatePayout,
  payoutChecker
} = require('./payout')
const db = require('./Database')
const eventEmitter = require('./eventEmitter')

let payoutHandler = false
let sending = false
function start() {
  if (payoutHandler) {
    console.log('payout handler already started.')
    return
  }
  console.log('payout handler started')
  function checkpayoutstatus() {
    // check if there are open payouts
    getOpenpayouts().then(payouts => {
      if (typeof payouts !== 'undefined' && payouts.length > 0) {
        //todo get latest inclusion, reattach/promote if unconfirmed, use milestone intervall for intervall?
        if (sending == false) {
          payoutChecker(payouts[0]).catch(() => {
            //move payout to invalid payouts
            db.get('payouts')
              .remove({ id: payouts[0].id })
              .write()

            db.get('invalidPayouts')
              .push(payouts[0])
              .write()
          })
          sending = true
          sendPayout(payouts[0])
            .then(res => {
              payouts[0].txhash = res.txhash
              console.log(
                'payout sent: https://thetangle.org/transaction/' + res.txhash
              )
              updatePayout(payouts[0])
              sending = false
              // eventEmitter.emit('payoutSuccess', new_payout)
            })
            .catch(err => {
              sending = false
              console.error(err)
            })
        }
      } else {
        console.log('there are no open payouts')
        clearInterval(intervall)
        payoutHandler = false
      }
    })
  }
  let intervall = setInterval(checkpayoutstatus, 9000)
  payoutHandler = true
}
