var config = require('nconf')
var utils = require('./utils')
var spotify = require('./spotify')

config.argv()
  .env()
  .file({ file: 'config.json' })
  .defaults({
    'adminChannel': 'music-admin',
    'standardChannel': 'music',
    'gongLimit': 3,
    'voteLimit': 3,
    'maxVolume': '75',
    'market': 'US',
    'blacklist': [],
    'searchLimit': 7
  })

var adminChannel = config.get('adminChannel')
var standardChannel = config.get('standardChannel')
var gongLimit = config.get('gongLimit')
var voteLimit = config.get('voteLimit')
var token = config.get('token')
var maxVolume = config.get('maxVolume')
var market = config.get('market')
var blacklist = config.get('blacklist')
var clientId = config.get('client_id')
var clientSecret = config.get('client_secret')
var searchLimit = config.get('searchLimit')
if (!Array.isArray(blacklist)) {
  blacklist = blacklist.replace(/\s*(,|^|$)\s*/g, '$1').split(/\s*,\s*/)
}

/* Initialize Sonos */
var SONOS = require('sonos')
var Sonos = SONOS.Sonos
var sonos = new Sonos(config.get('sonos'))

if (market !== 'US') {
  sonos.setSpotifyRegion(SONOS.SpotifyRegion.EU)
  utils.log('Setting Spotify region to EU...')
  utils.log(market)
}

/* Initialize spotify */
spotify.init(clientId, clientSecret, market)

var gongCounter = 0
var gongLimitPerUser = 1
var gongScore = {}
var gongMessage = [
  'Is it really all that bad?',
  'Is it that distracting?',
  'How much is this worth to you?',
  'I agree. Who added this song anyway?',
  "Thanks! I didn't want to play this song in the first place...",
  "Look, I only played this song because it's my masters favourite.",
  'Good call!',
  'Would some harp music be better?'
]

var voteCounter = 0
var voteLimitPerUser = 1
var voteScore = {}
var gongBanned = false

var gongTrack = '' // What track was a GONG called on

const RtmClient = require('@slack/client').RtmClient
const RTM_EVENTS = require('@slack/client').RTM_EVENTS
const MemoryDataStore = require('@slack/client').MemoryDataStore

let slack = new RtmClient(token, {
  logLevel: 'error',
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true
})

/* Slack handlers */
slack.on('open', function () {
  var channel, group, id
  var channels = [standardChannel]
  var groups = []
  channels = (function () {
    var _ref, _results
    _ref = slack.channels
    _results = []
    for (id in _ref) {
      channel = _ref[id]
      if (channel.is_member) {
        _results.push('#' + channel.name)
      }
    }
    return _results
  })()

  groups = (function () {
    var _ref, _results
    _ref = slack.groups
    _results = []
    for (id in _ref) {
      group = _ref[id]
      if (group.is_open && !group.is_archived) {
        _results.push(group.name)
      }
    }
    return _results
  })()
  utils.log('Online!')
})

