module.exports = { sendPayout, sendPayoutFromPaymentTo}

const { getCurrentIndex, getNextIndex } = require('./Account')
const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')

const SEED = process.env.SEED
const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

let transfers = [
  {
    value: 0,
    address: ''
  }
]

let inputOptions = {
  inputs: []
}

//start- and endIndex is optional
//with the address only 0 and the latest index from the db is used
function sendPayout(iotaAddress, startIndex, endIndex) {
  return new Promise(async function(resolve, reject) {
    try {
      if (!checksum.isValidChecksum(iotaAddress)) {
        throw 'Invalid iotaAddress'
      }

      startIndex = typeof startIndex !== 'undefined' ? startIndex : 0
      endIndex =
        typeof endIndex !== 'undefined' ? endIndex : (await getCurrentIndex()) 

      let addresses = generateAddresses(startIndex, endIndex)
      let balances = await getBalances(addresses)

      let totalBalance = balances.reduce((a, b) => {
        return a + b
      })

      if (totalBalance <= 0) {
        throw 'No iotas found'
      }

      //create transfer
      transfers[0].address = iotaAddress
      transfers[0].value = totalBalance

      for (let k = 0; k < balances.length; k++) {
        if (balances[k] > 0) {
          inputOptions.inputs.push({
            address: addresses[k],
            keyIndex: k + startIndex,
            balance: balances[k],
            security: 2
          })
        }
      }

      let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
      let bundle = await iota.sendTrytes(trytes, 3, 14)
      resolve({
        message: 'Payout successfully sent',
        transaction_hash: bundle[0].hash
      })
    } catch (err) {
      reject(err)
    }
  })
}


function sendPayoutFromPaymentTo(pament, toAddress, value ) {
  console.log("sendPayoutFromTo")
  let fromAddress = pament.address
  console.log("fromAddress", fromAddress)
  console.log("toAddress", toAddress)
  console.log("value", value)
  return new Promise(async function (resolve, reject) {
    try {
      if (!checksum.isValidChecksum(fromAddress)) {
        console.log("Invalid fromAddress")
        //throw 'Invalid fromAddress'
      }
      if (!checksum.isValidChecksum(toAddress)) {
        console.log("Invalid fromAddress")

        throw 'Invalid toAddress'
      }
      if (value == undefined || value <= 0) {
        console.log("Invalid fromAddress")

        throw 'Invalid value.'
      }
      console.log("save")


      let keyIndex = await getCurrentIndex()

      let balances = await getBalances([fromAddress])
      let balance = balances[0]
      console.log("balance", balance)

      if (balances[0] < value) {
        throw 'No enough iotas'
      }

      let new_address = iotaCore.generateAddress(SEED, getNextIndex, 2)

      let transfers = [
        //payout
        {
          value: value,
          address: toAddress
        },
        //remaining iotas
        {
          value: balance - value,
          address: new_address
        }]
      let options = {
        'inputs': [{
          address: fromAddress,
          keyIndex: keyIndex,
          balance: balance,
          security: 2,
        }]
      }

      let trytes = await iota.prepareTransfers(SEED, transfers, options)
      let bundle = await iota.sendTrytes(trytes, 3, 9)

      if (pament.address_history == undefined) {
        pament.address_history = []
      }
      pament.address_history.push(pament.address)
      pament.address = new_address

      

      resolve({
        message: 'Payout successfully sent',
        transaction_hash: bundle[0].hash
      })
    } catch (err) {
      reject(err)
    }
  })
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
