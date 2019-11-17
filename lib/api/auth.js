const { Router } = require('express')
const jwt = require('jsonwebtoken')
const passport = require('passport')

const auth = Router()

auth.post('/login', (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  if (req.body.username === 'admin' && req.body.password === '111111') {
    const token = jwt.sign({ id: req.body.username }, 'test_secret')
    return res.status(200).json({ message: 'ok', token })
  } else {
    return res.status(400).json({ message: 'Bad credentials' })
  }
})

auth.get('/info', passport.authenticate('jwt'), (req, res) => {
  jwt.verify(req.headers.authorization, 'test_secret', (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Not found' })
    else return res.status(200).json({ message: 'Ok', user: decoded })
  })
})

module.exports = auth
