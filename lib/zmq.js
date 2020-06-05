module.exports = { startZmq, add_address_to_zmq }
const bundle_validator = require('@iota/bundle-validator')
const checksum = require('@iota/checksum')
const { getPayment, getOpenPayments, updatePayment } = require('./Database')
const eventHandler = require('./eventHandler')
const {
  checkPaymentsBalance,
  checkForTransactions,
} = require('./paymentHandler')
const iota = require('./iota')
const config = require('./config.js')

const zmq = require('zeromq')
const sock = zmq.socket('sub')

let addresses = []
let latestTxHash = ''
let latestSnTxHash = ''
function add_address_to_zmq(address) {
  addresses.push(address.slice(0, 81))
}

async function startZmq() {
  let payments = await getOpenPayments()
  let paymentAddresses = payments.map((p) => p.address.slice(0, 81))
  addresses = addresses.concat(paymentAddresses)

  sock.connect(config.zmqNode)
  if (config.fastButRisky == 'true') {
    console.log('fastButRisky active')
    sock.subscribe('tx')
  }
  if (config.zmq == 'true') {
    sock.subscribe('sn')
    sock.subscribe('tx')
  }

  sock.on('message', async (msg) => {
    const data = msg.toString().split(' ') // Split to get topic & data
    switch (
      data[0] // Use index 0 to match topic
    ) {
      case 'tx':
        if (addresses.indexOf(data[2]) >= 0 && data[1] != latestTxHash) {
          latestTxHash = data[1]
          if (config.debug == 'full') {
            console.log('zmq: new tx found: ' + data)
          }
          let payment = await getPayment({
            address: checksum.addChecksum(data[2]),
          })
          //wait one second so the nodes have time to process the transaction
          await new Promise((resolve) => setTimeout(resolve, 1000))
          //check if the value is enough for the payment
          if (config.fastButRisky == 'true' && data[3] >= payment.value) {
            check_transfer(data)
          }
          if (config.zmq == 'true' && data[3] >= payment.value) {
            checkForTransactions([payment])
          }
        }
        break
      case 'sn':
        if (addresses.indexOf(data[3]) >= 0 && data[2] != latestSnTxHash) {
          latestSnTxHash = data[2]
          if (config.debug == 'full') {
            console.log('zmq: new confirmed tx found: ' + data)
          }
          let payment = await getPayment({
            address: checksum.addChecksum(data[3]),
          })
          await checkForTransactions([payment])
          await checkPaymentsBalance([payment])
          let checkPaymentStatus = await getPayment({
            address: checksum.addChecksum(data[3]),
          })
          if (checkPaymentStatus.paid == true) {
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
    let payment = await getPayment({
      address: checksum.addChecksum(txdata[2]),
    })
    if (payment.paid == true) {
      return
    }
    //update payment
    let new_payment = await updatePayment(payment.id, {
      paid: true,
      earlyAccepted: true,
      txInfo: { value: txdata[3], hash: txdata[1], timestamp: txdata[5] },
    })
    let eventMessage = {
      type: 'payment',
      status: 'paymentSuccess',
      payment: new_payment,
    }
    eventHandler.emit(eventMessage)
    if (config.debug == 'basic' || config.debug == 'full') {
      console.log(`Payment ${new_payment.id} successfull early accepted`)
    }
    addresses.splice(addresses.indexOf(txdata[8]), 1)
    //reattach/promote?
  } catch (err) {
    if (config.debug == 'basic' || config.debug == 'full') {
      console.log(err)
    }
  }
}

async function check_input_balances(bundlehash) {
  let bundleTxObjects = await iota.findTransactionObjects({
    bundles: [bundlehash],
  })
  if(bundleTxObjects.length == 0){
    throw(`zmq: bundle ${bundlehash} not found`)
  }
  //sort and filter so every index is there only once
  bundleTxObjects = bundleTxObjects.sort((a, b) => {
    return a.currentIndex - b.currentIndex
  })
  bundleTxObjects = bundleTxObjects.filter(
    (tx, index, self) =>
      self.findIndex((t) => t.currentIndex === tx.currentIndex) === index
  )
  for (let index = 0; index < bundleTxObjects.length; index++) {
    if (bundleTxObjects[index].value < 0) {
      let balance = await iota.getBalances(
        [bundleTxObjects[index].address],
        100
      )
      if (
        Math.abs(balance.balances[0]) < Math.abs(bundleTxObjects[index].value)
      ) {
        if (config.debug == 'full') {
          console.log(
            'Zmq: Balance to send: ' +
              bundleTxObjects[index].value +
              ', available: ' +
              balance.balances[0]
          )
        }
        throw (
          'Not enough iotas on input address: ' + bundleTxObjects[index].address
        )
      }
    }
  }
  return bundleTxObjects
}

async function checkSignature(bundleTxObjects) {
  if (!bundle_validator.default(bundleTxObjects)) {
    throw 'Incoming bundle has an invalid signature'
  }
}

async function check_for_outgoing_transfers(bundleTxObjects) {
  for (let index = 0; index < bundleTxObjects.length; index++) {
    if (bundleTxObjects[index].value < 0) {
      let addressTxs = await iota.findTransactionObjects({
        addresses: [bundleTxObjects[index].address],
      })
      addressTxs.forEach((tx) => {
        if (tx.value < 0 && tx.bundle != bundleTxObjects[0].bundle) {
          throw 'Another outgoing bundle detected'
        }
      })
    }
  }
}
