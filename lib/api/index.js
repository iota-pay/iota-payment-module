const { version } = require('../../package.json')
const { Router } = require('express')
const auth = require('./auth')

module.exports = function api({ config, db }) {
  const app = Router()
  app.use('/auth', auth)
  // perhaps expose some API metadata at the root
  app.get('/', (req, res) => {
    res.json({ version })
  })

  return app
}
