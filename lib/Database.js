const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const filename = 'db_iota-payment.json'

const adapter = new FileSync(filename)
const db = low(adapter)

// Set some defaults (required if your JSON file is empty)
db.defaults({ payments: [], keyIndex: 0 }).write()

module.exports = db
