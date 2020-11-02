# iota payment module

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![node](https://img.shields.io/badge/node-%3E%3Dv12.14.0-brightgreen.svg)](https://nodejs.org/download/release/v12.14.0/)
[![Dependency Status](https://img.shields.io/david/iota-pay/iota-payment-module.svg)](https://david-dm.org/iota-pay/iota-payment-module)
[![Join Discord](https://img.shields.io/discord/446950114913943562?logo=discord&label=join%20discord)](https://discord.gg/hWeH9qV)
[![Follow on Twitter](https://img.shields.io/twitter/follow/einfachIOTA?style=social&logo=twitter)](https://twitter.com/intent/follow?screen_name=einfachIOTA)

## How to Use

**Still in development and testing. Unexpected errors and loss of funds may occur. Feedback is welcome!**

This module can easily extend your nodejs or express app.

### Install

```bash
npm i iota-payment
```

### Usage

Create a .env file with your settings

Always start with a new unused [seed](https://docs.iota.org/docs/getting-started/0.1/clients/seeds)!

Minimum requirement to use it in the comnet:

```bash
seed=REPLACEWITHEIGHTYONETRYTESEED
```

If you want to send payouts, without receiving IOTA tokens via payments first, send the tokens to the first address of the seed (index 0) (is displayed on first start)


### Example

```JS
const { createPaymentRequest, onEvent, sendPayout, getBalance } = require('iota-payment')

async function main() {
  try {
    //create a payment (receiving address), data is optional and is only stored locally
    let payment = await createPaymentRequest({ value: 1, data: { number: 1 } })
    //send a payout with zero value
    let payout = await sendPayout({ address: 'VO9H9GFNRTOLPUHM9MACFWSUFLNLDYCTKIPXCYLTNNNDMURPUIXNVBYQMRKOJDEYM9UDESGXBIWASIDRBFOBHCJGZD', value: 0 })
    //get account balance
    let balance = await getBalance()
    console.log("Balance:", balance)
  } catch (err) {
    console.error(err);
  }
}

//run
main()

//Create an event handler which is called, when a payment was successfull
let onPaymentSuccess = (payment) => {
  //your code
  console.log(`Payment number ${payment.data.number} was paid:`, payment);
}
onEvent('paymentSuccess', onPaymentSuccess);
```

[More examples](./examples)

[Documentation](./docs)

Additional settings you can add to the .env to override the [defaults](https://github.com/iota-pay/iota-payment-module/blob/37c5562c4792fd394612ea62567ef434cdc242aa/lib/config.js#L3):

```bash
#time after which payments aren't checked anymore in minutes (4320 = 3 days to pay, transactions after that are ignored)
maxPaymentTime=4320
#set custom IOTA nodes
iotaNodes=["https://nodes.comnet.thetangle.org:443"]
#get basic logs
debug=basic
#get all logs
debug=full
#use the mainnet defaults (mainnet nodes, explorer link, mwm)
network=mainnet
#override mwm
mwm=14
#override explorer tx link
explorerTxLink=https://comnet.thetangle.org/transaction/
#don't check if addresses were spent from
wereAddressSpentCheck=false
#custom limit for how many txs a bundle can have, minimum is 4
maxBundleSize=7
#value for payments with the API
value=1
#set origings for websocket connection
socketOrigins=['http://localhost:*', 'http://127.0.0.1:*']
#limit the payment (address) generation over the API in seconds; to allow only 1 every 10 seconds:
minPaymentInterval=10
#use mongodb
db=mongodb
#custom mongodb url
mongodbUrl=mongodb://127.0.0.1:27017/
#enable zmq to detect incoming transactions faster
zmq=true
zmqNode=tcp://tanglebeat.com:5556
#payment success in seconds if a valid transaction was sent (not confirmed), funds may never arrive
fastButRisky=true
#delete payments and payouts at the moment they get confirmed
deletePaidEntries=true


# ---------
# Dashboard
# ---------
## username for login - default: admin
username=your_user_name
## password for login - default: password
password=password
## jwt_token - default: ipm_ipm_ipm
jwt_token=your_jwt_token
```

## Contribute

Have a look at [CONTRIBUTING.md](https://github.com/iota-pay/iota-payment-module/blob/master/CONTRIBUTING.md).

## License

[The MIT License](https://github.com/iota-pay/iota-payment-module/blob/master/LICENSE.md)
