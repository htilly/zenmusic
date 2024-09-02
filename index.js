const buildNumber = ('69')
const config = require('nconf')
const winston = require('winston')
const Spotify = require('./spotify')
const utils = require('./utils')
const process = require('process')
const parseString = require('xml2js').parseString
const http = require('http')

config.argv()
  .env()
  .file({
    file: 'config/config.json'
  })
  .defaults({
    adminChannel: 'music-admin',
    standardChannel: 'music',
    gongLimit: 3,
    voteLimit: 3,
    maxVolume: '75',
    market: 'US',
    blacklist: [],
    searchLimit: 7,
    logLevel: 'info'
  })

const adminChannel = config.get('adminChannel')
const gongLimit = config.get('gongLimit')
const voteLimit = config.get('voteLimit')
const token = config.get('token')
const maxVolume = config.get('maxVolume')
const market = config.get('market')
const clientId = config.get('spotifyClientId')
const clientSecret = config.get('spotifyClientSecret')
const searchLimit = config.get('searchLimit')
const logLevel = config.get('logLevel')
const sonosIp = config.get('sonos')

let blacklist = config.get('blacklist')
if (!Array.isArray(blacklist)) {
  blacklist = blacklist.replace(/\s*(,|^|$)\s*/g, '$1').split(/\s*,\s*/)
}

/* Initialize Logger */
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    })
  ]
})

/* Initialize Sonos */
const SONOS = require('sonos')
const Sonos = SONOS.Sonos
const sonos = new Sonos(sonosIp)

if (market !== 'US') {
  sonos.setSpotifyRegion(SONOS.SpotifyRegion.EU)
  logger.info('Setting Spotify region to EU...')
  logger.info('Market is: ' + market)
}

/* Initialize Spotify instance */
const spotify = Spotify({
  clientId: clientId,
  clientSecret: clientSecret,
  market: market,
  logger: logger
})

let gongCounter = 0
let gongScore = {}
const gongLimitPerUser = 1
const gongMessage = [
  'Is it really all that bad?',
  'Is it that distracting?',
  'How much is this worth to you?',
  'I agree. Who added this song anyway?',
  "Thanks! I didn't want to play this song in the first place...",
  "Look, I only played this song because it's my masters favourite.",
  'Good call!',
  'Would some harp music be better?'
]

let voteCounter = 0
const voteLimitPerUser = 1
let voteScore = {}
let gongBanned = false
let gongTrack = '' // What track was a GONG called on

const {
  RTMClient
} = require('@slack/rtm-api')

const rtm = new RTMClient(token, {
  logLevel: 'error',
  dataStore: false,
  autoReconnect: true,
  autoMark: true
})

rtm.on('message', (event) => {
  console.log(event)

  const {
    type,
    ts
  } = event

  const text = event.text
  logger.info(event.text)
  const channelName = event.channel
  const channel = event.channel

  logger.info(event.channel)

  const userName = '<@' + event.user + '>'
  logger.info(event.user)

  logger.info('Received: ' + type + ' ' + channelName + ' ' + userName + ' ' + ts + ' "' + text + '"')

  if (type !== 'message' || (text == null) || (channel == null)) {
    const typeError = type !== 'message' ? 'unexpected type ' + type + '.' : null
    const textError = text == null ? 'text was undefined.' : null
    const channelError = channel == null ? 'channel was undefined.' : null
    const errors = [typeError, textError, channelError].filter(function (element) {
      return element !== null
    }).join(' ')

    logger.error('Could not respond. ' + errors)
    return false
  }

  processInput(text, channel, userName)
});

(async () => {
  await rtm.start()
})()

rtm.on('error', function (error) {
  logger.error('Error: ' + error)
})

