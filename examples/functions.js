var paymentModule = require('..')

var address = "TJABBTNPPPSSYLRJNQJUQDLONJEQKZYSNHZEVH9UZYIENIBOQEXJF99IERXOMQRRRQOLTUVQQA9EYMAQXGYFCMIMXW"

// paymentModule.payout.sendPayout(address, 0).then(result => {
//     console.log("result", result)
// }, error => {
//     console.log("error", error)
// })

let id
paymentModule.payout.createPayout({address: address, value: 1}).then(result => {
  console.log("result", result)
  // console.log(result.id);
  id = result.id
}, error => {
  console.log("error", error)
})

// paymentModule.paymentHandler.start()


// let payout = {
//   "id": 'CARLOS',
//   "txhash": 'CARLOS',
// }


// paymentModule.payout.updatePayout(payout).then(result => {
//   console.log("result", result)
// }, error => {
//   console.log("error", error)
// })

// paymentModule.payout.getOpenpayouts().then(payouts => {
//   if (typeof payouts !== 'undefined' && payouts.length > 0) {
//     let payoutdata = payouts[0]
//     // paymentModule.payout.sendPayout(payoutdata)
//   } else {
//     throw 'No open payouts'
//   }
// })