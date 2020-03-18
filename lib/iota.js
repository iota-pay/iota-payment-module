const {
  composeAPI,
  FailMode,
  RandomWalkStrategy,
  SuccessMode
} = require('@iota/client-load-balancer')
const config = require('./config.js')

let nodes = []
for (node of config.iotaNodes) {
  nodes.push({
    provider: node,
    depth: 3,
    mwm: config.mwm
  })
}

const iota = composeAPI({
  nodeWalkStrategy: new RandomWalkStrategy(nodes),
  successMode: SuccessMode.keep,
  failMode: FailMode.all,
  timeoutMs: 40000,
  tryNodeCallback: node => {
    if (config.debug == 'full') {
      console.log(`Trying node ${node.provider}`)
    }
  },
  failNodeCallback: (node, err) => {
    if (config.debug == 'full') {
      console.log(`Failed node ${node.provider}, ${err.message}`)
    }
  }
})

module.exports = iota
