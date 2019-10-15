module.exports = { startZmq, add_address_to_zmq }
const iotaCore = require('@iota/core')
const bundle_validator = require('@iota/bundle-validator')
const checksum = require('@iota/checksum')
const transaction_converter = require('@iota/transaction-converter')
const db = require('./Database')
const eventHandler = require('./eventHandler')

const iotaNode = process.env.IOTANODE

const iota = iotaCore.composeAPI({
  provider: iotaNode
})

const zmq = require('zeromq')
const sock = zmq.socket('sub')

let addresses = []
let latestTxHash = ''
function add_address_to_zmq(address) {
  addresses.push(address.slice(0, 81))
}

function startZmq() {
  let payments = db
    .get('payments')
    .filter({ payed: false })
    .value()
  let paymentAddresses = payments.map(p => p.address.slice(0, 81))
  addresses = addresses.concat(paymentAddresses)

  sock.connect(process.env.zmq_node)
  sock.subscribe('tx')

  sock.on('message', msg => {
    const data = msg.toString().split(' ') // Split to get topic & data
    switch (
      data[0] // Use index 0 to match topic
    ) {
      case 'tx':
        if (data[3] > 0) {
          if (
            addresses.findIndex(address => address == data[2]) >= 0 &&
            data[1] != latestTxHash
          ) {
            latestTxHash = data[1]
            console.log('new tx found: ' + data)
            let payment = db
              .get('payments')
              .find({ address: checksum.addChecksum(data[2]) })
              .value()
            //check if the value is enough for the payment
            if (data[3] >= payment.value) {
              check_transfer(data)
            }
          }
        }
    }
  })
}

async function check_transfer(txdata) {
  try {
    //check if enough iotas are at the input addresses
    let txs = await check_input_balances(txdata[8])
    //check if the signature is valid
    await checkSignature(txs)
    //check if there is no other outgoing transfer from the input addresses
    await check_for_outgoing_transfers(txs)
    //update payment
    let new_payment = db
      .get('payments')
      .find({ address: checksum.addChecksum(txdata[2]) })
      .assign({ payed: true, earlyAccepted: true })
      .write()
    let eventMessage = {
      type: 'payment',
      status: 'paymentSuccess',
      payment: new_payment
    }
    eventHandler.emit(eventMessage)
    console.log(`Payment ${new_payment.id} successfull early accepted`)
    //reattach/promote?
  } catch (err) {
    console.log(err)
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
        console.log(
          'Balance to send: ' +
            bundleTxObjects[index].value +
            ', available: ' +
            balance.balances[0]
        )
        throw 'Not enough iotas on input address: ' +
          bundleTxObjects[index].address
      } else {
        return bundleTxObjects
      }
    }
  }
}

async function checkSignature(bundleTxObjects) {
  var pos = bundleTxObjects
    .map(e => {
      return e.currentIndex
    })
    .indexOf(0)
  var endbundle = [
    transaction_converter.asTransactionTrytes(bundleTxObjects[pos])
  ]
  for (let k = 0; k < bundleTxObjects[pos].lastIndex; k++) {
    pos = bundleTxObjects
      .map(e => {
        return e.hash
      })
      .indexOf(bundleTxObjects[pos].trunkTransaction)
    endbundle.push(
      transaction_converter.asTransactionTrytes(bundleTxObjects[pos])
    )
  }
  if (bundle_validator.validateBundleSignatures(endbundle) == false) {
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
