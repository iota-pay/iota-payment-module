module.exports = createServer

const express = require('express')
const fs = require('fs')
const https = require('https')
const http = require('http')


function createServer(argv, app) {

    argv = argv || {}
    app = app || express()

    let mount = argv.mount || '/'
    // Removing ending '/'
    if (mount.length > 1 &&
        mount[mount.length - 1] === '/') {
        mount = mount.slice(0, -1)
    }

    app.get(mount, function (req, res) {
        res.send('hello world from payment');
    });

    console.log('Base URL (--mount): ' + mount)

    let server

    server = http.createServer(app)

    return server

}