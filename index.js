var Sonos = require('sonos').Sonos
var urllibsync = require('urllib-sync');
var urlencode = require('urlencode');
var fs = require('fs');
var config = require('nconf');
var Entities = require('html-entities').AllHtmlEntities;

config.argv()
  .env()
  .file({ file: 'config.json' })
  .defaults({
    'adminChannel':    'music-admin',
    'standardChannel': 'music',
    'maxVolume':       '75',
    'market':          'US',
    'blacklist':       []
  });

var adminChannel = config.get('adminChannel');
var standardChannel = config.get('standardChannel');
var sonos = new Sonos(config.get('sonos'));
var token = config.get('token');
var maxVolume = config.get('maxVolume');
var market = config.get('market');
var blacklist = config.get('blacklist');
var apiKey = config.get('apiKey');
if(!Array.isArray(blacklist)) {
    blacklist = blacklist.replace(/\s*(,|^|$)\s*/g, "$1").split(/\s*,\s*/);
}

var gongCounter = 0;
var gongLimit = 3;
var gongLimitPerUser = 1;
var gongScore = {};
var gongMessage = ["Is it really all that bad??", "Is it that distracting??", "Your eardrums are going to combust if this continues playing??", "Would some harp music be better??"];

var voteVictory = 3;
var voteLimit = 1;
var votes = {};

var gongTrack = ""; // What track was a GONG called on

// UGLY hack to get it working on Heroku
// Uncomment the bellow line if you are running in Heruko


/*

var http = require('http');

http.createServer(function(request, response) {
  var body = [];
  request.on('data', function(chunk) {
    body.push(chunk);
  }).on('end', function() {
    body = Buffer.concat(body).toString();
    response.end(body);
  });
}).listen(process.env.PORT || 5000);

*/


const RtmClient = require('@slack/client').RtmClient;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;
const MemoryDataStore = require('@slack/client').MemoryDataStore;

let slack = new RtmClient(token, {
  logLevel: 'error',
  dataStore: new MemoryDataStore(),
  autoReconnect: true,
  autoMark: true
});

slack.on('open', function() {
    var channel, channels, group, groups, id, messages, unreads;
    channels = [standardChannel];
    groups = [];
//   unreads = slack.getUnreadCount();
    channels = (function() {
        var _ref, _results;
        _ref = slack.channels;
        _results = [];
        for (id in _ref) {
            channel = _ref[id];
            if (channel.is_member) {
                _results.push("#" + channel.name);
            }
        }
        return _results;
    })();

    groups = (function() {
        var _ref, _results;
        _ref = slack.groups;
        _results = [];
        for (id in _ref) {
            group = _ref[id];
            if (group.is_open && !group.is_archived) {
                _results.push(group.name);
            }
        }
        return _results;
    })();

//    console.log("Welcome to Slack. You are @" + slack.self + " of " + slack.team);
//    console.log('You are in: ' + channels.join(', '));
//    console.log('As well as: ' + groups.join(', '));
//    messages = unreads === 1 ? 'message' : 'messages';
 //   var channel = slack.getChannelByName(standardChannel);
    var message = ":notes: " + "Im back!!" + "\n";
    // slack.sendMessage(message);

    return console.log("Starting...");

});

