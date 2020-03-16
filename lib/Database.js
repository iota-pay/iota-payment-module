const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const iotaCore = require('@iota/core')
const checksum = require('@iota/checksum')
const defaults = require('../config/defaults')
const MongoClient = require('mongodb').MongoClient

if (typeof process.env.SEED == 'undefined') {
  throw 'Missing SEED in .env'
}
let seed_checksum = checksum.addChecksum(process.env.SEED, 3, false).slice(-3)
const filename =
  'db_iota-payment-' +
  process.env.SEED.substring(0, 3) +
  seed_checksum +
  '.json'
let uri =
  defaults.mongodb_url + process.env.SEED.substring(0, 3) + seed_checksum

let initial_state = {
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
  indexes_for_payouts: [],
  rawBundles: []
}

let mongodb
let lowdb
let db_type
if (process.env.db == 'mongodb') {
  if (process.env.debug === 'basic' || process.env.debug === 'full') {
    console.log('mongodb is used')
  }
  db_type = 'mongo'
} else {
  if (process.env.debug === 'basic' || process.env.debug === 'full') {
    console.log('lowdb is used')
  }
  db_type = 'low'
  const adapter = new FileSync(filename)
  lowdb = low(adapter)
  // Set some defaults (required if your JSON file is empty)
  lowdb.defaults(initial_state).write()
  if (JSON.stringify(lowdb.value()) == JSON.stringify(initial_state)) {
    console.log(
      `First address (index 0): ${initial_state.addresses[0].address} can be used to deposit intial funds`
    )
  }
}

dbLogOnStart()
async function dbLogOnStart() {
  let currentIndex = await getKeyIndex()
  let currentPayoutIndex = await getPayoutIndex()
  if (Number.isInteger(currentIndex)) {
    console.log(
      `Database loaded. Current address index: ${currentIndex}, payout index: ${currentPayoutIndex}`
    )
  } else {
    console.log('Error loading database.')
  }
}

function connect_to_mongodb() {
  return new Promise((resolve, reject) => {
    // console.log('in connectodatabase')
    if (typeof mongodbb != 'undefined') {
      return resolve(mongodbb)
    }
    MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      poolSize: 5
    })
      .then(client => {
        mongodbb = client.db()
        if (process.env.debug === 'basic' || process.env.debug === 'full') {
          console.log('mongo db connected')
        }
        resolve(mongodbb)
      })
      .catch(e => {
        console.log(e)
        reject(e)
      })
  })
}

function initializeMongodb() {
  return new Promise(async (resolve, reject) => {
    try {
      if (typeof mongodb == 'undefined') {
        if (process.env.debug === 'full') {
          console.log('mongodb is undefined', mongodb)
        }
        //assign value so it's not undefined
        mongodb = 'test'
        mongodb = await connect_to_mongodb()
        if (process.env.debug === 'full') {
          console.log('mongodb is connected')
        }
      }
      db = mongodb
      await db.collection('test').insertOne({ test: 'test' })

      let collection_infos = await db.listCollections().toArray()
      // console.log(collection_infos)

      //addresses
      var name = 'addresses'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
        await db.collection(name).insertMany(initial_state.addresses)
        console.log(
          `First address (index 0): ${initial_state.addresses[0].address} can be used to deposit intial funds`
        )
      } else {
        // console.log(name + ' is already defined')
      }

      //payments
      name = 'payments'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
      } else {
        // console.log(name + ' is already defined')
      }

      //payouts
      name = 'payouts'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
      } else {
        // console.log(name + ' is already defined')
      }

      //keyIndex
      name = 'keyIndex'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')

        await db.collection(name).insertOne({ [name]: 1 })
      } else {
        // console.log(name + ' is already defined')
      }

      //payoutIndex
      name = 'payoutIndex'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
        await db.collection(name).insertOne({ [name]: 0 })
      } else {
        // console.log(name + ' is already defined')
      }

      //indexes_for_payouts
      name = 'indexes_for_payouts'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
      } else {
        // console.log(name + ' is already defined')
      }

      //rawBundles
      name = 'rawBundles'
      if (-1 == collection_infos.map(e => e.name).indexOf(name)) {
        // console.log(name + ' is undefined')
      } else {
        // console.log(name + ' is already defined')
      }

      //get new db entries
      if (process.env.debug === 'full') {
        let new_collection_infos = await db.listCollections().toArray()
        // console.log(new_collection_infos)
        let initialized_db = {}
        for (key of new_collection_infos) {
          let collection = await mongodbb
            .collection(key.name)
            .find({}, { projection: { _id: 0 } })
            .toArray()
          initialized_db[key.name] = collection
        }
        //to compare with intitial state
        console.log('Created initial state:', initialized_db)

        setInterval(() => logdb(), 60000)
      }
      //remove test collection
      await db.collection('test').drop()
      resolve()
    } catch (e) {
      console.log(e)
      reject(e)
    }
  })
}

