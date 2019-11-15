const fs = require('fs-extra')
const { red, cyan, bold } = require('colorette')
const { URL } = require('url')

module.exports.loadConfig = loadConfig

function loadConfig(program, options) {
    let argv = {
        ...options,
        version: program.version()
    }
    let configFile = argv['configFile'] || './config.json'

    try {
        const file = fs.readFileSync(configFile)

        // Use flags with priority over config file
        const config = JSON.parse(file)
        argv = { ...config, ...argv }
    } catch (err) {
        // If config file was specified, but it doesn't exist, stop with error message
        if (typeof argv['configFile'] !== 'undefined') {
            if (!fs.existsSync(configFile)) {
                console.log(red(bold('ERR')), 'Config file ' + configFile + ' doesn\'t exist.')
                process.exit(1)
            }
        }

        // If the file exists, but parsing failed, stop with error message
        if (fs.existsSync(configFile)) {
            console.log(red(bold('ERR')), 'config file ' + configFile + ' couldn\'t be parsed: ' + err)
            process.exit(1)
        }

        // Legacy behavior - if config file does not exist, start with default
        // values, but an info message to create a config file.
        console.log(cyan(bold('TIP')), 'create a config.json: `$ iotapay init`')
    }

    return argv
}
