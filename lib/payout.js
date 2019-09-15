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
      let addresses = []
      let balances = []

      if (value == 'allIotas' || startIndex == endIndex) {
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
            }) >= value
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
    addresses.push(iotaCore.generateAddress(SEED, index, 2, false))
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
      payoutHandler.start() // TODO: check if alreay running and just start if not
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

      if ((value != 'allIotas' && value <= 0) || !Number.isInteger(value)) {
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
