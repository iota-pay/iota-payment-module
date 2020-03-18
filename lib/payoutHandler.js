module.exports = { start }

const { sendPayoutBundle } = require('./payout')
const {
  getRawBundles,
  getPayout,
  updatePayout,
  deleteRawBundle,
  getOpenPayouts,
  deletePayout
} = require('./Database')
const eventHandler = require('./eventHandler')
const { getlastPaymentConfirmation } = require('./paymentHandler')
const txconverter = require('@iota/transaction-converter')
const iota = require('./iota')
const config = require('./config.js');

let payoutHandler = false
let sendStatus = false
let lastErrorTime = 0
let payoutError = 0
function start() {
  if (payoutHandler) {
    if (config.debug == 'basic' || config.debug == 'full') {
      console.log('payout handler already started.')
    }
    return
  }
  if (config.debug == 'basic' || config.debug == 'full') {
    console.log('payout handler started')
  }
  function checkpayoutstatus() {
    //check if new payments got accepted
    let paymentTime = getlastPaymentConfirmation()
    if (payoutError == 3 && lastErrorTime > paymentTime) {
      if (config.debug == 'basic' || config.debug == 'full') {
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
          sendPayoutBundle(payouts[0])
            .then(async payed => {
              //payed foreach
              for (payoutInfo of payed.payouts) {
                let payout = await getPayout({ id: payoutInfo.id })
                payout.txhash = payoutInfo.txhash
                payout.payed = true
                let newPayout = await updatePayout(
                  { id: payout.id },
                  { txhash: payout.txhash, payed: true }
                )
                let eventMessage = {
                  type: 'payout',
                  status: 'payoutSent',
                  payout: newPayout
                }
                eventHandler.emit(eventMessage)

                //delete confirmed payouts to save space if enabeld
                if (config.deletePaidEntries == 'true') {
                  if (
                    config.debug === 'basic' ||
                    config.debug === 'full'
                  ) {
                    console.log('Delete confirmed payout from db', newPayout)
                  }
                  await deletePayout(newPayout.id)
                }
              }

              if (config.debug == 'basic' || config.debug == 'full') {
                console.log(
                  'payout sent: ' + config.explorerTxLink+
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
              if (config.debug == 'basic' || config.debug == 'full') {
                console.error(err)
              }
              payoutError++
              lastErrorTime = Date.now()
            })
        }
      } else {
        if (config.debug == 'basic' || config.debug == 'full') {
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
        config.mwm,
        trytes
      )
    } else {
      if (typeof tips == 'undefined') {
        tips = await iota.getTransactionsToApprove(3)
      }
      attachedTrytes = await iota.attachToTangle(
        txhash,
        tips.trunkTransaction,
        config.mwm,
        trytes
      )
    }
    await iota.storeAndBroadcast(attachedTrytes)
    if (config.debug == 'full') {
      console.log(
        'Promotetx: ' +config.explorerTxLink+
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
    if (config.debug == 'full') {
      console.log('Run checkSentPayouts')
    }
    let rawBundles = await getRawBundles()
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
          let bundleObjects = await reattachAndPromote(rawBundle.trytes)

          //add txhash for each payout
          bundleObjects
            .slice()
            .reverse()
            .forEach(tx => {
              let index = rawBundle.payouts.findIndex(
                e => e.address.slice(0, 81) == tx.address && e.value == tx.value
              )
              if (index >= 0) {
                rawBundle.payouts[index].txhash = tx.hash
              }
            })
          //update payouts
          for (payout of rawBundle.payouts) {
            let newPayout = await updatePayout(
              { id: payout.id },
              { txhash: payout.txhash, payed: true }
            )
            let eventMessage = {
              type: 'payout',
              status: 'payoutSent',
              payout: newPayout
            }
            eventHandler.emit(eventMessage)

            //delete confirmed payouts to save space if enabeld
            if (config.deletePaidEntries == 'true') {
              if (
                config.debug === 'basic' ||
                config.debug === 'full'
              ) {
                console.log('Delete confirmed payout from db', newPayout)
              }
              await deletePayout(newPayout.id)
            }
          }
        } else {
          //delete confirmed trytes
          await deleteRawBundle(rawBundle.bundleHash)
        }
      } catch (e) {
        if (config.debug == 'basic' || config.debug == 'full') {
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
    config.mwm,
    bundletrytes
  )
  await iota.storeAndBroadcast(attachedTrytes)
  let bundle = attachedTrytes.map(e => txconverter.asTransactionObject(e))
  if (config.debug == 'basic' || config.debug == 'full') {
    console.log(
      'Reattached transaction: ' +config.explorerTxLink+
        bundle[0].hash
    )
  }
  promote(bundle[0].hash, 2)
  return bundle
}
