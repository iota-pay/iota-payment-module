module.exports = {
  sendPayout,
  send,
  getPayouts,
  updatePayout,
  getOpenpayouts,
  getPayoutByID,
  getPayoutByTxhash,
  payoutValidator
}

const db = require('./Database')
const payoutHandler = require('./payoutHandler')
const eventHandler = require('./eventHandler')

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

      if (!validators.isTrytes(message)) {
        message = converter.asciiToTrytes(message)
      }

      //declare arrays
      let transfers = []
      let inputOptions = {
        inputs: []
      }

      //send message if no value is needed
      if (value == 0) {
        transfers[0] = {
          address,
          value,
          message,
          tag
        }
        let trytes = await iota.prepareTransfers(SEED, transfers)
        let bundle = await iota.sendTrytes(trytes, 3, 14)
        resolve({
          message: 'Payout successfully sent',
          txhash: bundle[0].hash
        })
      }

      if (startIndex > endIndex) {
        endIndex = startIndex
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
        throw 'No iotas found for payout'
      }

      //allow to payout all available iotas
      if (value == 'allIotas') {
        value = totalBalance
      }

      //create outputs
      transfers[0] = {
        address,
        value,
        message,
        tag
      }

      if (value < totalBalance) {
        let addressIndex = await getNextIndex()
        let remainderAddress = iotaCore.generateAddress(SEED, addressIndex, 2)
        transfers.push({
          address: remainderAddress,
          value: totalBalance - value
        })
        db.get('remainderAddresses')
          .push({ address: remainderAddress, index: addressIndex })
          .write()
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
      } else {
        //+1 because otherwise the latest address will be the start next time
        setPayoutIndex(
          addressesWithBalanceAndIndex[addressesWithBalanceAndIndex.length - 1]
            .index + 1
        )
      }
      //update indexesForPayouts
      let addressIndexesForPayouts = db.get('indexesForPayouts').value()
      let newAddressIndexesForPayouts = []
      let usedIndexes = addressesWithBalanceAndIndex.map(e => e.index)
      addressIndexesForPayouts.forEach(index => {
        if (usedIndexes.indexOf(index) == -1) {
          newAddressIndexesForPayouts.push(index)
        }
      })
      db.set('indexesForPayouts', newAddressIndexesForPayouts).write()

      resolve({
        message: 'Payout successfully sent',
        txhash: bundle[0].hash
      })
    } catch (err) {
      reject(err)
    }
  })
}