slack.on(RTM_EVENTS.MESSAGE, (message) => {
   let channel, channelError, channelName, errors, response, text, textError, ts, type, typeError, user, userName;

    channel = slack.dataStore.getChannelGroupOrDMById(message.channel);
    user = slack.dataStore.getUserById(message.user);
    response = '';
    type = message.type, ts = message.ts, text = message.text;
    channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';
    channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
    userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";
    console.log("Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"");
    if (type === 'message' && (text != null) && (channel != null)) {

        if (blacklist.indexOf(userName) !== -1) {
            console.log('User ' + userName + ' is blacklisted');
            slack.sendMessage("Nice try " + userName + ", you're banned :)", channel.id)
            return false;

        } else {

            var input = text.split(' ');
            var term = input[0].toLowerCase();
            console.log('term', term);
            switch(term) {
                case 'add':
                    _add(input, channel);
                break;
                case 'search':
                    _search(input, channel);
                break;
                case 'append':
                    _append(input, channel);
                break;
                case 'next':
                    _nextTrack(channel);
                break;
                case 'gongPlay':
                    _gongPlay(input, channel);
                break;
                case 'stop':
                    _stop(input, channel);
                break;
                case 'flush':
                    _flush(input, channel);
                break;
                case 'play':
                    _play(input, channel);
                break;
                case 'pause':
                    _pause(input, channel);
                break;
                case 'playpause':
                    _playpause(input, channel);
                break;
                case 'help':
                    _help(input, channel);
                break;
                case 'dong':
                case 'gong':
                    _gong(channel, userName);
                break;
                case 'gongcheck':
                    _gongcheck(channel, userName);
                break;
                case 'ungong':
                    _ungong(channel, userName);
                break;
                case 'say':
                    // _say(input, channel);
                break;
                case 'current':
                    _currentTrack(channel);
                break;
                case 'vote':
                    _vote(text, channel, userName);
                break;
                case 'previous':
                    _previous(input, channel);
                break;
                case 'list':
                case 'ls':
                case 'playlist':
                    _showQueue(channel);
                break;
                case 'volume':
                    _getVolume(channel);
                break;
                case 'setvolume':
                    _setVolume(input, channel);
                break;
                case 'status':
                    _status(channel);
                break;
                case 'blacklist':
                    _blacklist(input, channel);
                break;
                default:
                break;
            }

        } // end if blacklist

    } else {
        typeError = type !== 'message' ? "unexpected type " + type + "." : null;
        textError = text == null ? 'text was undefined.' : null;
        channelError = channel == null ? 'channel was undefined.' : null;
        errors = [typeError, textError, channelError].filter(function(element) {
            return element !== null;
        }).join(' ');
        return console.log("Could not respond. " + errors);
  }
});

slack.on('error', function(error) {
    return console.error("Error: " + error);
});

slack.login();



function _getVolume(channel) {

    sonos.getVolume(function(err, vol) {
        console.log(err, vol);
        slack.sendMessage('Vol is ' + vol + ' deadly dB _(ddB)_', channel.id);
    });
}

function _setVolume(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }

    var vol = input[1];

    if(isNaN(vol)) {
        slack.sendMessage('Nope.', channel.id);
        return;
    } else {
        vol = Number(vol);
        console.log(vol);
        if(vol > maxVolume) {
            slack.sendMessage('You also could have tinnitus _(say: tih-neye-tus)_', channel.id);
        } else {
            sonos.setVolume(vol, function(err, data) {
                _getVolume(channel);
            });
        }
    }

}

function _getQueue() {
    var res = null;
   sonos.getQueue(function (err, result) {
        res =  result;
    });
    return res;
}

function _showQueue(channel, cb) {
   sonos.getQueue(function (err, result) {
        if (err) {
            if(cb) {
                return (err, null);
            }
            console.log(err)
            slack.sendMessage('Couldn\'t fetch the queue', channel.id);

        } else {
            if(cb) {
                return cb(null, result.items);
            }
            _currentTrack(channel, function(err, track) {
                var message = "Total tracks in queue: " + result.total + "\n"
                + "====================="
                result.items.map(
                    function(item, i){
                        message += "\n";
                        if(item['title'] === track.title) {
                message += ":notes: " + "_#" + i + "_ *Title:* " + item['title'];
                message += " *Artist:* " + item['artist'];
                        } else {
                            message += ">_#" + i + "_ *Title:* " + item['title'];
                            message += " *Artist:* " + item['artist'];
                        }
                    }
                )
                slack.sendMessage(message, channel.id);
            });
        }
    });
}

// Need to track what song has had a GONG called
// If the GONG was called on the previous song, reset

