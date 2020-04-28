const dotenv = require('dotenv').config()

const defaults = {
  configPath: './config',
  maxPaymentTime: 4320, //time until created paymentes aren't checked anymore in minutes (4320 = 3 days to pay, txs after that are ignored)
  socketOrigins: "['http://localhost:*', 'http://127.0.0.1:*']", //allowed origings for websockets
  network: 'comnet', // 'mainnet'
  value: 1, //default value for payments with the API
  minPaymentInterval: 10, //seconds in which an address can be requested via the API (one address every 10s)
  debug: 'basic', // 'full'
  maxBundleSize: 7,
  zmq: false, //zmq to check for payments
  zmqNode: '',
  fastButRisky: false, //allow payment confirmation before tx confirmation, funds may never reach the address
  wereAddressSpentCheck: true, // false
  db: 'lowdb', // 'mongodb'
  //mongodb must be installed to use it
  mongodbUrl: 'mongodb://127.0.0.1:27017/',
  //comnet settings
  comnetMwm: 10,
  comnetNodes: ['https://nodes.comnet.thetangle.org:443'],
  comnetExplorerTxLink: 'https://comnet.thetangle.org/transaction/',
  //mainnet settings
  mainnetMwm: 14,
  mainnetNodes: [
    'https://nodes.thetangle.org:443',
    'https://community.tanglebay.org',
    'https://node02.iotatoken.nl:443',
  ],
  mainnetExplorerTxLink: 'https://thetangle.org/transaction/',
}

let e = process.env

let config = {
  socketOrigins: e.socketOrigins || defaults.socketOrigins,
  network: e.network || defaults.network,
  minPaymentInterval: e.minPaymentInterval || defaults.minPaymentInterval,
  debug: e.debug || defaults.debug,
  zmq: e.zmq || defaults.zmq,
  fastButRisky: e.fastButRisky || defaults.fastButRisky,
  db: e.db || defaults.db,
  wereAddressSpentCheck: defaults.wereAddressSpentCheck,
}

if(config.db == 'mongodb'){
  config.mongodbUrl = e.mongodbUrl || defaults.mongodbUrl
}

if (config.network == 'comnet') {
  config.mwm = defaults.comnetMwm
  config.explorerTxLink = defaults.comnetExplorerTxLink
  config.iotaNodes = defaults.comnetNodes
}

if (config.network == 'mainnet') {
  config.mwm = defaults.mainnetMwm
  config.explorerTxLink = defaults.mainnetExplorerTxLink
  config.iotaNodes = defaults.mainnetNodes
}

//if custom explorerTxLink
if (typeof e.explorerTxLink != 'undefined') {
  config.explorerTxLink = e.explorerTxLink
}

//if custom value
if (typeof e.value != 'undefined') {
  config.value = JSON.parse(e.value)
} else {
  config.value = defaults.value
}

//if custom maxBundleSize
if (typeof e.maxBundleSize != 'undefined') {
  if (!Number.isInteger(parseInt(e.maxBundleSize))) {
    throw 'Invalid maxBundleSize'
  }
  if (e.maxBundleSize < 4) {
    throw 'Minimum maxBundleSize is 4'
  }
  config.maxBundleSize = JSON.parse(e.maxBundleSize)
} else {
  config.maxBundleSize = defaults.maxBundleSize
}

//if custom maxPaymentTime
if (typeof e.maxPaymentTime != 'undefined') {
  if (!Number.isInteger(parseInt(e.maxPaymentTime))) {
    throw 'Invalid maxPaymentTime'
  }
  config.maxPaymentTime = JSON.parse(e.maxPaymentTime)
} else {
  config.maxPaymentTime = defaults.maxPaymentTime
}

//if custom nodes
if (typeof e.iotaNodes != 'undefined') {
  config.iotaNodes = JSON.parse(e.iotaNodes)
}

//if custom mwm
if (typeof e.mwm != 'undefined') {
  if (
    Number.isInteger(parseInt(e.mwm)) &&
    parseInt(e.mwm) >= 0 &&
    parseInt(e.mwm) < 14
  ) {
    config.mwm = parseInt(e.mwm)
  } else {
    throw 'Invalid mwm'
  }
}

if (e.wereAddressSpentCheck == 'false') {
  config.wereAddressSpentCheck = false
}

if(config.zmq == 'true' || config.fastButRisky == 'true'){
  if (config.zmq == 'true' && typeof e.zmqNode == 'undefined' && defaults.zmqNode == '') {
    throw 'No zmqNode provided'
  }
  config.zmqNode =  e.zmqNode || defaults.zmqNode
}

//check node urls
for (node of config.iotaNodes) {
  if (!validURL(node)) {
    throw 'Invalid node url: ' + node
  }
}

function validURL(str) {
  var pattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    'http://localhost|https://localhost|' + // allow localhost
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$',
    'i'
  ) // fragment locator
  return !!pattern.test(str)
}

if (config.debug == 'full') {
  console.log('Config', config)
}

//add seed at the end so it's not in the log
if (!/[A-Z+9]{81}/.test(e.seed) || e.seed.length != 81) {
  throw 'Invalid seed'
} else {
  config.seed = e.seed
}

module.exports = config
