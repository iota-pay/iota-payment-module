const db = require('./Database')

let currentIndex = db.get('keyIndex').value()
let currentPayoutIndex = db.get('payoutIndex').value()

if (Number.isInteger(currentIndex)) {
  console.log(
    `Database loaded. Current address index: ${currentIndex}, payout index: ${currentPayoutIndex}`
  )
} else {
  // setup database
  currentIndex = 0
  currentPayoutIndex = 0
  db.set('keyIndex', currentIndex).write()
  db.set('payoutIndex', currentPayoutIndex).write()
  console.log('Database created.')
}

const getNextIndex = function() {
  increaseIndex()
  return currentIndex
}
const getCurrentIndex = function() {
  return currentIndex
}

const increaseIndex = function() {
  currentIndex = currentIndex + 1
  db.set('keyIndex', currentIndex).write()
}

const getCurrentPayoutIndex = function() {
  return currentPayoutIndex
}

const setPayoutIndex = function(newIndex) {
  currentPayoutIndex = newIndex
  db.set('payoutIndex', newIndex).write()
}

module.exports = {
  getNextIndex,
  getCurrentIndex,
  getCurrentPayoutIndex,
  setPayoutIndex
}
