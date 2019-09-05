var paymentModule = require('..')

var address = "CA9ORAYHQBZBQCAZCINQMPR9NCEJMXLGI9HBPOMKFLUSLJ9TWTROHIQYSQKDYJEVA9IIVNMKMHTQRLZAXFLWVOZPEB"

paymentModule.sendPayout(address).then(result => {
    console.log("result", result)
}, error => {
    console.log("error", error)
})