module.exports = {
  sendPayout,
  send,
  getPayouts,
  updatePayout,
  getOpenpayouts,
  getPayoutByID,
  getPayoutByTxhash,
  payoutChecker
}

const db = require('./Database')
const payoutHandler = require('./payoutHandler')

const {
  getCurrentIndex,
  getNextIndex,
  getCurrentPayoutIndex,
  setPayoutIndex
} = require('./Account')
const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')
const converter = require('@iota/converter')
const validators = require('@iota/validators')

const SEED = process.env.SEED
const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

//custom start- and endIndex is optional
//use 'allIotas' for the value, if you want to send all, otherwise use an integer
function sendPayout(payout) {
  return new Promise(async function(resolve, reject) {
    try {
      let {
        address,
        value = 0,
        message = '',
        tag = '',
        startIndex = await getCurrentPayoutIndex(),
        endIndex = await getCurrentIndex()
      } = payout
      if (startIndex > endIndex) {
        endIndex = startIndex
      }
      // console.log('startIndex ' + startIndex)
      // console.log('endIndex ' + endIndex)

      //declare arrays
      let transfers = []
      let inputOptions = {
        inputs: []
      }

      let addressesWithBalanceAndIndex = await searchInputAdresses(
        value,
        startIndex,
        endIndex
      )

      let balances = addressesWithBalanceAndIndex.map(e => e.balance)
      let totalBalance
      if (addressesWithBalanceAndIndex.length == 0) {
        totalBalance = 0
      } else {
        totalBalance = balances.reduce((a, b) => {
          return a + b
        })
      }

      if (totalBalance <= 0) {
        throw 'No iotas found'
      }

      //allow to payout all available iotas
      if (value == 'allIotas') {
        value = totalBalance
      }

      if (!validators.isTrytes(message)) {
        message = converter.asciiToTrytes(message)
      }

      //create outputs
      transfers[0] = {
        address,
        value,
        message,
        tag
      }

      if (value < totalBalance) {
        transfers.push({
          address: iotaCore.generateAddress(SEED, await getNextIndex(), 2),
          value: totalBalance - value
        })
      }

      //create inputs
      for (let k = 0; k < addressesWithBalanceAndIndex.length; k++) {
        if (addressesWithBalanceAndIndex[k].balance > 0) {
          inputOptions.inputs.push({
            address: addressesWithBalanceAndIndex[k].address,
            keyIndex: addressesWithBalanceAndIndex[k].index,
            balance: addressesWithBalanceAndIndex[k].balance,
            security: 2
          })
        }
      }

      //create and send transactions
      let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
      let bundle = await iota.sendTrytes(trytes, 3, 14)

      //update payoutIndex
      if (
        addressesWithBalanceAndIndex[addressesWithBalanceAndIndex.length - 1]
          .index < startIndex
      ) {
        setPayoutIndex(startIndex)
        //clear indexesForPayouts
        db.set('indexesForPayouts', []).write()
      } else {
        //+1 because otherwise the latest address will be the start next time
        setPayoutIndex(
          addressesWithBalanceAndIndex[addressesWithBalanceAndIndex.length - 1]
            .index + 1
        )
        //clear indexesForPayouts
        db.set('indexesForPayouts', []).write()
      }

      resolve({
        message: 'Payout successfully sent',
        txhash: bundle[0].hash
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
    addresses.push({
      address: iotaCore.generateAddress(SEED, index, 2, false),
      index: index
    })
  }
  return addresses
}

//create payout
function send(payoutData) {
  return new Promise(async function(resolve, reject) {
    try {
      let payout = ({
        address,
        value,
        message,
        tag,
        startIndex,
        endIndex
      } = await payoutChecker(payoutData))

      payout.payed = false
      payout.id = Date.now().toString()

      db.get('payouts')
        .push(payout)
        .write()
      payoutHandler.start()
      resolve(payout)
    } catch (err) {
      reject(err)
    }
  })
}

function getPayouts() {
  return new Promise(function(resolve, reject) {
    resolve(db.get('payouts').value())
  })
}

function updatePayout(payout) {
  return new Promise(function(resolve, reject) {
    let updated_payout = db
      .get('payouts')
      .find({ id: payout.id })
      .assign({ txhash: payout.txhash, payed: true })
      .write()
    resolve(updated_payout)
  })
}

function getOpenpayouts() {
  return new Promise(function(resolve, reject) {
    resolve(
      db
        .get('payouts')
        .filter({ payed: false })
        .value()
    )
  })
}

function getPayoutByID(id) {
  return new Promise(function(resolve, reject) {
    const Payout = db
      .get('payouts')
      .find({ id: id })
      .value()
    resolve(Payout)
  })
}

function getPayoutByTxhash(txhash) {
  return new Promise(function(resolve, reject) {
    const Payout = db
      .get('payouts')
      .find({ txhash: txhash })
      .value()
    resolve(Payout)
  })
}

function payoutChecker({
  address,
  value,
  message,
  tag,
  startIndex,
  endIndex
} = {}) {
  return new Promise(async function(resolve, reject) {
    try {
      let payout = {}
      // check provided input

      try {
        if (checksum.isValidChecksum(address)) {
          payout.address = address
        } else {
          throw 'Invalid address'
        }
      } catch (err) {
        throw 'Invalid address'
      }

      if ((value != 'allIotas' && !Number.isInteger(value)) || value <= 0) {
        throw 'Invalid iota value'
      }
      payout.value = value

      if (typeof startIndex != 'undefined') {
        payout.startIndex = startIndex
        if (!Number.isInteger(payout.startIndex)) {
          throw 'Invalid startIndex'
        }
      }

      if (typeof endIndex != 'undefined') {
        payout.endIndex = endIndex
        if (!Number.isInteger(payout.endIndex)) {
          throw 'Invalid endIndex'
        }
      }

      if (typeof message != 'undefined' && message != '') {
        payout.message = message
      }

      if (typeof tag != 'undefined' && tag != '') {
        if (!validators.isTrytes(tag) || tag.length > 27) {
          throw 'Invalid tag'
        } else {
          payout.tag = tag
        }
      }
      resolve(payout)
    } catch (err) {
      reject(err)
    }
  })
}

async function searchInputAdresses(value, startIndex, endIndex) {
  let addressesWithBalanceAndIndex = []

  //push addresses with iotas, that aren't in the indexrange
  let addressIndexesForPayouts = db.get('indexesForPayouts').value()
  if (addressIndexesForPayouts.length != 0) {
    let indexesForPayouts = addressIndexesForPayouts.filter(
      index => index < startIndex
    )
    indexesForPayouts.forEach(i => {
      addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.concat(
        generateAddresses(i, i)
      )
    })
    let addressesForBalances = addressesWithBalanceAndIndex.map(e => e.address)
    let balances = await getBalances(addressesForBalances)
    balances.forEach((balance, j) => {
      addressesWithBalanceAndIndex[j].balance = balance
    })
    let totalBalance = balances.reduce((a, b) => {
      return a + b
    })
    if (totalBalance >= value) {
      return addressesWithBalanceAndIndex
    }
  }

  if (startIndex == endIndex) {
    let singleAddress = generateAddresses(startIndex, startIndex)
    let singleBalance = await getBalances([singleAddress[0].address])
    singleAddress[0].balance = singleBalance[0]
    addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.concat(
      singleAddress
    )
  }

  //generate addresses gradually until enough iotas are found
  let i = startIndex
  let addressesAtOnce = 4
  loop1: for (i; i < endIndex; i = i + addressesAtOnce) {
    //check if enough iotas found
    let totalIotas = 0
    loop2: for (
      let count = 0;
      count < addressesWithBalanceAndIndex.length;
      count++
    ) {
      totalIotas += addressesWithBalanceAndIndex[count].balance
      //exit loop if enough iotas are found
      if (totalIotas >= value) {
        //remove only addresses with index above start, because the others will be cleared later
        if (addressesWithBalanceAndIndex[count].index >= startIndex) {
          addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.slice(
            0,
            count
          )
        }
        break loop1
      }
    }

    //set indexes for multiple addressgeneration
    let lastIndex = i + addressesAtOnce - 1
    if (endIndex - i <= addressesAtOnce) {
      lastIndex = endIndex
    }
    let threeAddressObjects = generateAddresses(i, lastIndex)
    let threeAddresses = threeAddressObjects.map(e => e.address)
    let balances = await getBalances(threeAddresses)
    balances.forEach((balance, index) => {
      threeAddressObjects[index].balance = balance
    })
    addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.concat(
      threeAddressObjects
    )
  }

  return addressesWithBalanceAndIndex
}
