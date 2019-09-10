var paymentModule = require('..')

var address = "ZVIS9TDLJ9LRFAVPDYXTQEFUTVTPUXNUQCIZAXWHZ9VEXVKFIQSSJHNAJWKCLOYKPBYCSCCENPIHYBUACPOAVDQFPX"

paymentModule.payout(address, 5).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})