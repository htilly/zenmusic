var timestamp = require('console-timestamp')

// TODO - log levels, probably an existing module for this
module.exports = {
    log: function (...args) {
        console.log('MM-DD hh:mm:ss:iii  '.timestamp, ...args)
    }
}