slack.on(RTM_EVENTS.MESSAGE, (message) => {
  let channel, channelError, channelName, errors, response, text, textError, ts, type, typeError, user, userName

  channel = slack.dataStore.getChannelGroupOrDMById(message.channel)

  response = ''
  type = message.type, ts = message.ts, text = message.text
  channelName = (channel != null ? channel.is_channel : void 0) ? '#' : ''
  channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL')
  userName = '<@' + message.user + '>'
  utils.log('Received: ' + type + ' ' + channelName + ' ' + userName + ' ' + ts + ' "' + text + '"')

  user = slack.dataStore.getUserById(message.user)
  let displayName = (user != null ? user.display_name : void 0) != null ? '@' + user.name : 'UNKNOWN_USER'
  if (user && user.is_bot) {
    _slackMessage('Sorry ' + userName + ', no bots allowed!', channel.id)
  }

  if (type !== 'message' || (text == null) || (channel == null)) {
    typeError = type !== 'message' ? 'unexpected type ' + type + '.' : null
    textError = text == null ? 'text was undefined.' : null
    channelError = channel == null ? 'channel was undefined.' : null
    errors = [typeError, textError, channelError].filter(function (element) {
      return element !== null
    }).join(' ')

    return utils.log('Could not respond. ' + errors)
  }

  if (blacklist.indexOf(userName) !== -1) {
    utils.log('User ' + userName + ' is blacklisted')
    _slackMessage('Nice try ' + userName + ", you're banned :)", channel.id)
    return false
  }

  var input = text.split(' ')
  var term = input[0].toLowerCase()
  var matched = true
  utils.log('term', term)
  switch (term) {
    case 'add':
      _add(input, channel, userName)
      break
    case 'addalbum':
      _addalbum(input, channel, userName)
      break
    case 'bestof':
      _bestof(input, channel, userName)
      break
    case 'append':
      _append(input, channel, userName)
      break
    case 'searchplaylist':
      _searchplaylist(input, channel)
      break
    case 'searchalbum':
      _searchalbum(input, channel)
      break
    case 'addplaylist':
      _addplaylist(input, channel)
      break
    case 'search':
      _search(input, channel, userName)
      break
    case 'current':
    case 'wtf':
      _currentTrack(channel)
      break
    case 'dong':
    case ':gong:':
    case 'gong':
      _gong(channel, userName)
      break
    case 'gongcheck':
      _gongcheck(channel, userName)
      break
    case 'vote':
      _vote(channel, userName)
      break
    case 'votecheck':
      _votecheck(channel, userName)
      break
    case 'list':
    case 'ls':
    case 'playlist':
      _showQueue(channel)
      break
    case 'volume':
      _getVolume(channel)
      break
    case 'count(list)':
      _countQueue(channel)
      break
    case 'status':
      _status(channel)
      break
    case 'help':
      _help(input, channel)
      break
    default:
      matched = false
      break
  }

  if (!matched && channel.name === adminChannel) {
    switch (term) {
      case 'next':
        _nextTrack(channel)
        break
      case 'gongplay':
        _gongplay(input, channel)
        break
      case 'stop':
        _stop(input, channel)
        break
      case 'flush':
        _flush(input, channel)
        break
      case 'play':
        _play(input, channel)
        break
      case 'pause':
        _pause(input, channel)
        break
      case 'playpause':
      case 'resume':
        _resume(input, channel)
        break
      case 'previous':
        _previous(input, channel)
        break
      case 'shuffle':
        _shuffle(input, channel)
        break
      case 'setvolume':
        _setVolume(input, channel, userName)
        break
      case 'blacklist':
        _blacklist(input, channel)
        break
      case 'test':
        _addToSpotifyPlaylist(input, channel)
        break
      default:
        break
    }
  }
})

slack.on('error', function (error) {
  return console.error('Error: ' + error)
})

slack.login()

function _slackMessage (message, id) {
  slack.sendMessage(message, id)
}

