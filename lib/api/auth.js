const { Router } = require('express')
const jwt = require('jsonwebtoken')

const auth = Router()

auth.post('/login', (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  if (req.body.username === 'admin' && req.body.password === 'password') {
    const token = jwt.sign({ id: req.body.username }, 'test_secret')
    return res.status(200).json({ message: 'ok', token })
  } else {
    return res.status(400).json({ message: 'Bad credentials' })
  }
})

module.exports = auth
