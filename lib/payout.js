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
const txconverter = require('@iota/transaction-converter')
const validators = require('@iota/validators')
const request = require('request')
const iota = require('./iota')

const SEED = process.env.SEED

//custom start- and endIndex is optional
function sendPayout(payout) {
  return new Promise(async function(resolve, reject) {
    try {
      let {
        address,
        value = 0,
        message = '',
        tag = '',
        startIndex = await getCurrentPayoutIndex(),
        endIndex = await getCurrentIndex(),
        id
      } = payout

      message = converter.asciiToTrytes(message)

      //declare arrays
      let transfers = []
      let inputOptions = {
        inputs: []
      }
      let spentAddresses = []
      let payoutInfo = [{ id, address, value }]

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
        payoutInfo[0].txhash = bundle[0].hash
        return resolve({
          message: 'Payout successfully sent',
          txhash: bundle[0].hash,
          payouts: payoutInfo
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
        throw 'No iotas found for payout'
      } else {
        totalBalance = balances.reduce((a, b) => {
          return a + b
        })
        if (totalBalance < value) {
          throw 'Not enough iotas found for payout'
        }
      }

      //create outputs
      transfers[0] = {
        address,
        value,
        message,
        tag
      }

      if (value < totalBalance) {
        //search and add additional payouts without searching for new inputs
        let openPayouts = await getOpenpayouts()
        let additionalPayouts = []
        for (openPayout of openPayouts) {
          if (openPayout.id != id) {
            if (value + openPayout.value <= totalBalance) {
              value += openPayout.value
              additionalPayouts.push(openPayout)
            }
          }
        }
        for (additionalPayout of additionalPayouts) {
          let additionalMessage = converter.asciiToTrytes(
            additionalPayout.message || ''
          )
          let payoutObject = {
            address: additionalPayout.address,
            value: additionalPayout.value,
            message: additionalMessage || '',
            tag: additionalPayout.tag || ''
          }
          payoutInfo.push({
            id: additionalPayout.id,
            address: additionalPayout.address,
            value: additionalPayout.value
          })
          transfers.push(payoutObject)
        }
        //check again because it could changed
        if (value < totalBalance) {
          //add remainder address
          let addressIndex = await getNextIndex()
          let remainderAddress = iotaCore.generateAddress(
            SEED,
            addressIndex,
            2,
            true
          )
          transfers.push({
            address: remainderAddress,
            value: totalBalance - value
          })
          db.get('addresses')
            .push({ address: remainderAddress, index: addressIndex })
            .write()
        }
      }

      //create inputs
      for (let object of addressesWithBalanceAndIndex) {
        inputOptions.inputs.push({
          address: object.address,
          keyIndex: object.index,
          balance: object.balance,
          security: 2
        })
        spentAddresses.push(object.address)
      }

      //create and send transactions
      let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
      //use latest ms as tip
      let nodeInfo = await iota.getNodeInfo()
      let attachedTrytes = await iota.attachToTangle(
        nodeInfo.latestMilestone,
        nodeInfo.latestMilestone,
        14,
        trytes
      )
      await iota.storeAndBroadcast(attachedTrytes)
      let bundle = attachedTrytes.map(e => txconverter.asTransactionObject(e))
      // let bundle = await iota.sendTrytes(trytes, 3, 14)

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

      //update spentAddresses
      for (address of spentAddresses) {
        db.get('addresses')
          .find({ address: address })
          .assign({ spent: true })
          .write()
      }

      //add txhash for each payout
      bundle
        .slice()
        .reverse()
        .forEach(tx => {
          let index = payoutInfo.findIndex(
            e => e.address.slice(0, 81) == tx.address && e.value == tx.value
          )
          if (index >= 0) {
            payoutInfo[index].txhash = tx.hash
          }
        })

      resolve({
        message: 'Payout successfully sent',
        txhash: bundle[0].hash,
        payouts: payoutInfo
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

/**
 * Creates and returns a payout.
 * @param {object} payoutData - data for the payout
 * @param {address} payoutData.address - 90 trytes iota address (with checksum)
 * @param {number} payoutData.amount - amount of iotas
 * @param {string} [payoutData.message] - message which will be send with the transaction
 * @param {string} [payoutData.tag] - tryte tag
 * @param {any} [payoutData.data] - additional data, is only stored locally
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
 *   data: {test: 27},
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
 * data: {test: 27},
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
        data,
        startIndex,
        endIndex
      } = await payoutValidator(payoutData))

      if (payout.value > 0) {
        let spent = await wereAddressSpentFrom(
          payout.address,
          process.env.IOTANODE
        )
        if (spent == true) {
          throw 'Already spent from address, pls provide an unused one'
        }
      }

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
  data,
  startIndex,
  endIndex
} = {}) {
  return new Promise(async function(resolve, reject) {
    try {
      let payout = {}
      // check provided input

      if (!Number.isInteger(parseInt(value)) || value < 0) {
        throw 'Invalid iota value'
      }
      payout.value = parseInt(value)

      //doesn't work that way without the additional try catch
      try {
        if (checksum.isValidChecksum(address)) {
        } else {
          throw 'Invalid address'
        }
      } catch (e) {
        throw 'Invalid address'
      }

      //check last trit for Kerl address if value transfer
      if (
        (payout.value > 0 && !/[E-V]/.test(address.slice(80, 81))) ||
        payout.value == 0
      ) {
        payout.address = address
      } else {
        throw 'Invalid address'
      }

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
      payout.data = data
      resolve(payout)
    } catch (err) {
      reject(err)
    }
  })
}

async function searchInputAdresses(value, startIndex, endIndex) {
  let unusedAddresses = []
  let unusedAddressesTwo = []
  //push addresses with iotas, that aren't in the indexrange
  let addressIndexesForPayouts = db.get('indexesForPayouts').value()
  addressIndexesForPayouts.forEach(index => {
    let addressObject = db
      .get('addresses')
      .find({ index: index })
      .value()
    if (addressObject.spent != true) {
      unusedAddresses.push(addressObject)
      unusedAddressesTwo.push(addressObject)
    }
  })

  let dba = db.get('addresses').value()
  let addressObjects = dba.map(e => e)
  for (object of addressObjects) {
    if (object.index >= startIndex && object.index <= endIndex) {
      if (object.spent != true) {
        unusedAddresses.push(object)
      }
    }
  }
  let addresses = unusedAddresses.map(payment => payment.address)
  let balances = await getAddressBalances(addresses)
  let result = []
  let collectedBalance = 0
  for (let [index, balance] of balances.entries()) {
    if (balance > 0) {
      collectedBalance = collectedBalance + balance
      // unusedAddresses[index].balance = balance  //<- adds balance to the json file
      unusedAddressesTwo[index] = {
        address: unusedAddresses[index].address,
        index: unusedAddresses[index].index,
        balance: balance
      }
      result.push(unusedAddressesTwo[index])
      // result.push(unusedAddresses[index])
    }
    if (collectedBalance >= value) {
      break
    }
  }
  return result
}

function wereAddressSpentFrom(address, provider) {
  return new Promise(async (resolve, reject) => {
    try {
      var command = {
        command: 'wereAddressesSpentFrom',
        addresses: [address.slice(0, 81)]
      }

      var options = {
        url: provider,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-IOTA-API-Version': '1',
          'Content-Length': Buffer.byteLength(JSON.stringify(command))
        },
        json: command
      }

      request(options, function(error, response, data) {
        if (!error && response.statusCode == 200) {
          resolve(data.states[0])
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
