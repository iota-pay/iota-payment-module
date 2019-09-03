module.exports = sendPayout

//should be unnecessary later
const dotenv = require('dotenv')
dotenv.config()
//

const { getNextIndex } = require('./Account')
const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')

const SEED = process.env.SEED
const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

let transfers = [
  {
    value: totalBalance,
    address: iotaAddress
  }
]

let inputOptions = {
  inputs: []
}

//start- and endIndex is optional
//with the address only 0 and the latest index from the db is used
async function sendPayout(iotaAddress, startIndex, endIndex) {
  if (!checksum.isValidChecksum(iotaAddress)) {
    console.error('Invalid iotaAddress')
    return
  }

  startIndex = typeof startIndex !== 'undefined' ? startIndex : 0
  endIndex =
    typeof endIndex !== 'undefined' ? endIndex : (await getNextIndex()) - 1

  let addresses = generateAddresses(startIndex, endIndex)
  let balances = await getBalances(addresses)

  let totalBalance = balances.reduce((a, b) => {
    return a + b
  })

  if (totalBalance <= 0) {
    console.error('No iotas found')
    return
  }

  for (let k = 0; k < balances.length; k++) {
    if (balances[k] > 0) {
      inputOptions.inputs.push({
        address: addresses[k],
        keyIndex: k,
        balance: balances[k],
        security: 2
      })
    }
  }

  let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
  let bundle = await iota.sendTrytes(trytes, 3, 14)
  console.log('Payout sent: ' + bundle[0].hash)
}

async function getBalances(addresses) {
  let balanceResponse = await iota.getBalances(addresses, 100)
  return balanceResponse.balances
}

function generateAddresses(start_index, end_index) {
  let addresses = []
  for (let index = start_index; index < end_index + 1; index++) {
    addresses.push(iotaCore.generateAddress(SEED, index, 2, false))
  }
  return addresses
}
