module.exports = { createPayment, getPayments, getPaymentByID }

const db = require('./Database')
const getNewAddress = require('./tangle')


function createPayment(data) {
    return new Promise(function (resolve, reject) {

        getNewAddress().then(address => {

            let payment = {
                address: address,
                data: JSON.stringify(data)
            }

            db.get('payments')
                .push(payment)
                .last()
                .assign({ id: Date.now().toString() })
                .write()

            resolve(payment)
        })

    });
}


function getPayments() {
    return new Promise(function (resolve, reject) {

        resolve(db.get('payments').value())
    });
}

function getPaymentByID(id) {
    return new Promise(function (resolve, reject) {

        const payment = db.get('payments')
            .find({ id: id })
            .value()

        resolve(payment)


    });
}