function processInput (text, channel, userName) {
  var input = text.split(' ')
  var term = input[0].toLowerCase()
  var matched = true
  logger.info('term: ' + term)

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
    case 'upnext':
      _upNext(channel)
      break
    case 'volume':
      _getVolume(channel)
      break
    case 'size':
    case 'count':
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

  if (!matched && channel === adminChannel) {
    switch (term) {
      case 'debug':
        _debug(channel)
        break
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
      case 'remove':
        _removeTrack(input, channel)
        break
      case 'thanos':
      case 'snap':
        _purgeHalfQueue(input, channel)
        break
      default:
    }
  }
}

function _slackMessage (message, id) {
  if (rtm.connected) {
    rtm.sendMessage(message, id)
  } else {
    logger.info(message)
  }
}

function _getVolume (channel) {
  sonos.getVolume().then(vol => {
    logger.info('The volume is: ' + vol)
    _slackMessage('Volume is ' + vol + ' deadly dB _(ddB)_', channel)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _setVolume (input, channel, userName) {
  if (channel !== adminChannel) {
    return
  }

  var vol = input[1]

  if (isNaN(vol)) {
    _slackMessage('Nope.', channel)
  } else {
    vol = Number(vol)
    logger.info('Volume is: ' + vol)
    if (vol > maxVolume) {
      _slackMessage("That's a bit extreme, " + userName + '... lower please.', channel)
    } else {
      sonos.setVolume(vol).then(vol => {
        logger.info('The volume is: ' + vol)
      }).catch(err => {
        logger.error('Error occurred: ' + err)
      })
      _getVolume(channel)
    }
  }
}

/*
function _getQueue () {
  var res = null
  sonos.getQueue(function (err, result) {
    if (err) {
      logger.error(err)
    }
    res = result
  })
  return (res)
}
*/

function _countQueue (channel, cb) {
  sonos.getQueue().then(result => {
    if (cb) {
      return cb(result.total)
    }
    _slackMessage(`${result.total} songs in the queue`, channel)
  }).catch(err => {
    logger.error(err)
    if (cb) {
      return cb(null, err)
    }
    _slackMessage('Error getting queue length', channel)
  })
}

function _showQueue (channel) {
  sonos.getQueue().then(result => {
    logger.info('Current queue: ' + JSON.stringify(result, null, 2))
    _status(channel, function (state) {
      logger.info('_showQueue, got state = ' + state)
    })
    _currentTrack(channel, function (err, track) {
      if (!result) {
        logger.debug(result)
        _slackMessage('Seems like the queue is empty... Have you tried adding a song?!', channel)
      }
      if (err) {
        logger.error(err)
      }
      var message = 'Total tracks in queue: ' + result.total + '\n====================\n'
      const tracks = []

      result.items.map(
        function (item, i) {
          if (item.title === track.title) {
            tracks.push(':notes: ' + '_#' + i + '_ ' + item.title + ' by ' + item.artist)
          } else {
            tracks.push('>_#' + i + '_ ' + item.title + ' by ' + item.artist)
          }
        }
      )
      for (var i in tracks) {
        message += tracks[i] + '\n'
        if (i > 0 && Math.floor(i % 100) === 0) {
          _slackMessage(message, channel)
          message = ''
        }
      }
      if (message) {
        _slackMessage(message, channel)
      }
    })
  }).catch(err => {
    logger.error('Error fetch queue: ' + err)
  })
}

function _upNext (channel) {
  sonos.getQueue().then(result => {
    logger.debug('Current queue: ' + JSON.stringify(result, null, 2))

    _currentTrack(channel, function (err, track) {
      if (!result) {
        logger.debug(result)
        _slackMessage('Seems like the queue is empty... Have you tried adding a song?!', channel)
      }
      if (err) {
        logger.error(err)
      }
      var message = 'Recent and upcoming tracks\n====================\n'
      let tracks = []
      let currentIndex = track.queuePosition
      result.items.map(
        function (item, i) {
          if (i === currentIndex) {
            currentIndex = i
            tracks.push(':notes: ' + '_#' + i + '_ ' + item.title + ' by ' + item.artist)
          } else {
            tracks.push('>_#' + i + '_ ' + item.title + ' by ' + item.artist)
          }
        }
      )
      tracks = tracks.slice(Math.max(currentIndex - 5, 0), Math.min(currentIndex + 20, tracks.length))
      for (var i in tracks) {
        message += tracks[i] + '\n'
      }
      if (message) {
        _slackMessage(message, channel)
      }
    })
  }).catch(err => {
    logger.error('Error fetching queue: ' + err)
  })
}

function _gong (channel, userName) {
  logger.info('_gong...')
  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      logger.error(err)
    }
    logger.info('_gong > track: ' + track)

    // NOTE: The gongTrack is checked in _currentTrackTitle() so we
    // need to let that go through before checking if gong is banned.
    if (gongBanned) {
      _slackMessage('Sorry ' + userName + ', the people have voted and this track cannot be gonged...', channel)
      return
    }

    // Get message
    logger.info('gongMessage.length: ' + gongMessage.length)
    var ran = Math.floor(Math.random() * gongMessage.length)
    var randomMessage = gongMessage[ran]
    logger.info('gongMessage: ' + randomMessage)

    // Need a delay before calling the rest
    if (!(userName in gongScore)) {
      gongScore[userName] = 0
    }

    if (gongScore[userName] >= gongLimitPerUser) {
      _slackMessage('Are you trying to cheat, ' + userName + '? DENIED!', channel)
    } else {
      if (userName in voteScore) {
        _slackMessage('Having regrets, ' + userName + "? We're glad you came to your senses...", channel)
      }

      gongScore[userName] = gongScore[userName] + 1
      gongCounter++
      _slackMessage(randomMessage + ' This is GONG ' + gongCounter + '/' + gongLimit + ' for ' + track, channel)
      if (gongCounter >= gongLimit) {
        _slackMessage('The music got GONGED!!', channel)
        // _gongplay('play', channel)
        _nextTrack(channel, true)
        gongCounter = 0
        gongScore = {}
      }
    }
  })
}

