const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { createPaymentRequest } = require('../payment.js')
const { getPayment, getPayments } = require('../Database.js')
const config = require('../config.js')

const app = Router()
const { jwt_secret } = require('../config.js')

const VALUE = config.value
const minPaymentInterval = config.minPaymentInterval * 1000 || 0
let lastPaymentTime = Date.now() - minPaymentInterval - 10000

app.post('/', function (request, response) {
  if (Date.now() - minPaymentInterval < lastPaymentTime) {
    return response
      .status(401)
      .json({ message: 'Wait for minPaymentInterval before a new request' })
  }
  lastPaymentTime = Date.now()
  var body = request.body
  createPaymentRequest({ value: VALUE, data: body }).then((payment) => {
    // send reponse with address.
    response.send({
      message: `Payment created. Please pay ${VALUE} iota to provided address.`,
      payment: payment,
    })
  })
})

// return all payments
app.get('/', function (req, res) {
  jwt.verify(req.headers.authorization, jwt_secret, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayments().then((payments) => {
        res.send(payments)
      })
    }
  })
})

// return payment by id
app.get('/:id', function (req, res) {
  jwt.verify(req.headers.authorization, jwt_secret, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayment({ id: req.params.id }).then((payment) => {
        if (typeof payment === 'undefined') {
          payment = 'id not found'
        }
        res.send(payment)
      })
    }
  })
})

module.exports = app
