# iota payment module

[![GitHub package.json version](https://img.shields.io/github/package-json/v/iota-pay/iota-payment-module.svg)](https://github.com/iota-pay/iota-payment-module/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/badge/node-%3E%3Dv12.14.0-brightgreen.svg)](https://nodejs.org/download/release/v12.14.0/)
[![npm](https://img.shields.io/npm/dt/iota-payment.svg)](https://www.npmjs.com/package/iota-payment)
[![Dependency Status](https://img.shields.io/david/iota-pay/iota-payment-module.svg)](https://david-dm.org/iota-pay/iota-payment-module)
[![DevDependency Status](https://img.shields.io/david/iota-pay/iota-payment-module.svg?label=devDependencies)](https://david-dm.org/iota-pay/iota-payment-module?type=dev)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/iota-pay/iota-payment-module)

[![NPM](https://nodei.co/npm/iota-payment.png)](https://nodei.co/npm/iota-payment/)

[![Join Discord](https://img.shields.io/discord/446950114913943562?logo=discord&label=join%20discord)](https://discord.gg/C5PKFX)
[![Follow on Twitter](https://img.shields.io/twitter/follow/einfachIOTA?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=einfachIOTA)

## How to Use

**Still in development and testing. Unexpected errors and loss of funds may occur. Feedback is welcome!**

This module can easily extend your nodejs or express app.

[Docs](./docs)

### Install

```bash
$ npm install iota-payment
```

### Usage

Create a .env file with your settings

Always start with a new unused seed!

MAX_PAYMENT_TIME is the time until created paymentes aren't checked anymore in minutes (4320 = 3 days to pay, transactions after that are ignored)

If you want to send payouts, without receiving iotas via payments first, send the iotas to the first address of the seed (index 0)

```bash
SEED='REPLACEWITHEIGHTYONETRYTESEED'
IOTANODE='https://nodes.thetangle.org:443'
FALLBACKNODE='https://node01.iotatoken.nl'
MAX_PAYMENT_TIME=4320
```

Add `socket_origins` to allow other websocket origins than 'http://localhost:* http://127.0.0.1:*'

```bash
socket_origins=http://localhost:* http://127.0.0.1:*
```

Add `minPaymentIntervals` to limit the payment (address) generation over the API in seconds; to allow only 1 every 10 seconds:

```bash
minPaymentIntervals=10
```

Add `zmq` to check payment confirmations with zmq. Optional add `fast_but_risky` to have a payment success in seconds if a valid transaction was sent, don't use it with large amounts because a payment will be accepted before confirmation and an attacker could send the iotas to another address

```bash
zmq_node='tcp://tanglebeat.com:5556'
zmq=true
fast_but_risky=true
```

You can add `debug=basic` or `debug=full` to get more logs for debugging

```bash
deletePaidEntries=true
db=mongodb
wereAddressSpentCheck=false
```

### Examples

```JS
const paymentModule = require('iota-payment')
//create a payment
paymentModule.createPaymentRequest({ value: 1, data: {name: 'Carlos'} })
  .then(payment => {
    console.log(payment)
  })
  .catch(e => {
    console.log(e)
  })

//Create an event handler which is called, when a payment was successfull
let onPaymentSuccess = function (payment) {
  //your code
  console.log(`Payment received from ${payment.data.name}:`, payment);
}
paymentModule.onEvent('paymentSuccess', onPaymentSuccess);
```

- [01_simple_server](./examples/01_simple_server.js)
- [02 express_server_with_gui+api](./examples/02_express_server_with_gui+api.js)
- [03_events](./examples/03_events.js)
- [04_payment](./examples/04_payment.js)
- [05_payout](./examples/05_payout.js)
- [06_websockets](./examples/06_websockets.js)

## Contribute

This module is only possible because of a large community of contributors. A heartfelt thank you to everyone for all of your efforts!

You can help us too:

- [Create a new issue](https://github.com/iota-pay/iota-payment-module/issues/new) to report bugs
- [Fix an issue](https://github.com/iota-pay/iota-payment-module/issues)

Have a look at [CONTRIBUTING.md](https://github.com/iota-pay/iota-payment-module/blob/master/CONTRIBUTING.md).

## License

[The MIT License](https://github.com/iota-pay/iota-payment-module/blob/master/LICENSE.md)
