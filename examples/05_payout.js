var paymentModule = require('..')

var address = "BUCJHLHHOYKQLLOMNTTEZEKAAEMRCSXNKELOXSDTZXOL9AZFYDPKFGARU9OB9FGXFPKHCSIAMBMQHMOT9XTOHTZLXB"

paymentModule.payout.send({ address: address, value: 1 })
.then(result => {
  console.log("result", result)
})
.catch(err => {
  console.log(err)
})