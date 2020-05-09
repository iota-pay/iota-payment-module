const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { getBalance } = require('../Account.js')

const app = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'oma42_24amo'

// return total balance
app.get('/getbalance', function (req, res) {
  jwt.verify(req.headers.authorization, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getBalance().then((balance) => {
        res.send(String(balance))
      })
    }
  })
})

module.exports = app
