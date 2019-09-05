var paymentModule = require('..')

var address = "V9CZIHBVILMYD99BVSFCXVETAII9N9GFZSENJTDO9FZGVMIJCYYBWAQLOXIRUQTPQJGBTECZURROZTIGD"

paymentModule.sendPayout(address).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})