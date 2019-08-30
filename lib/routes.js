module.exports = createRoutes

const {createPayment, getPayments} = require('./payments.js')

function createRoutes(app, mount) {

    app.get(mount, function (request, response) {
        getPayments().then((payments) => {
            response.send(payments)
        })
    });

    app.post(mount, function (request, response) {
        var body = request.body
   
        createPayment(body).then((payment) => {
            // send reponse with address.
            response.send({
                message: "Payment created. Please pay xxx iota to provided address.",
                payment: payment
            })
        })
    });
}
