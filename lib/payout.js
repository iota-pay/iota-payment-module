const {
  storeRawBundle,
  storeAddress,
  getKeyIndex,
  getPayoutIndex,
  getIndexesForPayouts,
  updateSpentAddress,
  getAddresses,
  getOpenPayouts,
  storePayout,
  updatePayout,
  setPayoutIndex,
  increaseKeyIndex,
  deleteIndexForPayouts
} = require('./Database')
const payoutHandler = require('./payoutHandler')
const eventHandler = require('./eventHandler')
const iota = require('./iota')

const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')
const converter = require('@iota/converter')
const txconverter = require('@iota/transaction-converter')
const validators = require('@iota/validators')
const bent = require('bent')
const config = require('./config.js')

const SEED = config.seed

//custom start- and endIndex is optional
function sendPayoutBundle(payout) {
  return new Promise(async function(resolve, reject) {
    try {
      let {
        address,
        value = 0,
        message = '',
        tag = '',
        startIndex = await getPayoutIndex(),
        endIndex = await getKeyIndex(),
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
      let remainderAddressIndexes = []

      //send message if no value is needed
      if (value == 0) {
        transfers[0] = {
          address,
          value,
          message,
          tag
        }
        let trytes = await iota.prepareTransfers(SEED, transfers)
        let bundle = await iota.sendTrytes(trytes, 3, config.mwm)
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
      }
      totalBalance = balances.reduce((a, b) => {
        return a + b
      })

      //check if an internal transfer is necessary; *2 because of the signature tx; -2 or -1 because of the outputs (2 with remainder)
      if (
        (totalBalance > value &&
          addressesWithBalanceAndIndex.length * 2 > config.maxBundleSize - 2) ||
        (totalBalance == value &&
          addressesWithBalanceAndIndex.length * 2 > config.maxBundleSize - 1) ||
        (totalBalance < value &&
          addressesWithBalanceAndIndex.length > config.maxBundleSize - 2)
      ) {
        //create internalTransfer
        newAddressIndex = await increaseKeyIndex()
        let internalTransferAddress = iotaCore.generateAddress(
          SEED,
          newAddressIndex,
          2,
          true
        )
        await storeAddress({
          address: internalTransferAddress,
          index: newAddressIndex
        })

        //create outputs
        transfers[0] = {
          address: internalTransferAddress,
          tag: 'INTERNALTRANSFER'
        }

        let internalTransferValue = 0
        //create inputs with maxBundleSize/2 to be in the limit
        for (let [index, object] of addressesWithBalanceAndIndex.entries()) {
          if (index >= config.maxBundleSize / 2 - 1) {
            break
          }
          inputOptions.inputs.push({
            address: object.address,
            keyIndex: object.index,
            balance: object.balance,
            security: 2
          })
          spentAddresses.push(object.address)
          internalTransferValue = internalTransferValue + object.balance
        }
        //update value
        transfers[0].value = internalTransferValue

        //create and send transactions
        let trytes = await iota.prepareTransfers(SEED, transfers, inputOptions)
        //store raw transactions
        let preparedBundle = trytes.map(e => txconverter.asTransactionObject(e))
        //add newAddressIndex so it get's added to the indexesForPayouts after confirmation
        let rawBundleObject = {
          bundleHash: preparedBundle[0].bundle,
          trytes: trytes,
          payouts: { info: 'internalTransfer' },
          remainderAddressIndexes: [newAddressIndex]
        }
        await storeRawBundle(rawBundleObject)

        //update payoutIndex
        if (
          inputOptions.inputs[inputOptions.inputs.length - 1].keyIndex <
          startIndex
        ) {
          setPayoutIndex(startIndex)
        } else {
          //+1 because otherwise the latest address will be the start next time
          setPayoutIndex(
            inputOptions.inputs[inputOptions.inputs.length - 1].keyIndex + 1
          )
        }
        //update indexesForPayouts
        let addressIndexesForPayouts = await getIndexesForPayouts()
        let usedIndexes = inputOptions.inputs.map(e => e.keyIndex)
        for (index of addressIndexesForPayouts) {
          if (usedIndexes.indexOf(index) != -1) {
            await deleteIndexForPayouts(index)
          }
        }

        //update spentAddresses
        for (address of spentAddresses) {
          await updateSpentAddress(address)
        }

        //use latest ms as tip
        let nodeInfo = await iota.getNodeInfo()
        let attachedTrytes = await iota.attachToTangle(
          nodeInfo.latestMilestone,
          nodeInfo.latestMilestone,
          config.mwm,
          trytes
        )
        await iota.storeAndBroadcast(attachedTrytes)
        let tailtx = txconverter.asTransactionObject(attachedTrytes[0])

        if (config.debug === 'basic' || config.debug === 'full') {
          console.log(
            `InternalTransfer sent: ${config.explorerTxLink}${tailtx.hash}`
          )
          console.log('Return from payout because of internalTransfer')
        }
        return resolve('internalTransfer')
      }

      //check after internal transfers so
      if (totalBalance < value) {
        throw 'Not enough iotas found for payout'
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
        let openPayouts = await getOpenPayouts()
        let sortedOpenPayouts = openPayouts.sort((a, b) => a.value - b.value)
        let additionalPayouts = []
        for (openPayout of openPayouts) {
          //get amount of open payouts
          let lengthOpenPayouts = openPayouts.length - additionalPayouts.length
          //break with one transfer less to add a second remainder
          if (sortedOpenPayouts.length > 2)
            if (
              lengthOpenPayouts > config.maxBundleSize - 2 &&
              addressesWithBalanceAndIndex.length * 2 +
                additionalPayouts.length +
                3 >=
                config.maxBundleSize &&
              //check if it makes sense to split the funds even more, has to be > than the third lowest value, /2 because of two remainder addresses
              (totalBalance - value) / 2 > sortedOpenPayouts[2].value
            ) {
              if (config.debug === 'basic' || config.debug === 'full') {
                console.log(
                  'Max Bundlesize -2(2 remainder addresses) reached:',
                  addressesWithBalanceAndIndex.length * 2 +
                    additionalPayouts.length +
                    2
                )
              }
              break
            }
          //check if maxBundleSize is reached
          if (
            addressesWithBalanceAndIndex.length * 2 +
              additionalPayouts.length +
              2 >=
            config.maxBundleSize
          ) {
            if (config.debug === 'basic' || config.debug === 'full') {
              console.log(
                'Max Bundlesize -1 (remainder) reached:',
                addressesWithBalanceAndIndex.length * 2 +
                  additionalPayouts.length +
                  2
              )
            }
            break
          }

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
          //get amount of open payouts
          let lengthOpenPayouts = openPayouts.length - transfers.length
          if (config.debug === 'basic' || config.debug === 'full') {
            console.log('lengthOpenPayouts:', lengthOpenPayouts)
          }
          if (
            addressesWithBalanceAndIndex.length * 2 + transfers.length + 2 <=
              config.maxBundleSize &&
            lengthOpenPayouts > config.maxBundleSize - 2 &&
            //check if it makes sense to split the funds even more, has to be > than the third lowest value, /2 because of two remainder addresses
            (totalBalance - value) / 2 > sortedOpenPayouts[2].value
          ) {
            if (config.debug === 'basic' || config.debug === 'full') {
              console.log('Add two remainder addresses')
            }
            let remainderValueOne = Math.ceil((totalBalance - value) / 2)
            let remainderValueTwo = Math.floor((totalBalance - value) / 2)
            //add first remainder address
            let remainderAddressIndexOne = await increaseKeyIndex()
            remainderAddressIndexes.push(remainderAddressIndexOne)
            let remainderAddressOne = iotaCore.generateAddress(
              SEED,
              remainderAddressIndexOne,
              2,
              true
            )
            transfers.push({
              address: remainderAddressOne,
              value: remainderValueOne,
              tag: 'REMAINDER'
            })
            await storeAddress({
              address: remainderAddressOne,
              index: remainderAddressIndexOne
            })
            //add second remainder address
            let remainderAddressIndexTwo = await increaseKeyIndex()
            remainderAddressIndexes.push(remainderAddressIndexTwo)
            let remainderAddressTwo = iotaCore.generateAddress(
              SEED,
              remainderAddressIndexTwo,
              2,
              true
            )
            transfers.push({
              address: remainderAddressTwo,
              value: remainderValueTwo,
              tag: 'REMAINDER'
            })
            await storeAddress({
              address: remainderAddressTwo,
              index: remainderAddressIndexTwo
            })
          } else {
            //add single remainder address
            let remainderAddressIndex = await increaseKeyIndex()
            remainderAddressIndexes.push(remainderAddressIndex)
            let remainderAddress = iotaCore.generateAddress(
              SEED,
              remainderAddressIndex,
              2,
              true
            )
            transfers.push({
              address: remainderAddress,
              value: totalBalance - value,
              tag: 'REMAINDER'
            })
            await storeAddress({
              address: remainderAddress,
              index: remainderAddressIndex
            })
          }
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
      //store raw transactions
      let preparedBundle = trytes.map(e => txconverter.asTransactionObject(e))
      let rawBundleObject = {
        bundleHash: preparedBundle[0].bundle,
        trytes: trytes,
        payouts: payoutInfo,
        remainderAddressIndexes
      }
      await storeRawBundle(rawBundleObject)

      //if the function crashes after the raw txs are store and the payouts aren't updated they will get payed but not updated
      payoutInfo.forEach(e => (e.txhash = preparedBundle[0].bundle))
      for (payoutdata of payoutInfo) {
        await updatePayout(
          { id: payoutdata.id },
          { txhash: payoutdata.txhash, payed: 'pending' }
        )
      }

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
      let addressIndexesForPayouts = await getIndexesForPayouts()
      let usedIndexes = addressesWithBalanceAndIndex.map(e => e.index)
      for (index of addressIndexesForPayouts) {
        if (usedIndexes.indexOf(index) != -1) {
          await deleteIndexForPayouts(index)
        }
      }

      //update spentAddresses
      for (address of spentAddresses) {
        await updateSpentAddress(address)
      }

      //use latest ms as tip
      let nodeInfo = await iota.getNodeInfo()
      let attachedTrytes = await iota.attachToTangle(
        nodeInfo.latestMilestone,
        nodeInfo.latestMilestone,
        config.mwm,
        trytes
      )
      await iota.storeAndBroadcast(attachedTrytes)
      let bundle = attachedTrytes.map(e => txconverter.asTransactionObject(e))

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
 * paymentModule.sendPayout(payoutObject)
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
function sendPayout(payoutData) {
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

      if (payout.value > 0 && config.wereAddressSpentCheck != false) {
        let spent = await wereAddressSpentFrom(payout.address)
        if (spent == true) {
          throw 'Already spent from address, pls provide an unused one'
        }
      }

      payout.payed = false
      payout.id = Date.now().toString()

      await storePayout(payout)
      delete payout._id

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
 * paymentModule.getPayouts()
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

/**
 * Returns open payouts
 * @returns {Object[]} open payouts
 * @example
 * // get open payouts
 * paymentModule.getOpenPayouts()
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

/**
 * Returns payout by id
 * @returns {Object} payment
 * @example
 * // get payout by id
 * paymentModule.getPayoutByID('1570611186704')
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
// function getPayoutByID(id) {
//   return new Promise(async function(resolve, reject) {
//     const Payout = await getPayout({ id: id })
//     resolve(Payout)
//   })
// }

/**
 * Returns payout by txhash
 * @returns {Object} payment
 * @example
 * // get payout by txhash
 * paymentModule.getPayoutByTxhash('XKLLL9B9AUN9EASCAQAQHEYDLLEUDDUCOTJVNTJUSZVTNWUTDPHZUFUJAHFZJOSQYYEPJSWRDXDJ99999')
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
// function getPayoutByTxhash(txhash) {
//   return new Promise(async function(resolve, reject) {
//     const Payout = await getPayout({ txhash: txhash })
//     resolve(Payout)
//   })
// }

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
      if (typeof tag != 'undefined' && tag != '') {
        payout.data = data
      }
      resolve(payout)
    } catch (err) {
      reject(err)
    }
  })
}

async function searchInputAdresses(value, startIndex, endIndex) {
  let unusedAddresses = []
  // let unusedAddressesTwo = []
  //push addresses with iotas, that aren't in the indexrange
  let addressIndexesForPayouts = await getIndexesForPayouts()
  let originalAllAddressesDb = await getAddresses()
  //create a copy, because otherwise the balance is added to the json file
  let allAddressesDb = JSON.parse(JSON.stringify(originalAllAddressesDb))

  for (index of addressIndexesForPayouts) {
    //check if out of range, otherwise it could be added two times as input
    if (index < startIndex) {
      let addressObject = allAddressesDb.filter(a => a.index == index)[0]
      if (addressObject.spent != true) {
        unusedAddresses.push(addressObject)
        // unusedAddressesTwo.push(addressObject)
      } else {
        await deleteIndexForPayouts(index)
      }
    }
  }

  for (object of allAddressesDb) {
    if (object.index >= startIndex && object.index <= endIndex) {
      //could be removed to allow key reuse
      if (object.spent != true) {
        unusedAddresses.push(object)
      }
    }
  }
  if (unusedAddresses.length == 0) {
    throw 'No input addresses found for payout'
  }
  let addresses = unusedAddresses.map(obj => obj.address)
  let balances = await getAddressBalances(addresses)
  let result = []
  let collectedBalance = 0
  for (let [index, balance] of balances.entries()) {
    if (balance > 0) {
      collectedBalance = collectedBalance + balance
      unusedAddresses[index].balance = balance
      result.push(unusedAddresses[index])
    }
    //delete empty indexesForPayouts
    if (balance == 0) {
      if (
        addressIndexesForPayouts.indexOf(unusedAddresses[index].index) != -1
      ) {
        await deleteIndexForPayouts(unusedAddresses[index].index)
      }
    }
    if (collectedBalance >= value) {
      break
    }
  }
  return result
}

function wereAddressSpentFrom(address) {
  return new Promise(async (resolve, reject) => {
    try {
      const post = bent(config.iotaNodes[0], 'POST', 'json', { 'X-IOTA-API-Version': '1' });
      const response = await post('', {
        "command": "wereAddressesSpentFrom",
        "addresses": [address.slice(0,81)]
      });
      resolve(response)
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  sendPayoutBundle,
  sendPayout,
  payoutValidator
}
