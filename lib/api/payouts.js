const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { sendPayout } = require('../payout.js')
const { getPayout, getPayouts } = require('../Database.js')

const app = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'oma42_24amo'

app.post('/', function (req, res) {
  var body = req.query

  // TODO: Check body - valid payout object?
  console.log('send ', body)
  jwt.verify(req.headers.authorization, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      sendPayout(body)
        .then((result) => {
          // send reponse with address.
          res.send({
            message: `Payout created.`,
            payout: result,
          })
        })
        .catch((err) => {
          res.send({
            message: err,
          })
        })
    }
  })
})

// return all payments
app.get('/', function (req, res) {
  jwt.verify(req.headers.authorization, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayouts().then((payouts) => {
        res.send(payouts)
      })
    }
  })
})

// return payment by id
app.get('/:id', function (req, res) {
  jwt.verify(req.headers.authorization, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayout({ id: req.params.id }).then((payment) => {
        if (typeof payment === 'undefined') {
          payment = 'id not found'
        }
        res.send(payment)
      })
    }
  })
})

module.exports = app