function _getVolume (channel) {
  sonos.getVolume().then(vol => {
    utils.log('The volume is: ', vol)
    _slackMessage('Volume is ' + vol + ' deadly dB _(ddB)_', channel.id)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _setVolume (input, channel, userName) {
  if (channel.name !== adminChannel) {
    return
  }

  var vol = input[1]

  if (isNaN(vol)) {
    _slackMessage('Nope.', channel.id)
  } else {
    vol = Number(vol)
    utils.log(vol)
    if (vol > maxVolume) {
      _slackMessage("That's a bit extreme, " + userName + '... lower please.', channel.id)
    } else {
      sonos.setVolume(vol).then(vol => {
        utils.log('The volume is: ', vol)
      }).catch(err => { utils.log('Error occurred %j', err) })
      _getVolume(channel)
    }
  }
}

function _getQueue () {
  var res = null
  sonos.getQueue(function (err, result) {
    if (err) {
      utils.log(err)
    }
    res = result
  })
  return (res)
}

function _countQueue (channel, cb) {
  sonos.getQueue(function (err, result) {
    if (err) {
      if (cb) {
        return (err, null)
      }
      utils.log(err)
      _slackMessage('Error getting queue length', channel.id)
    } else {
      if (cb) {
        return cb(null)
      }
      _slackMessage(result.total, channel.id)
    }
  })
}

function _showQueue (channel) {
  sonos.getQueue().then(result => {
    utils.log('Current queue: ', JSON.stringify(result, null, 2))
    _status(channel, function (state) {
      utils.log('DEBUG: _showQueue, got state = ' + state)
    })
    _currentTrack(channel, function (err, track) {
      if (!result) {
        utils.log(result)
        _slackMessage('Seems like the queue is empty... Have you tried adding a song?!', channel.id)
      }
      if (err) {
        utils.log(err)
      }
      var message = 'Total tracks in queue: ' + result.total + '\n' +
      '===================='
      result.items.map(
        function (item, i) {
          message += '\n'
          if (item['title'] === track.title) {
            message += ':notes: ' + '_#' + i + '_ *Title:* ' + item['title']
            message += ' *Artist:* ' + item['artist']
          } else {
            message += '>_#' + i + '_ *Title:* ' + item['title']
            message += ' *Artist:* ' + item['artist']
          }
        }
      )
      _slackMessage(message, channel.id)
    })
  }).catch(err => {
    utils.log('Error fetch queue:', err)
  })
}

function _gong (channel, userName) {
  utils.log('_gong...')
  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      utils.log(err)
    }
    utils.log('_gong > track: ' + track)

    // NOTE: The gongTrack is checked in _currentTrackTitle() so we
    // need to let that go through before checking if gong is banned.
    if (gongBanned) {
      _slackMessage('Sorry ' + userName + ', the people have voted and this track cannot be gonged...', channel.id)
      return
    }

    // Get message
    utils.log('gongMessage.length: ' + gongMessage.length)
    var ran = Math.floor(Math.random() * gongMessage.length)
    var randomMessage = gongMessage[ran]
    utils.log('gongMessage: ' + randomMessage)

    // Need a delay before calling the rest
    if (!(userName in gongScore)) {
      gongScore[userName] = 0
    }

    if (gongScore[userName] >= gongLimitPerUser) {
      _slackMessage('Are you trying to cheat, ' + userName + '? DENIED!', channel.id)
    } else {
      if (userName in voteScore) {
        _slackMessage('Having regrets, ' + userName + "? We're glad you came to your senses...", channel.id)
      }

      gongScore[userName] = gongScore[userName] + 1
      gongCounter++
      _slackMessage(randomMessage + ' This is GONG ' + gongCounter + '/' + gongLimit + ' for ' + track, channel.id)
      if (gongCounter >= gongLimit) {
        _slackMessage('The music got GONGED!!', channel.id)
  //      _gongplay('play', channel)
        _nextTrack(channel, true)
        gongCounter = 0
        gongScore = {}
      }
    }
  })
}

function _vote (channel, userName) {
  utils.log('_vote...')
  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      utils.log(err)
    }
    utils.log('_vote > track: ' + track)

    if (!(userName in voteScore)) {
      voteScore[userName] = 0
    }

    if (voteScore[userName] >= voteLimitPerUser) {
      _slackMessage('Are you trying to cheat, ' + userName + '? DENIED!', channel.id)
    } else {
      if (userName in gongScore) {
        _slackMessage('Changed your mind, ' + userName + '? Well, ok then...', channel.id)
      }

      voteScore[userName] = voteScore[userName] + 1
      voteCounter++
      _slackMessage('This is VOTE ' + voteCounter + '/' + voteLimit + ' for ' + track, channel.id)
      if (voteCounter >= voteLimit) {
        _slackMessage('This track is now immune to GONG! (just this once)', channel.id)
        voteCounter = 0
        voteScore = {}
        gongBanned = true
      }
    }
  })
}