function _gong(channel, userName) {

  console.log("_gong...");

    _currentTrackTitle(channel, function(err, track) {
        console.log("_gong > track: " + track);

        // Get message
        console.log("gongMessage.length: " + gongMessage.length);
        var ran = Math.floor(Math.random() * gongMessage.length);
        console.log("gongMessage > ran: " + ran);
        console.log("gongMessage > gongMessage: " + gongMessage);
        var randomMessage = gongMessage[ran];
        console.log("gongMessage: " + randomMessage);

        // Need a delay before calling the rest
        if(!(userName in gongScore)) {
            gongScore[userName] = 1
            gongCounter++;
            slack.sendMessage(randomMessage + " Oh well.. This is GONG " + gongCounter + " out of " + gongLimit + " for " + track, channel.id);
            if(gongCounter >= gongLimit) {
                slack.sendMessage("The music got GOONGED!!", channel.id);
                // _gongPlay(channel, true);
                _nextTrack(channel, true)
                gongCounter = 0;
                gongScore={}
            }
        } else{
            if(gongScore[userName] >= gongLimitPerUser) {
                slack.sendMessage("Are you trying to cheat " + userName + "? DENIED!", channel.id)
            }else {
                gongScore[userName] = gongScore[userName] + 1
                gongCounter++;
                slack.sendMessage(randomMessage + " Oh well.. This is GONG " + gongCounter + " out of " + gongLimit + " for " + track, channel.id);
                if(gongCounter >= gongLimit) {
                    slack.sendMessage("The music got GOONGED!", channel.id);
            //      _gongPlay(channel);
                    _nextTrack(channel)
                     gongCounter = 0;
                     gongScore={}
                }
            }
        }
    });
}

function _gongcheck(channel, userName) {
    console.log("_gongcheck...");

  _currentTrackTitle(channel, function(err, track) {
      console.log("_gongcheck > track: " + track);

        slack.sendMessage("The GONG is currently " + gongCounter + " out of " + gongLimit + " for " + track, channel.id);

        var gongers = "";
        for (var key in gongScore) {
            if (gongers.length > 0) {
                gongers += ", " + key;
            } else {
                gongers += key;
            }
        }

      if (gongers.length > 0) {
        slack.sendMessage("The GONG'ERS are " + gongers, channel.id);
      }

    });
}


function _ungong(channel, userName) {
    console.log("_ungong...");
  slack.sendMessage("DENIED!! As much as you want to listen to this, afraid we belong to the Democratic Republic of Sonos.", channel.id);
}


function _previous(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }
    sonos.previous(function(err, previous) {
        console.log(err, previous);
    });
}

function _help(input, channel) {
    var message = 'Current commands!\n' +
    '=====================\n' +
    '`current` : list current track\n' +
    '`status` : show current status of Sonos\n' +
    '`search` _text_ : search for a track, does NOT add it to the queue\n' +
    '`add` _text_ : Add song to the queue and start playing if idle.\n' +
    '`append` _text_ : Append a song to the previous playlist and start playing the same list again.\n' +
    '`gong` : The current track is bad! Vote for skipping this track\n' +
    '`gongcheck` : How many gong votes there are currently, as well as who has GONGED.\n' +
    '`vote` _exactSongTitle_ : Vote for a specific song title in the queue.\n' +
    '`volume` : view current volume\n' +
    '`list` : list current queue\n' +
    '------ ADMIN FUNCTIONS ------\n' +
    '`flush` : flush the current queue\n' +
    '`setvolume` _number_ : sets volume\n' +
    '`play` : play track\n' +
    '`stop` : stop life\n' +
    '`pause` : pause life\n' +
    '`playpause` : resume after pause\n' +
    '`next` : play next track\n' +
    '`previous` : play previous track\n' +
    '`blacklist` : show users on blacklist\n' +
    '`blacklist add @username` : add `@username` to the blacklist\n' +
    '`blacklist del @username` : remove `@username` from the blacklist\n' +
    '=====================\n'
    slack.sendMessage(message, channel.id);
}

