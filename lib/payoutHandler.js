module.exports = { start }

const {
  getOpenPayouts,
  sendPayout,
  updatePayout,
  payoutValidator
} = require('./payout')
const { get_raw_bundles, get_payout, delete_raw_bundle } = require('./Database')
const eventHandler = require('./eventHandler')
const { getlastPaymentConfirmation } = require('./paymentHandler')
const txconverter = require('@iota/transaction-converter')
const iota = require('./iota')

let payoutHandler = false
let sendStatus = false
let lastErrorTime = 0
let payoutError = 0
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
    //check if new payments got accepted
    let paymentTime = getlastPaymentConfirmation()
    if (payoutError == 3 && lastErrorTime > paymentTime) {
      if (process.env.debug == 'basic' || process.env.debug == 'full') {
        console.log('early returned from checkpayoutstatus')
      }
      //check again after 3 minutes
      if (Date.now() - lastErrorTime < 180000) {
        return
      }
    }
    //reset error counter
    if (payoutError >= 2) {
      payoutError = 0
    }

    // check if there are open payouts
    getOpenPayouts().then(payouts => {
      if (typeof payouts !== 'undefined' && payouts.length > 0) {
        //todo get latest inclusion, reattach/promote if unconfirmed, use milestone intervall for intervall?
        if (sendStatus == false) {
          sendStatus = true
          sendPayout(payouts[0])
            .then(async payed => {
              //payed foreach
              for (payoutInfo of payed.payouts) {
                let payout = await get_payout({ id: payoutInfo.id })
                payout.txhash = payoutInfo.txhash
                payout.payed = true
                await updatePayout(payout)
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
              if (payed.payouts[0].value > 0) {
                //tailhash, amount
                if (
                  payed.txhash !=
                  'No txhash, because the address is from the same seed'
                ) {
                  promote(payed.txhash, 2)
                }
              }
            })
            .catch(err => {
              sendStatus = false
              console.error(err)
              payoutError++
              lastErrorTime = Date.now()
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

//check confirmation status of payouts
checkSentPayouts()
setInterval(() => checkSentPayouts(), 120000)
async function checkSentPayouts() {
  try {
    if (process.env.debug == 'full') {
      console.log('Run checkSentPayouts')
    }
    let rawBundles = await get_raw_bundles()
    //return if no open payouts
    if (rawBundles == null || rawBundles.length == 0) {
      return
    }

    for (rawBundle of rawBundles) {
      try {
        let bundleObjects = await iota.findTransactionObjects({
          bundles: [rawBundle.bundleHash]
        })
        let allTailTxsofBundle = bundleObjects
          .filter(tx => tx.currentIndex == 0)
          .map(tx => tx.hash)
          let inclusionStates = await iota.getLatestInclusion(allTailTxsofBundle)
        if (inclusionStates.indexOf(true) === -1) {
          //reattach with local trytes and promote
          await reattachAndPromote(rawBundle.trytes)
        } else {
          //delete confirmed trytes
          await delete_raw_bundle(rawBundle.bundleHash)
        }
      } catch (e) {
        if (process.env.debug == 'basic' || process.env.debug == 'full') {
          console.log('Problem with reattachment', e)
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
}

async function reattachAndPromote(bundletrytes) {
  //use latest ms as tip
  let nodeInfo = await iota.getNodeInfo()
  let attachedTrytes = await iota.attachToTangle(
    nodeInfo.latestMilestone,
    nodeInfo.latestMilestone,
    14,
    bundletrytes
  )
  await iota.storeAndBroadcast(attachedTrytes)
  let replayhash = txconverter.asTransactionObject(attachedTrytes[0]).hash
  if (process.env.debug == 'basic' || process.env.debug == 'full') {
    console.log(
      'Reattached transaction: https://thetangle.org/transaction/' + replayhash
    )
  }
  promote(replayhash, 2)
}
