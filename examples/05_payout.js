var paymentModule = require('..')

var address = "USKSGFKPWVXD9EUOJXWNLVWG9FDTIPGBUYB9BQNMMUWIEOMFNDCCUKCJMEPRICBHZNRAIZFGNPK9GCGBYQAEWNJRMC"

paymentModule.payout.send({ address: address, value: 1 })
.then(result => {
  console.log("result", result)
})
.catch(err => {
  console.log(err)
})