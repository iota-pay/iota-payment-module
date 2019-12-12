const {
  composeAPI,
  FailMode,
  RandomWalkStrategy,
  SuccessMode
} = require('@iota/client-load-balancer')
const dotenv = require('dotenv')
dotenv.config()

const iota = composeAPI({
  nodeWalkStrategy: new RandomWalkStrategy([
    {
      provider: process.env.IOTANODE,
      depth: 3,
      mwm: 14
    },
    {
      provider: process.env.FALLBACKNODE,
      depth: 3,
      mwm: 14
    }
  ]),
  successMode: SuccessMode.keep,
  failMode: FailMode.all,
  timeoutMs: 40000,
  tryNodeCallback: node => {
    if (process.env.debug == 'full') {
      console.log(`Trying node ${node.provider}`)
    }
  },
  failNodeCallback: (node, err) => {
    if (process.env.debug == 'full') {
      console.log(`Failed node ${node.provider}, ${err.message}`)
    }
  }
})

module.exports = iota