async function logdb() {
  try {
    let db = await connect_to_mongodb()
    let new_collection_infos = await db.listCollections().toArray()
    let initialized_db = {}
    for (key of new_collection_infos) {
      let collection = await mongodbb
        .collection(key.name)
        .find({}, { projection: { _id: 0 } })
        .toArray()
      initialized_db[key.name] = collection
    }
    //to compare with intitial state
    console.log('Db state:', initialized_db)
  } catch (err) {
    console.log(err)
  }
}

function storeAddress(address_object) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db.collection('addresses').insertOne(address_object)
        resolve()
      } else {
        lowdb
          .get('addresses')
          .push(address_object)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function updateSpentAddress(address) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let new_addressobject = { $set: { spent: true } }
        await db
          .collection('addresses')
          .updateOne({ address }, new_addressobject)
        resolve()
      } else {
        lowdb
          .get('addresses')
          .find({ address: address })
          .assign({ spent: true })
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getAddresses() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('addresses')
          .find({}, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb.get('addresses').value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function storePayment(payment) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db.collection('payments').insertOne(payment)
        resolve()
      } else {
        lowdb
          .get('payments')
          .push(payment)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function updatePayment(id, updated_fields) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let new_update_fields = { $set: updated_fields }
        let updated_payment = await db
          .collection('payments')
          .findOneAndUpdate({ id }, new_update_fields, {
            projection: { _id: 0 }
          })
        resolve(updated_payment.value)
      } else {
        let updated_payment = lowdb
          .get('payments')
          .find({ id })
          .assign(updated_fields)
          .write()
        resolve(updated_payment)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function deleteKeyFromPayment(id, updated_fields) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let new_update_fields = { $unset: { [updated_fields]: '' } }
        let updated_payment = await db
          .collection('payments')
          .findOneAndUpdate({ id }, new_update_fields, {
            projection: { _id: 0 }
          })
        delete updated_payment.value[updated_fields]
        resolve(updated_payment.value)
      } else {
        lowdb
          .get('payments')
          .find({ id })
          .unset(updated_fields)
          .write()
        let updated_payment = lowdb
          .get('payments')
          .find({ id })
          .value()
        resolve(updated_payment)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function deletePayment(id) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let deletedBundle = await db
          .collection('payments')
          .findOneAndDelete({ id }, { projection: { _id: 0 } })
        resolve(deletedBundle)
      } else {
        let deletedBundle = lowdb
          .get('payments')
          .remove({ id })
          .write()
        resolve(deletedBundle)
      }
    } catch (err) {
      reject(err)
    }
  })
}

