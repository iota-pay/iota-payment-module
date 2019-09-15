module.exports = { createServer, on }

const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const fs = require('fs')
const https = require('https')
const http = require('http')
const bodyParser = require('body-parser')

const createRoutes = require('./routes.js')

const eventEmitter = require('./eventEmitter')

const paymentHandler = require('./paymentHandler')
const payoutHandler = require('./payoutHandler')
paymentHandler.start()
payoutHandler.start()

/**
 * Creates and returns a express server.
 * @param {object} app - an express application.
 * @param {object} options - an options object.
 * @returns {object} an http server
 */
function createServer(app, options = {}) {
  options = options || {}
  app = app || express()

  app.use(bodyParser.json()) // to support JSON-encoded bodies
  app.use(
    bodyParser.urlencoded({
      // to support URL-encoded bodies
      extended: true
    })
  )

  let mount = options.mount || '/'
  // Removing ending '/'
  if (mount.length > 1 && mount[mount.length - 1] === '/') {
    mount = mount.slice(0, -1)
  }

  let value = options.value || 0
  createRoutes(app, mount, value)

  console.log('Base URL (--mount): ' + mount)

  let server

  server = http.createServer(app)

  return server
}

/**
 * This method attaches an event listener.
 * @param {object} event - event name
 * @param {function} fnc - the function which will be called
 */
function on(event, fnc) {
  eventEmitter.addListener(event, fnc)
}
