const db = require('./Database')

let currentIndex = db.get('keyIndex').value()
let currentPayoutIndex = db.get('payoutIndex').value()
const iotaCore = require('@iota/core')
const SEED = process.env.SEED

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
    let address = iotaCore.generateAddress(SEED, getNextIndex(), 2, true)

    // Watch for incoming address if its not a zero value transaction.
    //watchAddressOnNode(address, VALUE > 0 ? true : false);

    resolve(address)
  })
}

module.exports = {
  getNewAddress,
  getNextIndex,
  getCurrentIndex,
  getCurrentPayoutIndex,
  setPayoutIndex
}
