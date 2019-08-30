module.exports = getNewAddress

const iotaCore = require('@iota/core')

const SEED = process.env.SEED;

function getNewAddress() {
    let address = iotaCore.generateAddress(SEED, 1, 2)
    console.log("payment address: " + address)

    // Watch for incoming address if its not a zero value transaction.
    //watchAddressOnNode(address, VALUE > 0 ? true : false);

    return address;
}