function _vote (channel, userName) {
  logger.info('_vote...')
  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      logger.error(err)(err)
    }
    logger.info('_vote > track: ' + track)

    if (!(userName in voteScore)) {
      voteScore[userName] = 0
    }

    if (voteScore[userName] >= voteLimitPerUser) {
      _slackMessage('Are you trying to cheat, ' + userName + '? DENIED!', channel)
    } else {
      if (userName in gongScore) {
        _slackMessage('Changed your mind, ' + userName + '? Well, ok then...', channel)
      }

      voteScore[userName] = voteScore[userName] + 1
      voteCounter++
      _slackMessage('This is VOTE ' + voteCounter + '/' + voteLimit + ' for ' + track, channel)
      if (voteCounter >= voteLimit) {
        _slackMessage('This track is now immune to GONG! (just this once)', channel)
        voteCounter = 0
        voteScore = {}
        gongBanned = true
      }
    }
  })
}

function _votecheck (channel, userName) {
  logger.info('_votecheck...')

  _currentTrackTitle(channel, function (err, track) {
    logger.info('_votecheck > track: ' + track)

    _slackMessage('VOTE is currently ' + voteCounter + '/' + voteLimit + ' for ' + track, channel)
    var voters = Object.keys(voteScore)
    if (voters.length > 0) {
      _slackMessage('Voted by ' + voters.join(','), channel)
    }
    if (err) {
      logger.error(err)
    }
  })
}

function _gongcheck (channel, userName) {
  logger.info('_gongcheck...')

  _currentTrackTitle(channel, function (err, track) {
    if (err) {
      logger.error(err)
    }
    logger.info('_gongcheck > track: ' + track)

    _slackMessage('GONG is currently ' + gongCounter + '/' + gongLimit + ' for ' + track, channel)
    var gongers = Object.keys(gongScore)
    if (gongers.length > 0) {
      _slackMessage('Gonged by ' + gongers.join(','), channel)
    }
  })
}

function _previous (input, channel) {
  if (channel !== adminChannel) {
    return
  }
  sonos.previous(function (err, previous) {
    logger.error(err + ' ' + previous)
  })
}

