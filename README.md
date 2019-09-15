# iota payment module

## Module Features supported

- [x] [Provide Enpoints for Payments]()
- [x] [Generates save IOTA addresses]()
- [ ] [Check incomming transactions on ZMQ stream](https://github.com/machineeconomy/iota-payment/issues/6)
- [x] [Check transaction status (confirmed or not) ]()
- [x] [JS Event handler]()
- [x] [Payout functionality]()
- [ ] [Auto payment cleanup](https://github.com/machineeconomy/iota-payment/issues/18)
- [ ] [MQTT Events](https://github.com/machineeconomy/iota-payment/issues/7)


## How to Use

This module can easily extend your nodejs or express app.

### Install

```bash
$ npm install iota-payment
```

### Usage

Create a .env file with your settings
MAX_PAYMENT_TIME is the time until created paymentes aren't checked anymore in minutes

```bash
SEED='REPLACEWITHEIGHTYONETRYTESEED'
IOTANODE='https://nodes.thetangle.org:443'
MAX_PAYMENT_TIME=1440
```

```bash
var paymentModule = require('iota-payment')
var app = require('express')()

let server = paymentModule.createServer(app)

// Start server with iota-payment module on '/payments'
server.listen(3000, function () {
    console.log(`Server started on http://localhost:3000 `)
})
```

### Examples

- [01_simple_server](./examples/01_simple_server.js)
- [02_custom_server](./examples/02_custom_server.js)
- [03_events](./examples/03_events.js)
- [04_payments](./examples/04_payments.js)
- [05_payout](./examples/05_payout.js)

## Contribute

This module is only possible because of a large community of contributors. A heartfelt thank you to everyone for all of your efforts!

You can help us too:

- [Create a new issue](https://github.com/machineeconomy/iota-payment/issues/new) to report bugs
- [Fix an issue](https://github.com/machineeconomy/iota-payment/issues)

Have a look at [CONTRIBUTING.md](https://github.com/solid/node-solid-server/blob/master/CONTRIBUTING.md).

## License

[The MIT License](https://github.com/solid/node-solid-server/blob/master/LICENSE.md)
