var paymentModule = require('..')

var address = "IXVTDFRYNSC9NHQAVMGZEXOEGVEOW9PCUDVPHEJLVAZLT9WSDAKWJLZDHVATULETMKZAAZUJDHIQDOBCWRQUM9OWM9"

paymentModule.payout.send({ address: address, value: 1 })
.then(result => {
  console.log("result", result)
})
.catch(err => {
  console.log(err)
})