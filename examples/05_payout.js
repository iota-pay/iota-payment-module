var paymentModule = require('..')

var address = "RRXNYBITPFVRVCTUYMKVE9GJSYOOQPUOAFODNLVJALNATYKMXSKFHXBMDTCIBJABIGVBESXIUNLXQECTYDWEPWCJPX"

paymentModule.payout.createPayout({address: address, value: 1}).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})