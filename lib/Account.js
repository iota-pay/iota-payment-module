const db = require('./Database')

let currentIndex = db.get('keyIndex').value()

if (Number.isInteger(currentIndex)) {
  console.log('Database loaded. Current index: ' + currentIndex)
} else {
  // setup database
  currentIndex = 0
  db.set('keyIndex', currentIndex).write()
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

module.exports = {
  getNextIndex,
  getCurrentIndex
}
