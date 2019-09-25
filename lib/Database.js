const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const filename = 'db_iota-payment-' + process.env.SEED.substring(0, 5) + '.json'

const adapter = new FileSync(filename)
const db = low(adapter)

// Set some defaults (required if your JSON file is empty)
db.defaults({
  payments: [],
  payouts: [],
  invalidPayouts: [],
  indexesForPayouts: [],
  keyIndex: 0,
  payoutIndex: 0
}).write()

module.exports = db
