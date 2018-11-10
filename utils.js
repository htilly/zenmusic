var timestamp = require('console-timestamp')

module.exports = {
    log: function (...args) {
        console.log('MM-DD hh:mm:ss:iii  '.timestamp, ...args)
    }
}