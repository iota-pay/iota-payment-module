const { Router } = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')
const { getPayouts, getPayoutByID } = require('../payout.js')

const app = Router()

// return all payments
app.get('/', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayouts().then(payouts => {
        res.send(payouts)
      })
    }
  })
})

// return payment by id
app.get('/:id', passport.authenticate('jwt'), function (req, res) {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getPayoutByID(req.params.id).then(payment => {
        if (typeof payment === 'undefined') {
          payment = 'id not found'
        }
        res.send(payment)
      })
    }
  })
})

module.exports = app
