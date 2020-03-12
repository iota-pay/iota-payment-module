module.exports = { startZmq, add_address_to_zmq }
const bundle_validator = require('@iota/bundle-validator')
const checksum = require('@iota/checksum')
const { get_payment, get_open_payments, update_payment } = require('./Database')
const eventHandler = require('./eventHandler')
const {
  checkPaymentsBalance,
  checkForTransactions
} = require('./paymentHandler')
const iota = require('./iota')

const zmq = require('zeromq')
const sock = zmq.socket('sub')

let addresses = []
let latestTxHash = ''
let latestSnTxHash = ''
function add_address_to_zmq(address) {
  addresses.push(address.slice(0, 81))
}

async function startZmq() {
  let payments = await get_open_payments()
  let paymentAddresses = payments.map(p => p.address.slice(0, 81))
  addresses = addresses.concat(paymentAddresses)

  sock.connect(process.env.zmq_node)
  if (process.env.fast_but_risky == 'true') {
    console.log('fast_but_risky active')
    sock.subscribe('tx')
  }
  if (process.env.zmq == 'true') {
    sock.subscribe('sn')
  }

  sock.on('message', async msg => {
    const data = msg.toString().split(' ') // Split to get topic & data
    switch (
      data[0] // Use index 0 to match topic
    ) {
      case 'tx':
        if (addresses.indexOf(data[2]) >= 0 && data[1] != latestTxHash) {
          latestTxHash = data[1]
          if (process.env.debug == 'full') {
            console.log('zmq: new tx found: ' + data)
          }
          let payment = await get_payment({
            address: checksum.addChecksum(data[2])
          })
          //check if the value is enough for the payment
          if (data[3] >= payment.value) {
            check_transfer(data)
          }
        }
        break
      case 'sn':
        if (addresses.indexOf(data[3]) >= 0 && data[2] != latestSnTxHash) {
          latestSnTxHash = data[2]
          if (process.env.debug == 'full') {
            console.log('zmq: new confirmed tx found: ' + data)
          }
          let payment = await get_payment({
            address: checksum.addChecksum(data[3])
          })
          await checkForTransactions([payment])
          await checkPaymentsBalance([payment])
          let checkPaymentStatus = await get_payment({
            address: checksum.addChecksum(data[3])
          })
          if (checkPaymentStatus.payed == true) {
            addresses.splice(addresses.indexOf(data[3]), 1)
          }
        }
    }
  })
}

async function check_transfer(txdata) {
  try {
    //ignore 0i txs
    if (txdata[3] != 0) {
      //check if enough iotas are at the input addresses
      let txs = await check_input_balances(txdata[8])
      //check if the signature is valid
      await checkSignature(txs)
      //check if there is no other outgoing transfer from the input addresses
      await check_for_outgoing_transfers(txs)
    }
    //return if already confirmed
    let payment = await get_payment({
      address: checksum.addChecksum(txdata[2])
    })
    if (payment.payed == true) {
      return
    }
    //update payment
    let new_payment = await update_payment(
      { address: checksum.addChecksum(txdata[2]) },
      { payed: true, earlyAccepted: true }
    )
    let eventMessage = {
      type: 'payment',
      status: 'paymentSuccess',
      payment: new_payment
    }
    eventHandler.emit(eventMessage)
    if (process.env.debug == 'basic' || process.env.debug == 'full') {
      console.log(`Payment ${new_payment.id} successfull early accepted`)
    }
    addresses.splice(addresses.indexOf(txdata[8]), 1)
    //reattach/promote?
  } catch (err) {
    if (process.env.debug == 'basic' || process.env.debug == 'full') {
      console.log(err)
    }
  }
}

async function check_input_balances(bundlehash) {
  let bundleTxObjects = await iota.findTransactionObjects({
    bundles: [bundlehash]
  })
  for (let index = 0; index < bundleTxObjects.length; index++) {
    if (bundleTxObjects[index].value < 0) {
      let balance = await iota.getBalances(
        [bundleTxObjects[index].address],
        100
      )
      if (
        Math.abs(balance.balances[0]) < Math.abs(bundleTxObjects[index].value)
      ) {
        if (process.env.debug == 'full') {
          console.log(
            'Zmq: Balance to send: ' +
              bundleTxObjects[index].value +
              ', available: ' +
              balance.balances[0]
          )
        }
        throw 'Not enough iotas on input address: ' +
          bundleTxObjects[index].address
      } else {
        return bundleTxObjects
      }
    }
  }
}

async function checkSignature(bundleTxObjects) {
  bundleTxObjects.sort((a, b) => {
    return a.currentIndex - b.currentIndex
  })
  bundleTxObjects = bundleTxObjects.filter(
    (tx, index, self) =>
      self.findIndex(t => t.currentIndex === tx.currentIndex) === index
  )
  if (!bundle_validator.default(bundleTxObjects)) {
    throw 'Incoming bundle has an invalid signature'
  }
}

async function check_for_outgoing_transfers(bundleTxObjects) {
  for (let index = 0; index < bundleTxObjects.length; index++) {
    if (bundleTxObjects[index].value < 0) {
      let addressTxs = await iota.findTransactionObjects({
        addresses: [bundleTxObjects[index].address]
      })
      addressTxs.forEach(tx => {
        if (tx.value < 0 && tx.bundle != bundleTxObjects[0].bundle) {
          throw 'Another outgoing bundle detected'
        }
      })
    }
  }
}
