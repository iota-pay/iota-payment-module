var paymentModule = require('..')

let payoutObject = {
  //required
  address: 'HW99PKRDWBUCCWLEQDONQXW9AXQHZAABYEKWSEFYAUIQWWCLVHAUJEQAZJACAGPZBZSQJIOUXRYYEXWZCXXOAJMZVY', 
  value: 1, 
  //optional
  message: 'Example message',
  tag: 'TRYTETAG',
  //indexes for input addresses, only in special cases required
  // starIndex: 0,
  // endIndex: 1
}
paymentModule.payout.send(payoutObject)
.then(result => {
  console.log("result", result)
})
.catch(err => {
  console.log(err)
})