function _help (input, channel) {
  var message = 'Current commands!\n' +
    ' ===  ===  ===  ===  ===  ===  === \n' +
    '`add` *text* : Add song to the queue and start playing if idle. Will start with a fresh queue.\n' +
    '`addalbum` *text* : Add an album to the queue and start playing if idle. Will start with a fresh queue.\n' +
    '`bestof` : *text* : Add topp 10 tracks by the artist\n' +
    '`status` : show current status of Sonos\n' +
    '`current` : list current track\n' +
    '`search` *text* : search for a track, does NOT add it to the queue\n' +
    '`searchalbum` *text* : search for an album, does NOT add it to the queue\n' +
    '`searchplaylist` *text* : search for a playlist, does NOT add it to the queue\n' +
    '`addplaylist` *text* : Add a playlist to the queue and start playing if idle. Will start with a fresh queue.\n' +
    '`append` *text* : Append a song to the previous playlist and start playing the same list again.\n' +
    '`gong` : The current track is bad! ' + gongLimit + ' gongs will skip the track\n' +
    '`gongcheck` : How many gong votes there are currently, as well as who has gonged.\n' +
    '`vote` : The current track is great! ' + voteLimit + ' votes will prevent the track from being gonged\n' +
    '`volume` : view current volume\n' +
    '`list` : list current queue\n'

  if (channel === adminChannel) {
    message += '------ ADMIN FUNCTIONS ------\n' +
      '`debug` : show debug info for Spotify, Node and Sonos\n' +
      '`flush` : flush the current queue\n' +
      '`remove` *number* : removes the track in the queue\n' +
      '`setvolume` *number* : sets volume\n' +
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
  _slackMessage(message, channel)
}

function _play (input, channel, state) {
  if (channel !== adminChannel) {
    return
  }
  sonos.selectQueue()
  sonos.play().then(result => {
    _status(channel, state)
    logger.info('Started playing - ' + result)
  }).catch(err => {
    logger.info('Error occurred: ' + err)
  })
}

function _playInt (input, channel) {
  sonos.selectQueue()
  sonos.play().then(result => {
    logger.info('playInt started playing' + result)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _stop (input, channel, state) {
  if (channel !== adminChannel) {
    return
  }
  sonos.stop().then(result => {
    _status(channel, state)
    logger.info('Stoped playing - ' + result)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _pause (input, channel, state) {
  if (channel !== adminChannel) {
    return
  }
  sonos.pause().then(result => {
    _status(channel, state)
    logger.info('Pause playing - ' + result)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _resume (input, channel, state) {
  if (channel !== adminChannel) {
    return
  }
  sonos.play().then(result => {
    setTimeout(() => _status(channel, state), 500)
    logger.info('Resume playing - ' + result)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _flush (input, channel) {
  if (channel !== adminChannel) {
    return
  }
  sonos.flush().then(result => {
    logger.info('Flushed queue: ' + JSON.stringify(result, null, 2))
    _slackMessage('Sonos queue is clear.', channel)
  }).catch(err => {
    logger.error('Error flushing queue: ' + err)
  })
}

function _flushInt (input, channel) {
  sonos.flush().then(result => {
    logger.info('Flushed queue: ' + JSON.stringify(result, null, 2))
  }).catch(err => {
    logger.error('Error flushing queue: ' + err)
  })
}

function _shuffle (input, channel, byPassChannelValidation) {
  if (channel !== adminChannel && !byPassChannelValidation) {
    return
  }
  sonos.setPlayMode('shuffle', function (err, nexted) {
    if (err) {
      logger.error(err + ' ' + nexted)
    } else {
      _slackMessage('Shuffling the playlist.', channel)
    }
  })
}

function _gongplay (input, channel) {
  sonos.queueNext('spotify:track:6Yy5Pr0KvTnAaxDBBISSDe').then(success => {
    //  sonos.play('spotify:track:6Yy5Pr0KvTnAaxDBBISSDe').then(success => {
    logger.info('GongPlay!!')
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _removeTrack (input, channel, byPassChannelValidation) {
  if (channel !== adminChannel && !byPassChannelValidation) {
    return
  }
  var trackNb = parseInt(input[1]) + 1
  sonos.removeTracksFromQueue(trackNb, 1).then(success => {
    logger.info('Removed track with index: ', trackNb)
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
  var message = 'Removed track with index: ' + input[1]
  _slackMessage(message, channel)
}

function _nextTrack (channel, byPassChannelValidation) {
  if (channel !== adminChannel && !byPassChannelValidation) {
    return
  }
  sonos.next().then(success => {
    logger.info('_nextTrack > Playing Netx track.. ')
  }).catch(err => {
    logger.error('Error occurred', err)
  })
}

function _currentTrack (channel, cb, err) {
  sonos.currentTrack().then(track => {
    logger.info('Got current track: ' + track)
    if (err) {
      logger.error(err + ' ' + track)
      if (cb) {
        return cb(err, null)
      }
    } else {
      if (cb) {
        return cb(null, track)
      }

      logger.info(track)
      var fmin = '' + Math.floor(track.duration / 60)
      fmin = fmin.length === 2 ? fmin : '0' + fmin
      var fsec = '' + track.duration % 60
      fsec = fsec.length === 2 ? fsec : '0' + fsec

      var pmin = '' + Math.floor(track.position / 60)
      pmin = pmin.length === 2 ? pmin : '0' + pmin
      var psec = '' + track.position % 60
      psec = psec.length === 2 ? psec : '0' + psec

      var message = `We're rocking out to *${track.artist}* - *${track.title}* (${pmin}:${psec}/${fmin}:${fsec})`
      _slackMessage(message, channel)
    }
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _currentTrackTitle (channel, cb) {
  sonos.currentTrack().then(track => {
    logger.info('Got current track ' + track)

    var _track = ''

    _track = track.title
    logger.info('_currentTrackTitle > title: ' + _track)
    logger.info('_currentTrackTitle > gongTrack: ' + gongTrack)

    if (gongTrack !== '') {
      if (gongTrack !== _track) {
        logger.info('_currentTrackTitle > different track, reset!')
        gongCounter = 0
        gongScore = {}
        gongBanned = false
        voteCounter = 0
        voteScore = {}
      } else {
        logger.info('_currentTrackTitle > gongTrack is equal to _track')
      }
    } else {
      logger.info('_currentTrackTitle > gongTrack is empty')
    }
    gongTrack = _track
    logger.info('_currentTrackTitle > last step, got _track as: ' + _track)

    cb(null, _track)
  }).catch(err => {
    logger.error('Error occurred: ' + err)
  })
}

function _add (input, channel, userName) {
  var [data, message] = spotify.searchSpotify(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  logger.info('Adding track:' + trackName + ' with UID: ' + uri)

  sonos.getCurrentState().then(state => {
    logger.info('Got current state: ' + state)

    if (state === 'stopped') {
      sonos.flush().then(result => {
        logger.info('Flushed queue: ' + JSON.stringify(result, null, 2))

        logger.info('State: ' + state + ' - flushing')
        _addToSpotify(userName, uri, albumImg, trackName, channel)
        logger.info('Adding track:' + trackName)
        setTimeout(() => _playInt('play', channel), 500)
      }).catch(err => {
        logger.error('Error flushing queue: ' + err)
      })
    } else if (state === 'playing') {
      logger.info('State: ' + state + ' - playing...')
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      logger.info('State: ' + state + ' - telling them no...')
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel)
        }
      })
    } else if (state === 'transitioning') {
      logger.info('State: ' + state + ' - no idea what to do')

      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel)
    }
  }).catch(err => {
    logger.error('Error occurred' + err)
  })
}

function _addalbum (input, channel, userName) {
  var [data, message] = spotify.searchSpotifyAlbum(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }

  var uri = data.albums.items[0].uri
  var trackName = data.albums.items[0].artists[0].name + ' - ' + data.albums.items[0].name
  var albumImg = data.albums.items[0].images[2].url

  logger.info('Adding album: ' + trackName + ' with UID:' + uri)

  sonos.getCurrentState().then(state => {
    logger.info('Got current state: ' + state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotify(userName, uri, albumImg, trackName, channel)
      logger.info('Adding album:' + trackName)
      // Start playing the queue automatically.
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel)
    }
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _append (input, channel, userName) {
  var [data, message] = spotify.searchSpotify(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }

  var uri = data.tracks.items[0].uri
  var albumImg = data.tracks.items[0].album.images[2].url
  var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name

  logger.info('Adding track: ' + trackName + ' with UID:' + uri)

  sonos.getCurrentState().then(state => {
    logger.info('Got current state: ' + state)

    if (state === 'stopped') {
      logger.info('State: ' + state + ' - apending')
      _addToSpotify(userName, uri, albumImg, trackName, channel)
      logger.info('Adding track:' + trackName)
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      logger.info('State: ' + state + ' - adding...')
      // Add the track to playlist...
      _addToSpotify(userName, uri, albumImg, trackName, channel)
    } else if (state === 'paused') {
      logger.info('State: ' + state + ' - telling them no...')
      _addToSpotify(userName, uri, albumImg, trackName, channel, function () {
        if (channel === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel)
        }
      })
    } else if (state === 'transitioning') {
      logger.info('State: ' + state + ' - no idea what to do')
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel)
    }
  }).catch(err => {
    logger.error('Error occurred' + err)
  })
}

function _search (input, channel, userName) {
  logger.info('_search ' + input)
  var [data, message] = spotify.searchSpotify(input, channel, userName, searchLimit)

  if (message) {
    _slackMessage(message, channel)
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
  message = userName +
    ', I found the following track(s):\n```\n' +
    trackNames.join('\n') +
    '\n```\nIf you want to play it, use the `add` command..\n'

  _slackMessage(message, channel)
}

function _searchplaylist (input, channel, userName) {
  var [data, message] = spotify.searchSpotifyPlaylist(input, channel, userName, searchLimit)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }
  logger.debug(data)
  if (data.playlists && data.playlists.items && data.playlists.items.length > 0) {
    var trackNames = []

    for (var i = 1; i <= data.playlists.items.length; i++) {
      var trackName = data.playlists.items[i - 1].name

      trackNames.push(trackName)
    }

    message = 'I found the following playlist(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addplaylist` command..\n'
    _slackMessage(message, channel)
  } else {
    message = 'Sorry could not find that playlist :('
    _slackMessage(message, channel)
  }
}

function _searchalbum (input, channel, userName) {
  var [data, message] = spotify.searchSpotifyAlbum(input, channel, userName, searchLimit)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }
  //    var data = JSON.parse(getapi.data.toString())
  logger.debug(data)
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

    message = 'I found the following album(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `addalbum` command..\n'
    _slackMessage(message, channel)
  }
}

// FIXME - misnamed s/ add to sonos, appears funcionally identical to _addToSpotifyPlaylist
// function _addToSpotify (userName, uri, albumImg, trackName, channel, cb) {
function _addToSpotify (userName, uri, albumImg, trackName, channel, cb) {
  logger.info('_addToSpotify ' + uri)
  sonos.queue(uri).then(result => {
    logger.info('Queued the following: ' + result)

    logger.info('queue:')
    var queueLength = result.FirstTrackNumberEnqueued
    logger.info('queueLength' + queueLength)
    var message = 'Sure ' +
      userName +
      ', Added ' +
      trackName +
      ' to the queue!\n' +
      albumImg +
      '\nPosition in queue is ' +
      queueLength

    _slackMessage(message, channel)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel)
    logger.error('Error occurred: ' + err)
  })
}

function _addToSpotifyPlaylist (userName, uri, trackName, channel, cb) {
  logger.info('TrackName:' + trackName)
  logger.info('URI:' + uri)
  sonos.queue(uri).then(result => {
    logger.info('Queued the following: ' + result)

    var queueLength = result.FirstTrackNumberEnqueued
    var message = 'Sure ' +
      userName +
      ', Added "' +
      trackName +
      '" to the queue!\n' +
      '\nPosition in queue is ' +
      queueLength

    _slackMessage(message, channel)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel)
    logger.error('Error occurred: ' + err)
  })
}

function _addToSpotifyArtist (userName, trackName, spid, channel) {
  logger.info('_addToSpotifyArtist spid:' + spid)
  logger.info('_addToSpotifyArtist trackName:' + trackName)

  var uri = 'spotify:artistTopTracks:' + spid
  sonos.queue(uri).then(result => {
    logger.info('Queued the following: ' + result)

    var queueLength = result.FirstTrackNumberEnqueued
    logger.info('queueLength' + queueLength)
    var message = 'Sure ' +
      userName +
      ' Added 10 most popular tracks by "' +
      trackName +
      '" to the queue!\n' +
      '\nPosition in queue is ' +
      queueLength

    _slackMessage(message, channel)
  }).catch(err => {
    _slackMessage('Error! No spotify account?', channel)
    logger.error('Error occurred: ' + err)
  })
}

function _addplaylist (input, channel, userName) {
  var [data, message] = spotify.searchSpotifyPlaylist(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel)
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
    logger.info('Got current state: ' + state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotifyPlaylist(userName, uri, trackName, channel)
      logger.info('Adding playlist:' + trackName)
      // Start playing the queue automatically.
      _playInt('play', channel)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotifyPlaylist(userName, uri, trackName, channel)
    } else if (state === 'paused') {
      _addToSpotifyPlaylist(userName, uri, trackName, channel, function () {
        if (channel === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel)
    }
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _bestof (input, channel, userName) {
  var [data, message] = spotify.searchSpotifyArtist(input, channel, userName, 1)
  if (message) {
    _slackMessage(message, channel)
  }
  if (!data) {
    return
  }
  logger.debug('Result in _bestof: ' + JSON.stringify(data, null, 2))
  var trackNames = []
  for (var i = 1; i <= data.artists.items.length; i++) {
    var spid = data.artists.items[0].id
    var trackName = data.artists.items[i - 1].name
    trackNames.push(trackName)
  }
  logger.info('_bestof spid:' + spid)
  logger.info('_bestof trackName:' + trackName)

  sonos.getCurrentState().then(state => {
    logger.info('Got current state: ' + state)

    if (state === 'stopped') {
      _flushInt(input, channel)
      _addToSpotifyArtist(userName, trackName, spid, channel)
      logger.info('Adding artist:' + trackName)
      setTimeout(() => _playInt('play', channel), 1000)
    } else if (state === 'playing') {
      // Add the track to playlist...
      _addToSpotifyArtist(userName, trackName, spid, channel)
    } else if (state === 'paused') {
      _addToSpotifyArtist(userName, trackName, spid, channel, function () {
        if (channel === adminChannel) {
          _slackMessage('Sonos is currently PAUSED. Type `resume` to start playing...', channel)
        }
      })
    } else if (state === 'transitioning') {
      _slackMessage("Sonos says it is 'transitioning'. We've got no idea what that means either...", channel)
    } else if (state === 'no_media') {
      _slackMessage("Sonos reports 'no media'. Any idea what that means?", channel)
    } else {
      _slackMessage("Sonos reports its state as '" + state + "'. Any idea what that means? I've got nothing.", channel)
    }
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _status (channel, state) {
  sonos.getCurrentState().then(state => {
    logger.info('Got current state: ' + state)
    _slackMessage("Sonos state is '" + state + "'", channel)
  }).catch(err => {
    logger.error('Error occurred ' + err)
  })
}

function _debug (channel) {
  var url = 'http://' + sonosIp + ':1400/xml/device_description.xml'

  xmlToJson(url, function (err, data) {
    if (err) {
      logger.error('Error occurred ' + err)
    }
    logger.info('BuildNumber of Slackonos: ', buildNumber)
    logger.info('Platform: ', process.platform)
    logger.info('Node version: ', process.version)
    logger.info('Node dependencies: ', process.versions)
    const nodeVersion = JSON.stringify(process.versions)

    //    logger.info(data.root.device)
    logger.info(data.root.device[0].modelDescription)
    logger.info(data.root.device[0].softwareVersion)
    logger.info(data.root.device[0].displayName)
    logger.info(data.root.device[0].hardwareVersion)
    logger.info(data.root.device[0].apiVersion)
    logger.info(data.root.device[0].roomName)
    logger.info(data.root.device[0].friendlyName)
    logger.info(data.root.device[0].modelNumber)
    logger.info(data.root.device[0].serialNum)
    logger.info(data.root.device[0].MACAddress)

    _slackMessage(
      '\n------------------------------' +
      '\n*Slackonos Info*' +
      '\n' +
      '\nBuildNumber:  ' + buildNumber +
      '\n------------------------------' +
      '\n*Spotify Info*' +
      '\n' +
      // '\nSpotify Status: ' + slackStatus +
      '\nMarket:  ' + market +
      '\n------------------------------' +
      '\n*Node Info*' +
      '\n' +
      '\nPlatform:  ' + process.platform +
      '\nNode version:  ' + process.version +
      '\nNode dependencies:  ' + nodeVersion +
      '\n------------------------------' +
      '\n*Sonos Info*' +
      '\n' +
      '\nFriendly Name:  ' + (data.root.device[0].friendlyName) +
      '\nRoom Name:  ' + (data.root.device[0].roomName) +
      '\nDisplay Name:  ' + (data.root.device[0].displayName) +
      '\nModel Description:  ' + (data.root.device[0].modelDescription) +
      '\nModelNumber:  ' + (data.root.device[0].modelNumber) +
      '\nSerial Number:  ' + (data.root.device[0].serialNum) +
      '\nMAC Address:  ' + (data.root.device[0].MACAddress) +
      '\nSW Version:  ' + (data.root.device[0].softwareVersion) +
      '\nHW Version:  ' + (data.root.device[0].hardwareVersion) +
      '\nAPI Version:  ' + (data.root.device[0].apiVersion) +
      '\n------------------------------', channel)
  })
}

// This function does not currectly work due to migration away from dataStore
function _blacklist (input, channel) {
  if (channel !== adminChannel) {
    return
  }

  var action = ((input[1]) ? input[1] : '')
  var slackUser = ((input[2]) ? input[2] : '')

  if (input[2] !== '' && typeof slackUser !== 'undefined') {
    var username = slackUser
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
  _slackMessage(message, channel)
}

function _purgeHalfQueue (input, channel) {
  sonos.getQueue().then(result => {
    let maxQueueIndex = parseInt(result.total)
    const halfQueueSize = Math.floor(maxQueueIndex / 2)
    for (let i = 0; i < halfQueueSize; i++) {
      const rand = utils.getRandomInt(0, maxQueueIndex)
      _removeTrack(rand, channel, function (success) {
        if (success) {
          maxQueueIndex--
        }
      })
    }
    const snapUrl = 'https://cdn3.movieweb.com/i/article/61QmlwoK2zbKcbLyrLncM3gPrsjNIb/738:50/Avengers-Infinity-War-Facebook-Ar-Mask-Thanos-Snap.jpg'
    _slackMessage(snapUrl + '\nThanos has restored balance to the playlist', channel)
  }).catch(err => {
    logger.error(err)
  })
}

// Function to parse XML to JSON

function xmlToJson (url, callback) {
  var req = http.get(url, function (res) {
    logger.info(req)
    var xml = ''
    res.on('data', function (chunk) { xml += chunk })
    res.on('error', function (e) { callback(e, null) })
    res.on('timeout', function (e) { callback(e, null) })
    res.on('end', function () { parseString(xml, function (e, result) { callback(null, result) }) })
  })
}

// Travis.
// Just making sure that is at least will build...

module.exports = function (number, locale) {
  return number.toLocaleString(locale)
}