function _votecheck (channel, userName) {
  utils.log('_votecheck...')

  _currentTrackTitle(channel, function (err, track) {
    utils.log('_votecheck > track: ' + track)

    _slackMessage('VOTE is currently ' + voteCounter + '/' + voteLimit + ' for ' + track, channel.id)
    var voters = Object.keys(voteScore)
    if (voters.length > 0) {
      _slackMessage('Voted by ' + voters.join(','), channel.id)
    }
    if (err) {
      utils.log(err)
    }
  })
}

function _gongcheck (channel, userName) {
  utils.log('_gongcheck...')

  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      utils.log(err)
    }
    utils.log('_gongcheck > track: ' + track)

    _slackMessage('GONG is currently ' + gongCounter + '/' + gongLimit + ' for ' + track, channel.id)
    var gongers = Object.keys(gongScore)
    if (gongers.length > 0) {
      _slackMessage('Gonged by ' + gongers.join(','), channel.id)
    }
  })
}

function _previous (input, channel) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.previous(function (err, previous) {
    utils.log(err, previous)
  })
}

function _help (input, channel) {
  var message = 'Current commands!\n' +
        ' ===  ===  ===  ===  ===  ===  === \n' +
        '`add` _text_ : Add song to the queue and start playing if idle. Will start with a fresh queue.\n' +
        '`addalbum` _text_ : Add an album to the queue and start playing if idle. Will start with a fresh queue.\n' +
        '`bestof` : _text_ : Add topp 10 tracks by the artist\n' +
        '`status` : show current status of Sonos\n' +
        '`current` : list current track\n' +
        '`search` _text_ : search for a track, does NOT add it to the queue\n' +
        '`searchalbum` _text_ : search for an album, does NOT add it to the queue\n' +
        '`searchplaylist` _text_ : search for a playlist, does NOT add it to the queue\n' +
        '`addplaylist` _text_ : Add a playlist to the queue and start playing if idle. Will start with a fresh queue.\n' +
        '`append` _text_ : Append a song to the previous playlist and start playing the same list again.\n' +
        '`gong` : The current track is bad! ' + gongLimit + ' gongs will skip the track\n' +
        '`gongcheck` : How many gong votes there are currently, as well as who has gonged.\n' +
        '`vote` : The current track is great! ' + voteLimit + ' votes will prevent the track from being gonged\n' +
        '`volume` : view current volume\n' +
        '`list` : list current queue\n'

  if (channel.name === adminChannel) {
    message += '------ ADMIN FUNCTIONS ------\n' +
            '`flush` : flush the current queue\n' +
            '`setvolume` _number_ : sets volume\n' +
            '`play` : play track\n' +
            '`stop` : stop life\n' +
            '`pause` : pause life\n' +
            '`resume` : resume after pause\n' +
            '`next` : play next track\n' +
            '`previous` : play previous track\n' +
            '`shuffle` : shuffle playlist\n' +
            '`blacklist` : show users on blacklist\n' +
            '`blacklist add @username` : add `@username` to the blacklist\n' +
            '`blacklist del @username` : remove `@username` from the blacklist\n'
  }
  message += ' ===  ===  === = ZenMusic@GitHub  ===  ===  === ==\n'
  _slackMessage(message, channel.id)
}

