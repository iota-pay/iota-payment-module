const paymentModule = require('..')
const app = require('express')()

app.get("/", (req, res) => {
    res.send('hello world from 02_express_server_with_gui+api example!');
});

let options = {
    api: true,
    dashboard: true,
    websockets: true
    // ...
}

let server = paymentModule.createServer(app, options)

// Start server with iota-payment dashboard on '/iotapay' and api on '/iotapay/api'
server.listen(5000, () => {
    console.log(`Server started on http://localhost:5000 `)
    console.info(`Please visit http://localhost:5000/iotapay in your browser`)
})