'use strict'

const config = require('nconf')
const urllibsync = require('@jsfeb26/urllib-sync')
const winston = require('winston')

config.argv()
  .env()
  .file({ file: 'config.json' })
  .defaults({
    'logLevel': 'info',
  })

const logLevel = config.get('logLevel')

module.exports = function (config) {
    if (module.exports.instance) {
        return module.exports.instance
    }

    config = config || {}
    let accessToken
    let accessTokenExpires

    /* Initialize Logger */
    const logger = winston.createLogger({
        level: logLevel,
        format: winston.format.json(),
        transports: [
            new winston.transports.Console({format: winston.format.combine(winston.format.colorize(), winston.format.simple())})
        ]
    });

    function _getAccessToken() {
        if (accessToken && accessTokenExpires > new Date().getTime()) {
            return accessToken
        }

        let getToken = urllibsync.request('https://accounts.spotify.com/api/token', {
            method: 'POST',
            data: {'grant_type': 'client_credentials'},
            headers: {'Authorization': 'Basic ' + (Buffer.from(config.clientId + ':' + config.clientSecret).toString('base64'))}
        })
        let tokendata = JSON.parse(getToken.data.toString())
        accessTokenExpires = new Date().getTime() + (tokendata.expires_in - 10) * 1000
        accessToken = tokendata.access_token
        return accessToken
    }

    module.exports.instance = {

        // TODO - refactor duplicate boilerplate below
        // TODO - move messaging to index, get rid of channel/username args
        searchSpotify: function (input, channel, userName, limit) {
            let accessToken = _getAccessToken()
            if (!accessToken) {
                return false
            }

            var query = ''
            for (var i = 1; i < input.length; i++) {
                query += encodeURIComponent(input[i])
                // TODO - join
                if (i < input.length - 1) {
                    query += ' '
                }
            }

            var getapi = urllibsync.request(
                'https://api.spotify.com/v1/search?q=' +
                query +
                '&type=track&limit=' +
                limit +
                '&market=' +
                config.market +
                '&access_token=' +
                accessToken
            )

            var data = JSON.parse(getapi.data.toString())

            config.logger.debug(data)
            if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
                var message = 'Sorry ' + userName + ', I could not find that track :('
                data = null
            }

            return [data, message]
        },

        searchSpotifyPlaylist: function (input, channel, userName, limit) {
            let accessToken = _getAccessToken()
            if (!accessToken) {
                return false
            }

            var query = ''
            for (var i = 1; i < input.length; i++) {
                query += encodeURIComponent(input[i])
                if (i < input.length - 1) {
                    query += ' '
                }
            }

            var getapi = urllibsync.request(
                'https://api.spotify.com/v1/search?q=' +
                query +
                '&type=playlist&limit=' +
                limit +
                '&market=' +
                config.market +
                '&access_token=' +
                accessToken
            )

            var data = JSON.parse(getapi.data.toString())
            logger.debug(data)
            if (!data.playlists || !data.playlists.items || data.playlists.items.length === 0) {
                var message = 'Sorry ' + userName + ', I could not find that playlist :('
                data = null
            }

            return [data, message]
        },

        searchSpotifyAlbum: function (input, channel, userName, limit) {
            let accessToken = _getAccessToken()
            if (!accessToken) {
                return false
            }

            var query = ''
            for (var i = 1; i < input.length; i++) {
                query += encodeURIComponent(input[i])
                if (i < input.length - 1) {
                    query += ' '
                }
            }

            var getapi = urllibsync.request(
                'https://api.spotify.com/v1/search?q=' +
                query +
                '&type=album&limit=' +
                limit +
                '&market=' +
                config.market +
                '&access_token=' +
                accessToken
            )

            var data = JSON.parse(getapi.data.toString())
            config.logger.debug(data)
            if (!data.albums || !data.albums.items || data.albums.items.length === 0) {
                var message = 'Sorry ' + userName + ', I could not find that album :('
                data = null
            }

            return [data, message]
        },

        searchSpotifyArtist: function (input, channel, userName, limit) {
            let accessToken = _getAccessToken()
            if (!accessToken) {
                return false
            }

            var query = ''
            for (var i = 1; i < input.length; i++) {
                query += encodeURIComponent(input[i])
                if (i < input.length - 1) {
                    query += ' '
                }
            }

            var getapi = urllibsync.request(
                'https://api.spotify.com/v1/search?q=' +
                query +
                '&type=artist&limit=' +
                limit +
                '&market=' +
                config.market +
                '&access_token=' +
                accessToken
            )

            var data = JSON.parse(getapi.data.toString())
            config.logger.debug(data)
            if (!data.artists || !data.artists.items || data.artists.items.length === 0) {
                var message = 'Sorry ' + userName + ', I could not find that artist :('
                data = null
            }

            return [data, message]
        }
    }

    return module.exports.instance
}