//returns array, could be multiple payouts with this implementation
function getPayment(key) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let payment_objects = await db
          .collection('payments')
          .find(key, { projection: { _id: 0 } })
          .toArray()
        resolve(payment_objects[0])
      } else {
        let payment_objects = lowdb
          .get('payments')
          .find(key)
          .value()
        resolve(payment_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPayments() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payments')
          .find({}, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb.get('payments').value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getOpenPayments() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payments')
          .find({ payed: false }, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb
          .get('payments')
          .filter({ payed: false })
          .value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPaidPayments() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payments')
          .find({ payed: true }, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb
          .get('payments')
          .filter({ payed: true })
          .value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function storePayout(payout) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db.collection('payouts').insertOne(payout)
        resolve()
      } else {
        lowdb
          .get('payouts')
          .push(payout)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function updatePayout(id, updated_fields) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let new_update_fields = { $set: updated_fields }
        let updated_payout = await db
          .collection('payouts')
          .findOneAndUpdate(id, new_update_fields, { projection: { _id: 0 } })
        resolve(updated_payout.value)
      } else {
        let updated_payout = lowdb
          .get('payouts')
          .find(id)
          .assign(updated_fields)
          .write()
        resolve(updated_payout)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function deletePayout(id) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let deletedBundle = await db
          .collection('payouts')
          .findOneAndDelete({ id }, { projection: { _id: 0 } })
        resolve(deletedBundle)
      } else {
        let deletedBundle = lowdb
          .get('payouts')
          .remove({ id })
          .write()
        resolve(deletedBundle)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPayout(key) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let payout_objects = await db
          .collection('payouts')
          .find(key, { projection: { _id: 0 } })
          .toArray()
        resolve(payout_objects[0])
      } else {
        let payout_objects = lowdb
          .get('payouts')
          .find(key)
          .value()
        resolve(payout_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPayouts() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payouts')
          .find({}, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb.get('payouts').value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getOpenPayouts() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payouts')
          .find({ payed: false }, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb
          .get('payouts')
          .filter({ payed: false })
          .value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPaidPayouts() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let address_objects = await db
          .collection('payouts')
          .find({ payed: true }, { projection: { _id: 0 } })
          .toArray()
        resolve(address_objects)
      } else {
        let address_objects = lowdb
          .get('payouts')
          .filter({ payed: true })
          .value()
        resolve(address_objects)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getKeyIndex() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let keyIndex = await db.collection('keyIndex').findOne()
        if (keyIndex == null) {
          keyIndex = { keyIndex: 1 }
        }
        resolve(keyIndex.keyIndex)
      } else {
        let keyIndex = lowdb.get('keyIndex').value()
        resolve(keyIndex)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function increaseKeyIndex() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let index = await getKeyIndex()
        let newIndex = index + 1
        await db
          .collection('keyIndex')
          .updateOne({}, { $set: { keyIndex: newIndex } })
        resolve(newIndex)
      } else {
        let currentIndex = lowdb.get('keyIndex').value()
        lowdb.set('keyIndex', currentIndex + 1).write()
        resolve(currentIndex + 1)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getPayoutIndex() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let payoutIndex = await db.collection('payoutIndex').findOne()
        if (payoutIndex == null) {
          payoutIndex = { payoutIndex: 0 }
        }
        resolve(payoutIndex.payoutIndex)
      } else {
        let payoutIndex = lowdb.get('payoutIndex').value()
        resolve(payoutIndex)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function setPayoutIndex(new_payoutIndex) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db
          .collection('payoutIndex')
          .updateOne({}, { $set: { payoutIndex: new_payoutIndex } })
        resolve()
      } else {
        lowdb.set('payoutIndex', new_payoutIndex).write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getRawBundles() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let rawBundles = await db
          .collection('rawBundles')
          .find({}, { projection: { _id: 0 } })
          .toArray()
        resolve(rawBundles)
      } else {
        let rawBundles = lowdb.get('rawBundles').value()
        resolve(rawBundles)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function deleteRawBundle(bundleHash) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let deletedBundle = await db
          .collection('rawBundles')
          .findOneAndDelete({ bundleHash }, { projection: { _id: 0 } })
        resolve(deletedBundle)
      } else {
        let deletedBundle = lowdb
          .get('rawBundles')
          .remove({ bundleHash })
          .write()
        resolve(deletedBundle)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function storeRawBundle(bundleobject) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db.collection('rawBundles').insertOne(bundleobject)
        resolve()
      } else {
        lowdb
          .get('rawBundles')
          .push(bundleobject)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function storeIndexForPayouts(index_for_payouts) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db
          .collection('indexes_for_payouts')
          .update({}, { $push: { indexes_for_payouts: index_for_payouts } })
        resolve()
      } else {
        lowdb
          .get('indexes_for_payouts')
          .push(index_for_payouts)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

function getIndexesForPayouts() {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        let index_object = await db
          .collection('indexes_for_payouts')
          .find(
            {},
            {
              $pull: { indexes_for_payouts: 'indexes_for_payouts' },
              projection: { _id: 0 }
            }
          )
          .toArray()
        if (index_object.length == 0) {
          index_object[0] = { indexes_for_payouts: [] }
        }
        resolve(index_object[0].indexes_for_payouts)
      } else {
        let index_object = lowdb.get('indexes_for_payouts').value()
        resolve(index_object)
      }
    } catch (err) {
      reject(err)
    }
  })
}

function deleteIndexForPayouts(index_for_payouts) {
  return new Promise(async (resolve, reject) => {
    try {
      if (db_type == 'mongo') {
        let db = await connect_to_mongodb()
        await db
          .collection('indexes_for_payouts')
          .update({}, { $pull: { indexes_for_payouts: index_for_payouts } })
        resolve()
      } else {
        lowdb
          .get('indexes_for_payouts')
          .pull(index_for_payouts)
          .write()
        resolve()
      }
    } catch (err) {
      reject(err)
    }
  })
}

module.exports = {
  initializeMongodb,
  storeAddress,
  updateSpentAddress,
  getAddresses,
  storePayment,
  updatePayment,
  deleteKeyFromPayment,
  deletePayment,
  getPayment,
  getPayments,
  getOpenPayments,
  getPaidPayments,
  storePayout,
  updatePayout,
  deletePayout,
  getPayout,
  getPayouts,
  getOpenPayouts,
  getPaidPayouts,
  getKeyIndex,
  increaseKeyIndex,
  getPayoutIndex,
  setPayoutIndex,
  storeRawBundle,
  getRawBundles,
  deleteRawBundle,
  storeIndexForPayouts,
  getIndexesForPayouts,
  deleteIndexForPayouts
}
