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
 * @param {String} options.mount - The payment route name.
 * @param {Number} options.value - The default IOTA value.
 * @returns {object} an http server
 * @example
 * // creates a simple server
 * var paymentModule = require('iota-payment')
 * var app = require('express')()
 *
 * let server = paymentModule.createServer(app, {mount: '/payments'})
 * 
 * // Start server with iota-payment module on '/payments'
 * server.listen(3000, function () {
 *    console.log(`Server started on http://localhost:3000 `)
 * })
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
 * @example
 * var paymentModule = require('iota-payment')
 * 
 * //Create an event handler which is called, when a payment was successfull
 * var onPaymentSuccess = function (payment) {
 *     console.log('payment success!', payment);
 * }
 * 
 * //Assign the event handler to an event:
 * paymentModule.on('paymentSuccess', onPaymentSuccess);
 */
function on(event, fnc) {
  eventEmitter.addListener(event, fnc)
}
