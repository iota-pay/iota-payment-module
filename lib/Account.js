const {
  increaseKeyIndex,
  storeAddress,
  getAddresses,
  getRawBundles,
} = require('./Database')

const iota = require('./iota')
const config = require('./config.js')
const { checkSentPayouts } = require('./payoutHandler.js')
const { generate_address } = require('../ipm-wasm/iotapay')

function getNewAddress() {
  return new Promise(async function (resolve, reject) {
    let addressIndex = await increaseKeyIndex()
    let t0 = Date.now()
    let address = generate_address(config.seed, addressIndex, 2, true)
    if (config.debug === 'basic' || config.debug === 'full') {
      console.log(
        'iotapay::getNewAddress -- Time for generateAddress ' +
          (Date.now() - t0) +
          ' milliseconds.'
      )
    }
    await storeAddress({ address: address, index: addressIndex })
    resolve({ address: address, index: addressIndex })
  })
}

/**
 * Returns the balance
 * @returns {number} balance
 * @example
 * // get payout by txhash
 * paymentModule.getBalance()
 *  .then(balance => {
 *      console.log(balance)
 *    })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example balance:
 * 15
 */
function getBalance() {
  return new Promise(async (resolve, reject) => {
    try {
      let addressObjects = await getAddresses()
      //maybe filter also for index > payoutIndex + indexesForPayouts to reduce amount of addresses
      let unusedAdresses = addressObjects.filter((e) => e.spent != true)
      let addresses = unusedAdresses.map((payment) => payment.address)
      let balances = await getAddressBalances(addresses)
      let totalBalance = balances.reduce((a, b) => {
        return a + b
      })
      //check for confirmation first, otherwise the funds might be on an unused address and the bundle is still in rawBundles
      await checkSentPayouts(true)
      let rawBundles = await getRawBundles()
      //return if no open payouts
      if (rawBundles == null || rawBundles.length == 0) {
        return resolve(totalBalance)
      }
      let pendingValue = rawBundles.reduce(
        (a, b) => a + b.remainingValueforBalance,
        0
      )
      resolve(totalBalance + pendingValue)
    } catch (e) {
      console.log(e)
      reject(e)
    }
  })
}

async function getAddressBalances(addresses) {
  let balanceResponse = await iota.getBalances(addresses, 100)
  return balanceResponse.balances
}

module.exports = {
  getNewAddress,
  getBalance,
}
