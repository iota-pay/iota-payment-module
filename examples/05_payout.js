var paymentModule = require('..')

var address = "FDAMKPQTGRVIRWYIVDTAJSPBLKWA9OHLYPKBGMUFFMLAPQNAGBMUPOXC9KMLHAKRDMBTRBEE9ALBHQTVWJNAHYXBTC"

paymentModule.payout(address, 1).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})