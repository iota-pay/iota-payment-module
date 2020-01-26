const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const iotaCore = require('@iota/core')

if (typeof process.env.SEED == 'undefined') {
  throw 'Missing SEED in .env'
}

const filename = 'db_iota-payment-' + process.env.SEED.substring(0, 5) + '.json'

const adapter = new FileSync(filename)
const db = low(adapter)

// Set some defaults (required if your JSON file is empty)
db.defaults({
  payments: [],
  payouts: [],
  invalidPayouts: [],
  //initial addresses
  addresses: [
    {
      address: iotaCore.generateAddress(process.env.SEED, 0, 2, true),
      index: 0
    },
    {
      address: iotaCore.generateAddress(process.env.SEED, 1, 2, true),
      index: 1
    }
  ],
  //first payment will use 2, so 0 and 1 can be used for initial funds
  keyIndex: 1,
  payoutIndex: 0,
  indexesForPayouts: [],
  pendingPayoutTxs:{}
}).write()

module.exports = db
