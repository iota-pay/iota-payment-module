var paymentModule = require('..')

var address = "ht"

paymentModule.payout.send({address: address, value: 1}).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})
// .catch(e => {
//   console.log(e)})