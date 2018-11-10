var urllibsync = require('urllib-sync')
var urlencode = require('urlencode')
var utils = require('./utils')

var _clientId
var _clientSecret
var _market

var accessToken
var accessTokenExpires

function _getAccessToken (channelid) {
    if (accessToken && accessTokenExpires > new Date().getTime()) {
        return accessToken
    }

    let getToken = urllibsync.request('https://accounts.spotify.com/api/token', {
        method: 'POST',
        data: { 'grant_type': 'client_credentials' },
        headers: {'Authorization': 'Basic ' + (new Buffer(_clientId + ':' + _clientSecret).toString('base64'))}
    })
    let tokendata = JSON.parse(getToken.data.toString())
    accessTokenExpires = new Date().getTime() + (tokendata.expires_in -10) * 1000
    accessToken = tokendata.access_token
    return accessToken
}

module.exports = {

    init: function(clientId, clientSecret, market) {
        _clientId = clientId
        _clientSecret = clientSecret
        _market = market
    },

    // TODO - refactor duplicate boilerplate below
    // TODO - move messaging to index, get rid of channel/username args
    searchSpotify: function  (input, channel, userName, limit) {
        let accessToken = _getAccessToken(channel.id)
        if (!accessToken) {
            return false
        }

        var query = ''
        for (var i = 1; i < input.length; i++) {
            query += urlencode(input[i])
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
            _market +
            '&access_token=' +
            accessToken
        )

        var data = JSON.parse(getapi.data.toString())

        utils.log(data)
        if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
            var message = 'Sorry ' + userName + ', I could not find that track :('
        }

        return data, message
    },

    searchSpotifyPlaylist: function  (input, channel, userName, limit) {
        let accessToken = _getAccessToken(channel.id)
        if (!accessToken) {
            return false
        }

        var query = ''
        for (var i = 1; i < input.length; i++) {
            query += urlencode(input[i])
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
            _market +
            '&access_token=' +
            accessToken
        )

        var data = JSON.parse(getapi.data.toString())
        utils.log(data)
        if (!data.playlists || !data.playlists.items || data.playlists.items.length === 0) {
            var message = 'Sorry ' + userName + ', I could not find that playlist :('
        }

        return data, message
    },

    searchSpotifyAlbum: function  (input, channel, userName, limit) {
        let accessToken = _getAccessToken(channel.id)
        if (!accessToken) {
            return false
        }

        var query = ''
        for (var i = 1; i < input.length; i++) {
            query += urlencode(input[i])
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
            _market +
            '&access_token=' +
            accessToken
        )

        var data = JSON.parse(getapi.data.toString())
        utils.log(data)
        if (!data.albums || !data.albums.items || data.albums.items.length === 0) {
            var message = 'Sorry ' + userName + ', I could not find that album :('
        }

        return data, message
    },

    searchSpotifyArtist: function  (input, channel, userName, limit) {
        let accessToken = _getAccessToken(channel.id)
        if (!accessToken) {
            return false
        }

        var query = ''
        for (var i = 1; i < input.length; i++) {
            query += urlencode(input[i])
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
            _market +
            '&access_token=' +
            accessToken
        )

        var data = JSON.parse(getapi.data.toString())
        utils.log(data)
        if (!data.artists || !data.artists.items || data.artists.items.length === 0) {
            var message = 'Sorry ' + userName + ', I could not find that artist :('
        }

        return data, message
    }

}