module.exports = getNewAddress

const { getNextIndex } = require('./Account')
const iotaCore = require('@iota/core')

const SEED = process.env.SEED

function getNewAddress() {
  return new Promise(function(resolve, reject) {
    let address = iotaCore.generateAddress(SEED, getNextIndex(), 2, true)

    // Watch for incoming address if its not a zero value transaction.
    //watchAddressOnNode(address, VALUE > 0 ? true : false);

    resolve(address)
  })
}
