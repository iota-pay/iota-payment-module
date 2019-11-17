const { version } = require('../../package.json')
const { Router } = require('express')
const auth = require('./auth')
const payments = require('./payments')
const payouts = require('./payouts')

module.exports = function api({ config, db }) {
  const app = Router()
  app.use('/auth', auth)
  app.use('/payments', payments)
  app.use('/payouts', payouts)
  // perhaps expose some API metadata at the root
  app.get('/', (req, res) => {
    res.json({ version })
  })

  return app
}
