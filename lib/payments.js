module.exports = { createPayment, getPayments, getPaymentByID }

const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')
const getNewAddress = require('./tangle')

const adapter = new FileAsync('db.json')

function createPayment(data) {
    return new Promise(function (resolve, reject) {

        let address = getNewAddress()

        let payment = {
            address: address,
            data: JSON.stringify(data)
        }

        low(adapter)
            .then(db => {

                db.get('payments')
                    .push(payment)
                    .last()
                    .assign({ id: Date.now().toString() })
                    .write()
                    .then(payment => resolve(payment))
            });
    });
}


function getPayments() {
    return new Promise(function (resolve, reject) {
        low(adapter)
            .then(db => {
                resolve(db.get('payments').value())
            });
    });
}

function getPaymentByID(id) {
    return new Promise(function (resolve, reject) {
        low(adapter)
            .then(db => {
                const payment = db.get('payments')
                    .find({ id: id })
                    .value()

                resolve(payment)

            });
    });
}
