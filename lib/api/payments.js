const { Router } = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const { createPayment, getPayments, getPaymentByID } = require('../payment.js')

const app = Router()

app.post('/', function (request, response) {
  var body = request.body
  createPayment(1, body).then(payment => {
    // send reponse with address.
    response.send({
      message: `Payment created. Please pay ${1} iota to provided address.`,
      payment: payment
    })
  })
})

// return all payments
app.get('/', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayments().then(payments => {
        res.send(payments)
      })
    }
  })
})

// return payment by id
app.get('/:id', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPaymentByID(req.params.id).then(payment => {
        if (typeof payment === 'undefined') {
          payment = 'id not found'
        }
        res.send(payment)
      })
    }
  })
})

module.exports = app
