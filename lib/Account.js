const {
  getKeyIndex,
  getPayoutIndex,
  increaseKeyIndex,
  setPayoutIndex,
  storeAddress,
  getAddresses
} = require('./Database')

const iotaCore = require('@iota/core')
const iota = require('./iota')

startAccount()
async function startAccount() {
  let currentIndex = await getKeyIndex()
  let currentPayoutIndex = await getPayoutIndex()
  if (Number.isInteger(currentIndex)) {
    console.log(
      `Database loaded. Current address index: ${currentIndex}, payout index: ${currentPayoutIndex}`
    )
  } else {
    console.log('Error loading database.')
  }
}

const getNextIndex = async function() {
  let newIndex = await increaseKeyIndex()
  return newIndex
}

function getNewAddress() {
  return new Promise(async function(resolve, reject) {
    let addressIndex = await getNextIndex()
    let address = iotaCore.generateAddress(
      process.env.SEED,
      addressIndex,
      2,
      true
    )
    await storeAddress({ address: address, index: addressIndex })
    // Watch for incoming address if its not a zero value transaction.
    //watchAddressOnNode(address, VALUE > 0 ? true : false);

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
      let unusedAdresses = addressObjects.filter(e => e.spent != true)
      let addresses = unusedAdresses.map(payment => payment.address)
      let balances = await getAddressBalances(addresses)
      let totalBalance = balances.reduce((a, b) => {
        return a + b
      })
      resolve(totalBalance)
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
  getNextIndex,
  setPayoutIndex,
  getBalance
}
