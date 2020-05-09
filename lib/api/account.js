const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { getBalance } = require('../Account.js')
const { jwt_secret } = require('../config.js')

const app = Router()

// return total balance
app.get('/getbalance', function (req, res) {
  jwt.verify(req.headers.authorization, jwt_secret, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else {
      getBalance().then((balance) => {
        res.send(String(balance))
      })
    }
  })
})

module.exports = app
