module.exports = { createServer, on }

const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const fs = require('fs')
const https = require('https')
const http = require('http')
const bodyParser = require('body-parser')

const createRoutes = require('./routes.js')

const events = require('events')
const eventEmitter = new events.EventEmitter()

const paymentHandler = require('./paymentHandler')
paymentHandler.start();

function createServer(argv, app) {
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

  createRoutes(app, mount)

  console.log('Base URL (--mount): ' + mount)

  let server

  server = http.createServer(app)

  return server
}

function on(event, fnc) {
  eventEmitter.addListener(event, fnc)

  eventEmitter.emit('paymentSuccess', { test: 'yeah!' })
}