async function getAddressBalances(addresses) {
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

/**
 * Creates and returns a payout.
 * @param {object} payoutData - data for the payout
 * @param {address} payoutData.address - 90 trytes iota address (with checksum)
 * @param {number} payoutData.amount - amount of iotas
 * @param {string} [payoutData.message] - message which will be send with the transaction
 * @param {string} [payoutData.tag] - tryte tag
 * @param {number} [payoutData.startIndex] - custom start index to search for inputaddresses
 * @param {number} [payoutData.endIndex] - custom end index to search for inputaddresses
 * @returns {object} payout
 * @example
 * // create a payout
 * let payoutObject = {
 *   //required
 *   address: 'HW99PKRDWBUCCWLEQDONQXW9AXQHZAABYEKWSEFYAUIQWWCLVHAUJEQAZJACAGPZBZSQJIOUXRYYEXWZCXXOAJMZVY',
 *   value: 1,
 *   //optional
 *   message: 'Example message',
 *   tag: 'TRYTETAG',
 *   //indexes for input addresses, only required in special cases
 *   // startIndex: 0,
 *   // endIndex: 1
 * }
 * paymentModule.payout.send(payoutObject)
 *  .then(payout => {
 *    console.log(payout)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payout:
 * { address:
 *  'HW99PKRDWBUCCWLEQDONQXW9AXQHZAABYEKWSEFYAUIQWWCLVHAUJEQAZJACAGPZBZSQJIOUXRYYEXWZCXXOAJMZVY',
 * value: 1,
 * message: 'Example message',
 * tag: 'TRYTETAG',
 * payed: false,
 * id: '1570619992125' }
 */
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
      } = await payoutValidator(payoutData))

      payout.payed = false
      payout.id = Date.now().toString()

      db.get('payouts')
        .push(payout)
        .write()
      let eventMessage = {
        type: 'payout',
        status: 'payoutCreated',
        payout: payout
      }
      eventHandler.emit(eventMessage)
      payoutHandler.start()
      resolve(payout)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Returns all payouts
 * @returns {Object[]} payouts
 * @example
 * // get payouts
 * paymentModule.payout.getPayouts()
 *  .then(payouts => {
 *    console.log(payouts)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payouts:
 * [
 *  {
 *    "address": "USKSGFKPWVXD9EUOJXWNLVWG9FDTIPGBUYB9BQNMMUWIEOMFNDCCUKCJMEPRICBHZNRAIZFGNPK9GCGBYQAEWNJRMC",
 *    "value": 1,
 *    "message": "Example message",
 *    "payed": true,
 *    "id": "1570616325073",
 *    "txhash": "XKLLL9B9AUN9EASCAQAQHEYDLLEUDDUCOTJVNTJUSZVTNWUTDPHZUFUJAHFZJOSQYYEPJSWRDXDJ99999"
 *  },
 *  {
 *    "address": "HW99PKRDWBUCCWLEQDONQXW9AXQHZAABYEKWSEFYAUIQWWCLVHAUJEQAZJACAGPZBZSQJIOUXRYYEXWZCXXOAJMZVY",
 *    "value": 1,
 *    "message": "Example message",
 *    "payed": false,
 *    "id": "1570616561382"
 *  }
 * ]
 */
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

/**
 * Returns open payouts
 * @returns {Object[]} open payouts
 * @example
 * // get open payouts
 * paymentModule.payout.getOpenpayouts()
 *  .then(payouts => {
 *    console.log(payouts)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payouts:
 * [
 *  {
 *    "address": "HW99PKRDWBUCCWLEQDONQXW9AXQHZAABYEKWSEFYAUIQWWCLVHAUJEQAZJACAGPZBZSQJIOUXRYYEXWZCXXOAJMZVY",
 *    "value": 1,
 *    "message": "Example message",
 *    "payed": false,
 *    "id": "1570616561382"
 *  }
 * ]
 */
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

/**
 * Returns payout by id
 * @returns {Object} payment
 * @example
 * // get payout by id
 * paymentModule.payout.getPayoutByID('1570611186704')
 *  .then(payout => {
 *    console.log(payout)
 *  })
 *  .catch(err => {
 *    console.log(err)
 *  })
 * //example payout:
 * { address:
 *  'USKSGFKPWVXD9EUOJXWNLVWG9FDTIPGBUYB9BQNMMUWIEOMFNDCCUKCJMEPRICBHZNRAIZFGNPK9GCGBYQAEWNJRMC',
 * value: 1,
 * message: 'Example message',
 * payed: false,
 * id: '1570611186704' }
 */
function getPayoutByID(id) {
  return new Promise(function(resolve, reject) {
    const Payout = db
      .get('payouts')
      .find({ id: id })
      .value()
    resolve(Payout)
  })
}

/**
 * Returns payout by txhash
 * @returns {Object} payment
 * @example
 * // get payout by txhash
 * paymentModule.payout.getPayoutByTxhash('XKLLL9B9AUN9EASCAQAQHEYDLLEUDDUCOTJVNTJUSZVTNWUTDPHZUFUJAHFZJOSQYYEPJSWRDXDJ99999')
 *  .then(payout => {
 *   console.log(payout)
 *  })
 *  .catch(err => {
 *     console.log(err)
 *   })
 * //example payout:
 * { address:
 *  'USKSGFKPWVXD9EUOJXWNLVWG9FDTIPGBUYB9BQNMMUWIEOMFNDCCUKCJMEPRICBHZNRAIZFGNPK9GCGBYQAEWNJRMC',
 * value: 1,
 * message: 'Example message',
 * payed: true,
 * id: '1570616325073',
 * txhash:
 *  'XKLLL9B9AUN9EASCAQAQHEYDLLEUDDUCOTJVNTJUSZVTNWUTDPHZUFUJAHFZJOSQYYEPJSWRDXDJ99999' }
 */
function getPayoutByTxhash(txhash) {
  return new Promise(function(resolve, reject) {
    const Payout = db
      .get('payouts')
      .find({ txhash: txhash })
      .value()
    resolve(Payout)
  })
}

function payoutValidator({
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

      if (
        (value != 'allIotas' && !Number.isInteger(parseInt(value))) ||
        value < 0
      ) {
        throw 'Invalid iota value'
      }
      payout.value = parseInt(value)

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
    let balances = await getAddressBalances(addressesForBalances)
    let balanceTogether = 0
    balances.forEach((balance, j) => {
      addressesWithBalanceAndIndex[j].balance = balance
      //return early if enough iotas found
      balanceTogether += balance
      if (balanceTogether >= value) {
        addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.slice(
          0,
          j + 1
        )
        return addressesWithBalanceAndIndex
      }
    })
  }

  if (startIndex == endIndex) {
    let singleAddress = generateAddresses(startIndex, startIndex)
    let singleBalance = await getAddressBalances([singleAddress[0].address])
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
            count + 1
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
    let balances = await getAddressBalances(threeAddresses)
    balances.forEach((balance, index) => {
      threeAddressObjects[index].balance = balance
    })
    addressesWithBalanceAndIndex = addressesWithBalanceAndIndex.concat(
      threeAddressObjects
    )
  }

  return addressesWithBalanceAndIndex
}