function _play (input, channel, state) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.play().then(result => {
    _status(channel, state)
    utils.log('Started playing - ', result)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _playInt (input, channel) {
  sonos.play().then(result => {
    utils.log('playInt, started playing', result)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _stop (input, channel, state) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.stop().then(result => {
    _status(channel, state)
    utils.log('Stoped playing - ', result)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _pause (input, channel, state) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.pause().then(result => {
    _status(channel, state)
    utils.log('Pause playing - ', result)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _resume (input, channel, state) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.play().then(result => {
    setTimeout(() => _status(channel, state), 500)
    utils.log('Resume playing - ', result)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _flush (input, channel) {
  if (channel.name !== adminChannel) {
    return
  }
  sonos.flush().then(result => {
    utils.log('Flushed queue: ', JSON.stringify(result, null, 2))
    _slackMessage('Sonos queue is clear.', channel.id)
  }).catch(err => {
    utils.log('Error flushing queue: ', err)
  })
}

function _flushInt (input, channel) {
  sonos.flush().then(result => {
    utils.log('Flushed queue: ', JSON.stringify(result, null, 2))
  }).catch(err => {
    utils.log('Error flushing queue: ', err)
  })
}

function _shuffle (input, channel, byPassChannelValidation) {
  if (channel.name !== adminChannel && !byPassChannelValidation) {
    return
  }
  sonos.setPlayMode('shuffle', function (err, nexted) {
    if (err) {
      utils.log(err, nexted)
    } else {
      _slackMessage('Shuffling the playlist.', channel.id)
    }
  })
}

function _gongplay (input, channel) {
  sonos.queueNext('spotify:track:6Yy5Pr0KvTnAaxDBBISSDe').then(success => {
    utils.log('GongPlay!!')
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _nextTrack (channel, byPassChannelValidation) {
  if (channel.name !== adminChannel && !byPassChannelValidation) {
    return
  }
  sonos.next().then(success => {
    utils.log('_nextTrack > Playing Netx track.. ')
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _currentTrack (channel, cb, err) {
  sonos.currentTrack().then(track => {
    utils.log('Got current track: ', track)
    if (err) {
      utils.log(err, track)
      if (cb) {
        return cb(err, null)
      }
    } else {
      if (cb) {
        return cb(null, track)
      }

      utils.log(track)
      var fmin = '' + Math.floor(track.duration / 60)
      fmin = fmin.length === 2 ? fmin : '0' + fmin
      var fsec = '' + track.duration % 60
      fsec = fsec.length === 2 ? fsec : '0' + fsec

      var pmin = '' + Math.floor(track.position / 60)
      pmin = pmin.length === 2 ? pmin : '0' + pmin
      var psec = '' + track.position % 60
      psec = psec.length === 2 ? psec : '0' + psec

      var message = `We're rocking out to *${track.artist}* - *${track.title}* (${pmin}:${psec}/${fmin}:${fsec})`
      _slackMessage(message, channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _currentTrackTitle (channel, cb) {
  sonos.currentTrack().then(track => {
    utils.log('Got current track %j', track)

    var _track = ''

    _track = track.title
    utils.log('_currentTrackTitle > title: ' + _track)
    utils.log('_currentTrackTitle > gongTrack: ' + gongTrack)

    if (gongTrack !== '') {
      if (gongTrack !== _track) {
        utils.log('_currentTrackTitle > different track, reset!')
        gongCounter = 0
        gongScore = {}
        gongBanned = false
        voteCounter = 0
        voteScore = {}
      } else {
        utils.log('_currentTrackTitle > gongTrack is equal to _track')
      }
    } else {
      utils.log('_currentTrackTitle > gongTrack is empty')
    }
    gongTrack = _track
    utils.log('_currentTrackTitle > last step, got _track as: ' + _track)

    cb(null, _track)
  }).catch(err => { utils.log('Error occurred: ', err) })
}

function _add (input, channel, userName) {
  var data, message = spotify.searchSpotify(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  utils.log('Adding track:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)

    if (state === 'stopped') {
      utils.log('State:', state, ' - flushing')
      _flushInt(input, channel)
      _addToSpotify(userName, uri, albumImg, trackName, channel)
      utils.log('Adding track:', trackName)
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      utils.log('State:', state, ' - playing...')
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      utils.log('State:', state, ' - telling them no...')
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel.name === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      utils.log('State:', state, ' - no idea what to do')

      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _addalbum (input, channel, userName) {
  var data, message = spotify.searchSpotifyAlbum(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }

  var uri = data.albums.items[0].uri
  var trackName = data.albums.items[0].artists[0].name + ' - ' + data.albums.items[0].name
  var albumImg = data.albums.items[0].images[2].url

  utils.log('Adding album:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotify(userName, uri, albumImg, trackName, channel)
      utils.log('Adding album:', trackName)
      // Start playing the queue automatically.
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel.name === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _append (input, channel, userName) {
  var data, message = spotify.searchSpotify(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  utils.log('Adding track:', trackName, 'with UID:', uri)

  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)

    if (state === 'stopped') {
      utils.log('State:', state, ' - apending')
      _addToSpotify(userName, uri, albumImg, trackName, channel)
      utils.log('Adding track:', trackName)
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      utils.log('State:', state, ' - adding...')
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      utils.log('State:', state, ' - telling them no...')
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel.name === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      utils.log('State:', state, ' - no idea what to do')

      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _search (input, channel, userName) {
  var data, message = spotify.searchSpotify(input, channel, userName, searchLimit)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }

  var trackNames = []
  for (var i = 1; i <= data.tracks.items.length; i++) {
    var trackName = data.tracks.items[i - 1].artists[0].name + ' - ' + data.tracks.items[i - 1].name

    trackNames.push(trackName)
  }

  // Print the result...
  var message = userName +
        ', I found the following track(s):\n```\n' +
        trackNames.join('\n') +
        '\n```\nIf you want to play it, use the `add` command..\n'

  _slackMessage(message, channel.id)
}

function _searchplaylist (input, channel) {
    var data, message = spotify.searchSpotifyPlaylist(input, channel, userName, searchLimit)
    if (message) {
        _slackMessage(message, channel.id)
    }
    if (!data) {
        return
    }
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
}

function _searchalbum (input, channel) {
    var data, message = spotify.searchSpotifyAlbum(input, channel, userName, searchLimit)
    if (message) {
        _slackMessage(message, channel.id)
    }
    if (!data) {
        return
    }
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
        _slackMessage(message, channel.id)
    }
}

// FIXME - misnamed s/ add to sonos, appears funcionally identical to _addToSpotifyPlaylist
function _addToSpotify (userName, uri, albumImg, trackName, channel, cb) {
  utils.log('DEBUG addToSpotify', uri)
  sonos.queue(uri).then(result => {
    utils.log('Queued the following: ', result)

    var message = ''
    utils.log('DEBUG queue:')
    var queueLength = result.FirstTrackNumberEnqueued
    utils.log('queueLength', queueLength)
    message = 'Sure ' +
            userName +
            ', Added ' +
             trackName +
            ' to the queue!\n' +
            albumImg +
            '\nPosition in queue is ' +
            queueLength

    _slackMessage(message, channel.id)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel.id)
    utils.log('Error occurred: ', err)
  })
}

function _addToSpotifyPlaylist (userName, uri, trackName, channel, cb) {
  utils.log('TrackName:', trackName)
  utils.log('URI:', uri)
  sonos.queue(uri).then(result => {
    utils.log('Queued the following: ', result)

    var message = ''
    var queueLength = result.FirstTrackNumberEnqueued
    message = 'Sure ' +
            userName +
            ', Added "' +
            trackName +
            '" to the queue!\n' +
            '\nPosition in queue is ' +
            queueLength

    _slackMessage(message, channel.id)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel.id)
    utils.log('Error occurred: ', err)
  })
}

function _addToSpotifyArtist (userName, trackName, spid, channel) {
  utils.log('DEBUG _addToSpotifyArtist spid:' + spid)
  utils.log('DEBUG _addToSpotifyArtist trackName:' + trackName)

  var uri = 'spotify:artistTopTracks:' + spid
  sonos.queue(uri).then(result => {
    utils.log('Queued the following: ', result)

    var message = ''
    var queueLength = result.FirstTrackNumberEnqueued
    utils.log('queueLength', queueLength)
    message = 'Sure ' +
            userName +
            ' Added 10 most popular tracks by "' +
            trackName +
            '" to the queue!\n' +
            '\nPosition in queue is ' +
            queueLength

    _slackMessage(message, channel.id)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel.id)
    utils.log('Error occurred: ', err)
  })
}

function _addplaylist (input, channel, userName) {
  var data, message = spotify.searchSpotifyPlaylist(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }

  var trackNames = []
  for (var i = 1; i <= data.playlists.items.length; i++) {
    var uri = data.playlists.items[i - 1].uri
    var trackName = data.playlists.items[i - 1].name
    trackNames.push(trackName)
  }

  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotifyPlaylist(userName, uri, trackName, channel)
      utils.log('Adding playlist:', trackName)
      // Start playing the queue automatically.
      _playInt('play', channel)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotifyPlaylist(userName, uri, trackName, channel)
    } else if (state === 'paused') {
      _addToSpotifyPlaylist(userName, uri, trackName, channel, function () {
        if (channel.name === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _bestof (input, channel, userName) {
  var data, message = spotify.searchSpotifyArtist(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel.id)
  }
  if (!data) {
    return
  }
  utils.log('DEBUG Result in _bestof: ', JSON.stringify(data, null, 2))
  var trackNames = []
  for (var i = 1; i <= data.artists.items.length; i++) {
    var spid = data.artists.items[0].id
    var trackName = data.artists.items[i - 1].name
    trackNames.push(trackName)
  }
  utils.log('DEBUG _bestof spid:' + spid)
  utils.log('DEBUG _bestof trackName:' + trackName)

  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotifyArtist(userName, trackName, spid, channel)
      utils.log('Adding artist:', trackName)
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotifyArtist(userName, trackName, spid, channel)
    } else if (state === 'paused') {
      _addToSpotifyArtist(userName, trackName, spid, channel, function () {
        if (channel.name === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel.id)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel.id)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel.id)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel.id)
    }
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _status (channel, state) {
  sonos.getCurrentState().then(state => {
    utils.log('Got current state: ', state)
    _slackMessage("Sonos state is '" + state + "'", channel.id)
  }).catch(err => { utils.log('Error occurred %j', err) })
}

function _blacklist (input, channel) {
  if (channel.name !== adminChannel) {
    return
  }

  var action = ((input[1]) ? input[1] : '')
  var slackUser = ((input[2]) ? slack.dataStore.getUserById(input[2].slice(2, -1)) : '')

  if (input[2] !== '' && typeof slackUser !== 'undefined') {
    var username = '@' + slackUser.name
  } else if (input[2] !== '') {
    var message = 'The user ' + (input[2]) + ' is not a valid Slack user.'
  }

  if (action === '') {
    message = 'The following users are blacklisted:\n```\n' + blacklist.join('\n') + '\n```'
  } else if (typeof username !== 'undefined') {
    if (action === 'add') {
      var i = blacklist.indexOf(username)
      if (i === -1) {
        blacklist.push(username)
        message = 'The user ' + username + ' has been added to the blacklist.'
      } else {
        message = 'The user ' + username + ' is already on the blacklist.'
      }
    } else if (action === 'del') {
      if (i !== -1) {
        blacklist.splice(i, 1)
        message = 'The user ' + username + ' has been removed from the blacklist.'
      } else {
        message = 'The user ' + username + ' is not on the blacklist.'
      }
    } else {
      message = 'Usage: `blacklist add|del @username`'
    }
  }
  _slackMessage(message, channel.id)
}

// testing
 _search('weezer', 'channel', 'rob')
