const db = require('./Database')

let currentIndex = db.get('keyIndex').value()
let currentPayoutIndex = db.get('payoutIndex').value()
const iotaCore = require('@iota/core')
const SEED = process.env.SEED
const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

if (Number.isInteger(currentIndex)) {
  console.log(
    `Database loaded. Current address index: ${currentIndex}, payout index: ${currentPayoutIndex}`
  )
} else {
  // setup database
  currentIndex = 0
  currentPayoutIndex = 0
  db.set('keyIndex', currentIndex).write()
  db.set('payoutIndex', currentPayoutIndex).write()
  console.log('Database created.')
}

const getNextIndex = function() {
  increaseIndex()
  return currentIndex
}
const getCurrentIndex = function() {
  return currentIndex
}

const increaseIndex = function() {
  currentIndex = currentIndex + 1
  db.set('keyIndex', currentIndex).write()
}

const getCurrentPayoutIndex = function() {
  return currentPayoutIndex
}

const setPayoutIndex = function(newIndex) {
  currentPayoutIndex = newIndex
  db.set('payoutIndex', newIndex).write()
}

function getNewAddress() {
  return new Promise(function(resolve, reject) {
    let addressIndex = getNextIndex()
    let address = iotaCore.generateAddress(SEED, addressIndex, 2, true)

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
    let payments = db.get('payments').value()
    payments = payments.concat(db.get('remainderAddresses').value())
    let addresses = payments.map(payment => payment.address)
    //add addresses from first two indexes because they aren't used for payments
    addresses.push(iotaCore.generateAddress(SEED, 0, 2))
    addresses.push(iotaCore.generateAddress(SEED, 1, 2))
    let balances = await getAddressBalances(addresses)
    let totalBalance = balances.reduce((a, b) => {
      return a + b
    })
    resolve(totalBalance)
  })
}

async function getAddressBalances(addresses) {
  let balanceResponse = await iota.getBalances(addresses, 100)
  return balanceResponse.balances
}

module.exports = {
  getNewAddress,
  getNextIndex,
  getCurrentIndex,
  getCurrentPayoutIndex,
  setPayoutIndex,
  getBalance
}
