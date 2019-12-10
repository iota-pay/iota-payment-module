module.exports = { start }

const {
  getOpenpayouts,
  sendPayout,
  updatePayout,
  payoutValidator
} = require('./payout')
const db = require('./Database')
const eventHandler = require('./eventHandler')
const iotaCore = require('@iota/core')
const txconverter = require('@iota/transaction-converter')
const iotaNode = process.env.IOTANODE
const iota = iotaCore.composeAPI({
  provider: iotaNode
})

let payoutHandler = false
let sendStatus = false
function start() {
  if (payoutHandler) {
    if (process.env.debug == 'basic' || process.env.debug == 'full') {
      console.log('payout handler already started.')
    }
    return
  }
  if (process.env.debug == 'basic' || process.env.debug == 'full') {
    console.log('payout handler started')
  }
  function checkpayoutstatus() {
    // check if there are open payouts
    getOpenpayouts().then(payouts => {
      if (typeof payouts !== 'undefined' && payouts.length > 0) {
        //todo get latest inclusion, reattach/promote if unconfirmed, use milestone intervall for intervall?
        //validate payouts
        payouts.forEach(payout => {
          payoutValidator(payout).catch(() => {
            //move payout to invalid payouts
            db.get('invalidPayouts')
              .push(payout)
              .write()
            db.get('payouts')
              .remove({ id: payout.id })
              .write()
          })
        })
        if (sendStatus == false) {
          sendStatus = true
          sendPayout(payouts[0])
            .then(payed => {
              //payed foreach
              for (payoutInfo of payed.payouts) {
                let payout = db
                  .get('payouts')
                  .find({ id: payoutInfo.id })
                  .value()
                payout.txhash = payoutInfo.txhash
                updatePayout(payout)
                payout.payed = true
                let eventMessage = {
                  type: 'payout',
                  status: 'payoutSent',
                  payout: payout
                }
                eventHandler.emit(eventMessage)
              }
              if (process.env.debug == 'basic' || process.env.debug == 'full') {
                console.log(
                  'payout sent: https://thetangle.org/transaction/' +
                    payed.txhash
                )
              }
              sendStatus = false
              //tailhash, amount
              promote(payed.txhash, 2)
            })
            .catch(err => {
              sendStatus = false
              console.error(err)
            })
        }
      } else {
        if (process.env.debug == 'basic' || process.env.debug == 'full') {
          console.log('there are no open payouts')
        }
        clearInterval(intervall)
        payoutHandler = false
      }
    })
  }
  //start immediately
  checkpayoutstatus()
  let intervall = setInterval(checkpayoutstatus, 30000)
  payoutHandler = true
}

async function promote(txhash, amount) {
  try {
    let transfers = [{ value: 0, address: '9'.repeat(81) }]
    let trytes = await iota.prepareTransfers('9'.repeat(81), transfers)
    if (amount % 2 == 0) {
      tips = await iota.getTransactionsToApprove(3)
      attachedTrytes = await iota.attachToTangle(
        txhash,
        tips.branchTransaction,
        14,
        trytes
      )
    } else {
      if (typeof tips == 'undefined') {
        tips = await iota.getTransactionsToApprove(3)
      }
      attachedTrytes = await iota.attachToTangle(
        txhash,
        tips.trunkTransaction,
        14,
        trytes
      )
    }
    await iota.storeAndBroadcast(attachedTrytes)
    if (process.env.debug == 'full') {
      console.log(
        'Promotetx: https://thetangle.org/transaction/' +
          txconverter.asTransactionObject(attachedTrytes[0]).hash
      )
    }
    amount--
    if (amount > 0) {
      promote(txhash, amount)
    }
  } catch (e) {
    console.log(e)
  }
}
