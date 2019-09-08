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
paymentHandler.start();

function createServer(app, argv = {}) {
  argv = argv || {}
  app = app || express()

  app.use(bodyParser.json()) // to support JSON-encoded bodies
  app.use(
    bodyParser.urlencoded({
      // to support URL-encoded bodies
      extended: true
    })
  )

  let mount = argv.mount || '/'
  // Removing ending '/'
  if (mount.length > 1 && mount[mount.length - 1] === '/') {
    mount = mount.slice(0, -1)
  }

  let value = argv.value || 0
  createRoutes(app, mount, value)

  console.log('Base URL (--mount): ' + mount)

  let server

  server = http.createServer(app)

  return server
}

function on(event, fnc) {
  eventEmitter.addListener(event, fnc)

}
