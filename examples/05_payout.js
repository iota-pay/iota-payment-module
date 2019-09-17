var paymentModule = require('..')

var address = "EWMMXUHPUS9INHIEAZPSAURRGQAFIIBBMGSHYSQPE9CNWNAOTXZIFAZOUR9IOUHIRCXMOELTAMYCTTEXCCYZGLUUKD"

paymentModule.payout.send({ address: address, value: 1 })
.then(result => {
  console.log("result", result)
})
.catch(err => {
  console.log(err)
})