module.exports = payout

const {
  getCurrentIndex,
  getNextIndex,
  getCurrentPayoutIndex,
  setPayoutIndex
} = require('./Account')
const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')

const SEED = process.env.SEED
const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

let transfers = [
  {
    address: '',
    value: 0
  }
]

let inputOptions = {
  inputs: []
}

//custom start- and endIndex is optional
//use 'allIotas' for the amount, if you want to send all, otherwise use an integer
//with the address only 0 and the latest index from the db is used
function payout(iotaAddress, amount, startIndex, endIndex) {
  return new Promise(async function(resolve, reject) {
    try {
      if (!checksum.isValidChecksum(iotaAddress)) {
        throw 'Invalid iotaAddress'
      }

      startIndex =
        typeof startIndex !== 'undefined'
          ? startIndex
          : await getCurrentPayoutIndex()
      endIndex =
        typeof endIndex !== 'undefined' ? endIndex : await getCurrentIndex()

      if (!Number.isInteger(startIndex)) {
        throw 'Invalid startIndex'
      }

      if (!Number.isInteger(endIndex)) {
        throw 'Invalid endIndex'
      }

      let addresses = []
      let balances = []
      if (amount == 'allIotas' || startIndex == endIndex) {
        addresses = generateAddresses(startIndex, endIndex)
        balances = await getBalances(addresses)
      } else {
        //generate addresses gradually until enough iotas are found
        let i = startIndex
        let addressesAtOnce = 4
        for (i; i < endIndex; i = i + addressesAtOnce) {
          let lastIndex = i + addressesAtOnce - 1
          if (endIndex - i <= addressesAtOnce) {
            lastIndex = endIndex
          }

          let threeAddresses = generateAddresses(i, lastIndex)
          addresses = addresses.concat(threeAddresses)
          let iotabalance = await getBalances(threeAddresses)
          balances = balances.concat(iotabalance)

          //exit loop if enough iotas are found
          if (
            balances.reduce((a, b) => {
              return a + b
            }) >= amount
          ) {
            //update endIndex to latest used address, is set after the transaction is sent
            endIndex = lastIndex
            break
          }
        }
      }

      let totalBalance = balances.reduce((a, b) => {
        return a + b
      })

      if (totalBalance <= 0) {
        throw 'No iotas found'
      }

      //allow to payout all available iotas
      if (amount == 'allIotas') {
        amount = totalBalance
      }

      if (amount <= 0 || !Number.isInteger(amount)) {
        throw 'Invalid iota amount'
      }

      //create outputs
      transfers[0].address = iotaAddress
      transfers[0].value = amount

      if (amount < totalBalance) {
        transfers.push({
          address: iotaCore.generateAddress(SEED, await getNextIndex(), 2),
          value: totalBalance - amount
        })
      }

      //create inputs
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

      //create and send transactions
      let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
      let bundle = await iota.sendTrytes(trytes, 3, 14)

      //update payout Index
      //+1 because otherwise the latest address will be the start
      setPayoutIndex(endIndex + 1)

function sendPayoutFromPaymentTo(payment, toAddress, value ) {
  console.log("sendPayoutFromTo")
  console.log("sendPayoutFromTo", payment)
  let fromAddress = payment.address
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
      let bundle = await iota.sendTrytes(trytes, 3, 14)

      if (payment.address_history == undefined) {
        payment.address_history = []
      }
      payment.address_history.push(payment.address)
      payment.address = new_address



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