function _play(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action! Try using *add* and I will start playing your music!", channel.id)
        return
    }
    sonos.selectQueue(function (err, result) {
        sonos.play(function (err, playing) {
             console.log([err, playing])
                if(playing) {
                slack.sendMessage("WHHHHHYYYYYY? Just do an *add* and the music should start..  you´re making me confused....", channel.id);
                }
            });
    });
}

function _stop(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }
    sonos.stop(function (err, stopped) {
        console.log([err, stopped])
        if(stopped) {
            slack.sendMessage("Why.. WHYY!?", channel.id);
        }
    });
}

function _pause(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!!", channel.id)
        return
    }
    sonos.selectQueue(function (err, result) {
        sonos.pause(function (err, paused) {
             console.log([err, paused])
                slack.sendMessage(".. takning a nap....", channel.id);
            });
    });
}

function _playpause(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action! Try using *add* and I will start playing your music!", channel.id)
        return
    }
        sonos.play(function (err, playing) {
             console.log([err, playing])
                if(playing) {
                slack.sendMessage("..resuming after sleep...", channel.id);
            }
    });
}

function _flush(input, channel) {
    if(channel.name !== adminChannel){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }
    sonos.flush(function (err, flushed) {
        console.log([err, flushed])
        if(flushed) {
            slack.sendMessage('Ok.. clean slate..  Let´s make it better this time!!', channel.id);
        }
    });
}



function _say(input, channel) {
    var text = input[1];
    // Replace all spaces with a _ because Sonos doesn't support spaces
    text = text.replace(/ /g, '_');

    // For supported languages see www.voicerss.org/api/documentation.aspx
    // This url just redirects to voicerss because of the specific url format for the sonos
    var url = 'http://i872953.iris.fhict.nl/speech/en-us_' + encodeURIComponent(text) + '.mp3';

    sonos.queueNext(url, function (err, playing) {
        console.log([err, playing]);
    });
}


function _gongPlay(channel) {
    sonos.play('http://raw.githubusercontent.com/htilly/zenmusic/master/doc/sound/gong.mp3', function (err, playing) {
        console.log([err, playing])
    });
}


function _nextTrack(channel, byPassChannelValidation) {
    if(channel.name !== adminChannel && !byPassChannelValidation){
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }
    sonos.next(function (err, nexted) {
        if(err) {
            console.log(err);
        } else {
            slack.sendMessage('Playing the next track...', channel.id);
        }
    });
}

function _currentTrack(channel, cb) {
    sonos.currentTrack(function(err, track) {
        if(err) {
            console.log(err);
            if(cb) {
                return cb(err, null);
            }
        } else {
            if(cb) {
                return cb(null, track);
            }
            console.log(track);
            var fmin = ''+Math.floor(track.duration/60);
            fmin = fmin.length == 2 ? fmin : '0'+fmin;
            var fsec = ''+track.duration%60;
            fsec = fsec.length == 2 ? fsec : '0'+fsec;

            var pmin = ''+Math.floor(track.position/60);
            pmin = pmin.length == 2 ? pmin : '0'+pmin;
            var psec = ''+track.position%60;
            psec = psec.length == 2 ? psec : '0'+psec;


            var message = 'We´re rocking out to *' + track.artist + '* - *' + track.title + '* ('+pmin+':'+psec+'/'+fmin+':'+fsec+')';
            slack.sendMessage(message, channel.id);
        }
    });
}

function _currentTrackTitle(channel, cb) {
    sonos.currentTrack(function(err, track) {
      var _track = "";
        if(err) {
            console.log(err);
        } else {
            _track = track.title;
            console.log("_currentTrackTitle > title: " + _track);
            console.log("_currentTrackTitle > gongTrack: " + gongTrack);

            if (gongTrack !== "") {
              if (gongTrack !== _track) {
                console.log("_currentTrackTitle > different track, reset!");
                gongCounter = 0;
                gongScore={};

                //return cb(err, null);
              } else {
                  console.log("_currentTrackTitle > gongTrack is equal to _track");
              }
            } else {
                console.log("_currentTrackTitle > gongTrack is empty");
            }

            gongTrack = _track;

        }

        cb(err, _track);
    });
}

