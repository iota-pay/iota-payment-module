var paymentModule = require('..')

let payoutObject = {
  //required
  address: 'IKTYKKCZFZZECSFIJYWYSUUTXCIBNIFPFSPGUIUUAYONDYUSHEZVQBNPDYUTDMTNTHBLABCYYLZKLGIVCINGBALQVX', 
  value: 0, 
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