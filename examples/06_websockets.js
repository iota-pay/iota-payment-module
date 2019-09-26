var paymentModule = require('..')
var express = require('express')
var app = express()

app.get("/", function (req, res) {
    res.sendFile(__dirname + '/06_websocket.html');
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.post('/payment', async (req, res) => {
  try {
    const inputdata = req.body.data
    let value = inputdata[0]
    let data = inputdata[1]
    //create payment
    let payment = await paymentModule.payments.createPayment(value, data)
    res.send(payment)
  } catch (err) {
    res.send(err)
    console.log(err)
  }
})

var options = {
    mount: '/payments',
    value: 0,
    websockets: true
    // ...
}

let server = paymentModule.createServer(app, options)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})