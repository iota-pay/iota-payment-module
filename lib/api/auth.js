const { Router } = require('express')
const jwt = require('jsonwebtoken')
const { username, password, jwt_secret } = require('../config.js')

const auth = Router()

auth.post('/login', (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }
  if (req.body.username === username && req.body.password === password) {
    const token = jwt.sign({ id: req.body.username }, jwt_secret)
    return res.status(200).json({ message: 'ok', token })
  } else {
    return res.status(400).json({ message: 'Bad credentials' })
  }
})

auth.get('/info', (req, res) => {
  jwt.verify(req.headers.authorization, jwt_secret, (err, decoded) => {
    console.log('req.headers.authorization2', req.headers.authorization)
    if (err) return res.status(401).json({ message: 'Not found' })
    else return res.status(200).json({ message: 'Ok', user: decoded })
  })
})

module.exports = auth
