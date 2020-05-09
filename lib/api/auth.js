const { Router } = require('express')
const jwt = require('jsonwebtoken')

const auth = Router()

const USERNAME = process.env.USERNAME || 'admin'
const PASSWORD = process.env.PASSWORD || 'password' // user should be forced to change this
const JWT_SECRET = process.env.JWT_SECRET || 'ipm_ipm_ipm'


auth.post('/login', (req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }
  if (req.body.username === USERNAME && req.body.password === PASSWORD) {
    const token = jwt.sign({ id: req.body.username }, JWT_SECRET)
    return res.status(200).json({ message: 'ok', token })
  } else {
    return res.status(400).json({ message: 'Bad credentials' })
  }
})

auth.get('/info', (req, res) => {
  jwt.verify(req.headers.authorization, JWT_SECRET, (err, decoded) => {
    console.log("req.headers.authorization2", req.headers.authorization)
    if (err) return res.status(401).json({ message: 'Not found' })
    else return res.status(200).json({ message: 'Ok', user: decoded })
  })
})

module.exports = auth