function _append(input, channel) {

    var query = '';
    for(var i = 1; i < input.length; i++) {
        query += urlencode(input[i]);
        if(i < input.length-1) {
            query += ' ';
        }
    }

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=1&market=' + market);
    var data = JSON.parse(getapi.data.toString());
    console.log(data);
    if(data.tracks.items && data.tracks.items.length > 0) {
        var spid = data.tracks.items[0].id;
        var uri = data.tracks.items[0].uri;
        var external_url = data.tracks.items[0].external_urls.spotify;

        var albumImg = data.tracks.items[0].album.images[2].url;
        var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name;


        /*
        var present = false;
        _showQueue(channel, function(err, res) {
            res.map(function(it) {
                if(it.uri.indexOf(spid) > -1) {
                    present = true;
                }
            });
        });
        */

                sonos.getCurrentState(function (err, state) {
            if(err) {
                console.log(err);
            } else {
                        if (state === 'stopped') {
                    // Ok, lets start again..  NO Flush
                            //Add the track to playlist...

                            // Old version..  New is supposed to fix 500 problem...
                            // sonos.addSpotifyQueue(spid, function (err, res) {

                            sonos.addSpotify(spid, function (err, res) {
                                var message = '';
                                if(res) {
                                    var queueLength = res[0].FirstTrackNumberEnqueued;
                                    console.log('queueLength', queueLength);
                                    message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                                } else {
                                    message = 'Error!';
                                    console.log(err);
                                }
                                slack.sendMessage(message, channel.id);
                                if(res) {
                                    // And finally..  lets start rocking...
                                    sonos.selectQueue(function (err, result) {
                                        sonos.play(function (err, playing) {
                                            console.log([err, playing])
                                            if(playing) {
                                                slack.sendMessage('Appending to old playlist... lack of creativity?!', channel.id);
                                            }
                                        });
                                    });
                                }
                   });
                            } else if (state === 'playing') {
                    //Tell them to use add...
                   slack.sendMessage("Already playing...  use add..", channel.id)
                        } else if (state === 'paused') {
                        slack.sendMessage("I'm frozen! Alive!", channel.id)
                    } else if (state === 'transitioning') {
                        slack.sendMessage("Mayday, mayday! I'm sinking!!", channel.id)
                    } else if (state === 'no_media') {
                        slack.sendMessage("Nothing to play, nothing to do. I'm rethinking my life", channel.id)
                    } else {
                      slack.sendMessage("No freaking idea. What is this [" + state + "]?", channel.id)
                    }
        }
        });
    } else {
        slack.sendMessage('Sorry could not find that track :( Have your tried using *search* to find it?', channel.id);
    }

    // return slack.sendMessage("I have now added the following in my queue: " + input[2] + " by " + input[1]+"\n"+"https://api.spotify.com/v1/search?q=" + input[2] + "+" + input[1]+"&type=track&limit=1");
}



