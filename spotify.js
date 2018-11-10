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

    _searchSpotifyPlaylist: function  (input, channel, userName, limit) {
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
            _slackMessage('Sorry ' + userName + ', I could not find that playlist :(', channel.id)
            return
        }

        return data
    },

    _searchSpotifyAlbum: function  (input, channel, userName, limit) {
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
            _slackMessage('Sorry ' + userName + ', I could not find that album :(', channel.id)
            return
        }

        return data
    },

    _searchSpotifyArtist: function  (input, channel, userName, limit) {
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
            _slackMessage('Sorry ' + userName + ', I could not find that artist :(', channel.id)
            return
        }

        return data
    },

    _searchplaylist: function  (input, channel) {
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

        var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=playlist&limit=3&market=' + _market + '&access_token=' + accessToken)
        var data = JSON.parse(getapi.data.toString())
        utils.log(data)
        if (data.playlists && data.playlists.items && data.playlists.items.length > 0) {
            var trackNames = []

            for (var i = 1; i <= data.playlists.items.length; i++) {
                //  var spid = data.playlists.items[i - 1].id
                //  var uri = data.playlists.items[i - 1].uri
                //  var external_url = data.playlists.items[i - 1].external_urls.spotify
                var trackName = data.playlists.items[i - 1].name

                trackNames.push(trackName)
            }

            var message = 'I found the following playlist(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addplaylist` command..\n'
            slack.sendMessage(message, channel.id)
        } else {
            slack.sendMessage('Sorry could not find that playlist :(', channel.id)
        }
    },

    _searchalbum: function  (input, channel) {
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

        var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=album&limit=3&market=' + _market + '&access_token=' + accessToken)
        var data = JSON.parse(getapi.data.toString())
        utils.log(data)
        if (data.albums && data.albums.items && data.albums.items.length > 0) {
            var trackNames = []

            for (var i = 1; i <= data.albums.items.length; i++) {
                //  var spid = data.albums.items[i - 1].id
                //  var uri = data.albums.items[i - 1].uri
                //  var external_url = data.albums.items[i - 1].external_urls.spotify
                //           var trackName = data.albums.items[i-1].name;
                var trackName = data.albums.items[i - 1].artists[0].name + ' - ' + data.albums.items[i - 1].name

                trackNames.push(trackName)
            }

            var message = 'I found the following album(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addalbum` command..\n'
            slack.sendMessage(message, channel.id)
        } else {
            slack.sendMessage('Sorry could not find that album :(', channel.id)
        }
    },
}