function _add(input, channel) {

    var query = '';
    for(var i = 1; i < input.length; i++) {
        query += urlencode(input[i]);
        if(i < input.length-1) {
            query += ' ';
        }
    }

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=1&market=' + market);
    var data = JSON.parse(getapi.data.toString());
    console.log(data);
    if(data.tracks && data.tracks.items && data.tracks.items.length > 0) {
        var spid = data.tracks.items[0].id;
        var uri = data.tracks.items[0].uri;
        var external_url = data.tracks.items[0].external_urls.spotify;

        var albumImg = data.tracks.items[0].album.images[2].url;
        var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name;


        /*
        var present = false;
        _showQueue(channel, function(err, res) {
            res.map(function(it) {
                if(it.uri.indexOf(spid) > -1) {
                    present = true;
                }
            });
        });
        */

        /*var curQ = _getQueue();
        console.log('  the length' + curQ.items.length);

        var present = false;
        for(var i = 1; i < curQ.items.length; i++) {
            console.log('  the item' + curQ.items[i]);
        } */

/*
        sonos.getQueue(function (err, result) {
            var present = false;
            for(var i = 1; i < result.items.length; i++) {
                console.log('  the item' + result.items[i]);
                if(!present && result.items[i].uri.indexOf(spid) > -1) {
                    console.log(' Found the requested track in the queue')
                    present = true;
                }
            }

        });
*/

        sonos.getCurrentState(function (err, state) {
            if(err) {
                console.log(err);
            } else {
                if (state === 'stopped') {
                    // Ok, lets start again..  Flush old playlist
                    sonos.flush(function (err, flushed) {
                        console.log([err, flushed])
                        if(flushed) {
                            slack.sendMessage('Clean slate..  Let´s make it better this time!!', channel.id);
                            //Then add the track to playlist...

                            // Old version..  New is supposed to fix 500 problem...
                            // sonos.addSpotifyQueue(spid, function (err, res) {

                            sonos.addSpotify(spid, function (err, res) {
                                var message = '';
                                if(res) {
                                    var queueLength = res[0].FirstTrackNumberEnqueued;
                                    console.log('queueLength', queueLength);
                                    message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                                } else {
                                    message = 'Error!';
                                    console.log(err);
                                }
                                slack.sendMessage(message, channel.id);
                                if(res) {
                                    // And finally..  lets start rocking...
                                    sonos.selectQueue(function (err, result) {
                                        sonos.play(function (err, playing) {
                                            console.log([err, playing])
                                            if(playing) {
                                                slack.sendMessage('Flushed old playlist...  Time to rock again!', channel.id);
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    });
                } else if (state === 'playing') {
                    //Add the track to playlist...

                    // Old version..  New is supposed to fix 500 problem...
                    // sonos.addSpotifyQueue(spid, function (err, res) {

                    sonos.addSpotify(spid, function (err, res) {
                        var message = '';
                        if(res) {
                            var queueLength = res[0].FirstTrackNumberEnqueued;
                            console.log('queueLength', queueLength);
                            message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                        } else {
                            message = 'Error!';
                            console.log(err);
                        }
                        slack.sendMessage(message, channel.id)
                    });
                } else if (state === 'paused') {
                    slack.sendMessage("I'm frozen! Alive!", channel.id)
                } else if (state === 'transitioning') {
                    slack.sendMessage("Mayday, mayday! I'm sinking!!", channel.id)
                } else if (state === 'no_media') {
                    slack.sendMessage("Nothing to play, nothing to do. I'm rethinking my life", channel.id)
                } else {
                  slack.sendMessage("No freaking idea. What is this [" + state + "]?", channel.id)
                }
            }
        });
    } else {
        slack.sendMessage('Sorry could not find that track :( Have your tried using *search* to find it?', channel.id);
    }

    // return slack.sendMessage("I have now added the following in my queue: " + input[2] + " by " + input[1]+"\n"+"https://api.spotify.com/v1/search?q=" + input[2] + "+" + input[1]+"&type=track&limit=1");
}

/*
function _search(input, channel) {

    var query = '';
    for(var i = 1; i < input.length; i++) {
        query += urlencode(input[i]);
        if(i < input.length-1) {
            query += ' ';
        }
    }

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=3');
    var data = JSON.parse(getapi.data.toString());
    console.log(data);
     if(data.tracks && data.tracks.items && data.tracks.items.length > 0) {
        var spid = data.tracks.items[0].id;
        var uri = data.tracks.items[0].uri;
        var external_url = data.tracks.items[0].external_urls.spotify;

        var albumImg = data.tracks.items[0].album.images[2].url;
        var trackName = data.tracks.items[0].artists[0].name + ' - ' + data.tracks.items[0].name;




            //Print the result...
            message = 'I found the following track: "' + trackName + '" if you want to play it, use the add command..\n';
            slack.sendMessage(message, channel.id)


            } else {
            slack.sendMessage('Sorry could not find that track :(', channel.id);
    }
}

*/
function _search(input, channel) {
	let accessToken = _getAccessToken(channel.id);
	if (!accessToken) {
		return false;
	}

    var query = '';
    for(var i = 1; i < input.length; i++) {
        query += urlencode(input[i]);
        if(i < input.length-1) {
            query += ' ';
        }
    }

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=3&market=' + market + '&access_token=' + accessToken);
    var data = JSON.parse(getapi.data.toString());
    console.log(data);
    if(data.tracks && data.tracks.items && data.tracks.items.length > 0) {
        var trackNames = [];

        for(var i = 1; i <= data.tracks.items.length; i++) {

            var spid = data.tracks.items[i-1].id;
            var uri = data.tracks.items[i-1].uri;
            var external_url = data.tracks.items[i-1].external_urls.spotify;

            var albumImg = data.tracks.items[i-1].album.images[2].url;
            var trackName = data.tracks.items[i-1].artists[0].name + ' - ' + data.tracks.items[i-1].name;

            trackNames.push(trackName);

        }

        //Print the result...
        var message = 'I found the following track(s):\n```\n' + trackNames.join('\n') + '\n```\nIf you want to play it, use the `add` command..\n';
        slack.sendMessage(message, channel.id)

    } else {
        slack.sendMessage('Sorry could not find that track :(', channel.id);
    }
}



function _vote(text, channel, userName) {
    var trackName = text.substring(text.indexOf(' ')+1)

    //Decode any htmlentities as returned in the trackName
    entities = new Entities();
    trackName = entities.decode(trackName)

    sonos.getQueue(function (err, result) {
        if (err || !result) {
            console.log(err)
            slack.sendMessage('Couldn\'t fetch the queue', channel.id);
        } else {
            for(var i = 0; i < result.items.length; i++)
            {
                var item = result.items[i]
                if(item['title'] === trackName){
                    if(trackName in votes)
                    {
                        var listOfVotes = votes[trackName]
                        var votedTimes = 0
                        for(var i = 0; i < listOfVotes.length; ++i)
                        {
                            if(listOfVotes[i] === userName)
                            {
                                votedTimes++;
                            }
                        }

                        if(votedTimes >= voteLimit)
                        {
                            slack.sendMessage("Voting so many times " + userName + "! DENIED!", channel.id)
                            return
                        }else
                        {
                            votes[trackName].push(userName)
                            slack.sendMessage("Valid vote by " + userName + "!", channel.id)
                            votedTimes++
                        }
                        if(votedTimes >= voteVictory)
                        {
                            slack.sendMessage("Vote passed! Will put " + trackName + " on top! Will reset votes for this track.", channel.id)
                            delete votes[trackName]
                            // Should play item
                            _currentTrack(channel,
                                function(error, track){
                                    sonos.addSpotifyTagToPositionInQueue(item['uri'], track.positionInQueue + 1, function (err, result) {
                                        if (err) {console.log(err)}
                                            else{_nextTrack(channel, true);}
                                    })
                                }
                            )
                        }
                    }else{
                        votes[trackName] = [userName]
                        slack.sendMessage("Valid vote by " + userName + "!", channel.id)
                    }
                    return
                }
            }
        }
    })
}

function _status(channel){
    sonos.getCurrentState(function (err, state) {
        if(err) {
                console.log(err);
            } else {
                if (state === 'stopped') {
                  slack.sendMessage("Sonos is currently sleeping!", channel.id)
            } else if (state === 'playing') {
                slack.sendMessage("Sonos is rocking!", channel.id)
            } else if (state === 'paused') {
                slack.sendMessage("I'm frozen! Alive!", channel.id)
                } else if (state === 'transitioning') {
                slack.sendMessage("Mayday, mayday! I'm sinking!!", channel.id)
                } else if (state === 'no_media') {
                slack.sendMessage("Nothing to play, nothing to do. I'm rethinking my life", channel.id)
                }else{
                    slack.sendMessage("No freaking idea. What is this [" + state + "]?", channel.id)
            }
            }
        });
}


function _blacklist(input, channel){
    if (channel.name !== adminChannel) {
        console.log("Only admins are allowed for this action!")
        slack.sendMessage("Only admins are allowed for this action!", channel.id)
        return
    }

    var action = ((input[1]) ? input[1] : '');
    var slackUser = ((input[2]) ? slack.dataStore.getUserById(input[2].slice(2, -1)) : '');

    if (input[2] != '' && typeof slackUser !== 'undefined') {
        var username = '@'+slackUser.name;
    } else if (input[2] != '') {
        message = 'The user ' + (input[2]) + ' is not a valid Slack user.';
    }

    if (action == '') {
        message = 'The following users are blacklisted:\n```\n' + blacklist.join('\n') + '\n```';

    } else if (typeof username !== 'undefined') {

        if (action == 'add') {
            var i = blacklist.indexOf(username);
            if (i == -1) {
                blacklist.push(username);
                message = 'The user ' + username + ' has been added to the blacklist.';
            } else {
                message = 'The user ' + username + ' is already on the blacklist.';
            }

        } else if (action == 'del') {
            var i = blacklist.indexOf(username);
            if (i != -1) {
                blacklist.splice(i, 1);
                message = 'The user ' + username + ' has been removed from the blacklist.';
            } else {
                message = 'The user ' + username + ' is not on the blacklist.';
            }

        } else {
            message = 'Usage: `blacklist add|del @username`';
        }
    }
    slack.sendMessage(message, channel.id)
}

function _getAccessToken(channelid) {
    if (apiKey === '') {
        slack.sendMessage('You did not set up an API key. Naughty.', channelid);
        return false;
    }

    let getToken = urllibsync.request('https://accounts.spotify.com/api/token', {
        method: "POST",
        data: { 'grant_type': 'client_credentials' },
        headers: { 'Authorization': 'Basic ' + apiKey }
    });
    let tokendata = JSON.parse(getToken.data.toString());
    return tokendata.access_token;
}


/*
var string = "foo",
    substring = "oo";
console.log(string.indexOf(substring) > -1);
*/

/*{ album:
   { album_type: 'album',
     available_markets: [ 'DK', 'FI', 'IS', 'NO', 'SE' ],
     external_urls: { spotify: 'https://open.spotify.com/album/1bXZgkeQPmgQuFbpyPvU64' },
     href: 'https://api.spotify.com/v1/albums/1bXZgkeQPmgQuFbpyPvU64',
     id: '1bXZgkeQPmgQuFbpyPvU64',
     images: [ [Object], [Object], [Object] ],
     name: 'Meliora',
     type: 'album',
     uri: 'spotify:album:1bXZgkeQPmgQuFbpyPvU64' },
  artists:
   [ { external_urls: [Object],
       href: 'https://api.spotify.com/v1/artists/1Qp56T7n950O3EGMsSl81D',
       id: '1Qp56T7n950O3EGMsSl81D',
       name: 'Ghost B.C.',
       type: 'artist',
       uri: 'spotify:artist:1Qp56T7n950O3EGMsSl81D' } ],
  available_markets: [ 'DK', 'FI', 'IS', 'NO', 'SE' ],
  disc_number: 1,
  duration_ms: 253178,
  explicit: false,
  external_ids: { isrc: 'SEUM71500676' },
  external_urls: { spotify: 'https://open.spotify.com/track/7mAbzwRo89VEKfXbHWdJr8' },
  href: 'https://api.spotify.com/v1/tracks/7mAbzwRo89VEKfXbHWdJr8',
  id: '7mAbzwRo89VEKfXbHWdJr8',
  name: 'He Is',
  popularity: 68,
  preview_url: 'https://p.scdn.co/mp3-preview/efa92c62f5ada9c50b75ac46740904e3375b2205',
  track_number: 5,
  type: 'track',
  uri: 'spotify:track:7mAbzwRo89VEKfXbHWdJr8' }*/

// Playing with Travis.
// Just something that will return a value

module.exports = function(number, locale) {
    return number.toLocaleString(locale);
};
