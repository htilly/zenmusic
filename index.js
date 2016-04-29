var Sonos = require('sonos').Sonos
var configure = require('./config.json');
var sonos = new Sonos(configure.sonos);
var adminChannel = configure.adminChannel;
var standardChannel = configure.standardChannel;
var Slack, autoMark, autoReconnect, slack, token;
var urllibsync = require('urllib-sync');
var urlencode = require('urlencode');

token = configure.token;
Slack = require('slack-client');


autoReconnect = true;
autoMark = true;
slack = new Slack(token, autoReconnect, autoMark);

var gongCounter = 0;
var gongLimit = 3;
var gongLimitPerUser = 1;
var gongScore = {};
var voteVictory = 3;
var voteLimit = 1;
var votes = {};

slack.on('open', function() {
    var channel, channels, group, groups, id, messages, unreads;
    channels = [standardChannel];
    groups = [];
    unreads = slack.getUnreadCount();
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

    console.log("Welcome to Slack. You are @" + slack.self.name + " of " + slack.team.name);
    console.log('You are in: ' + channels.join(', '));
    console.log('As well as: ' + groups.join(', '));
    messages = unreads === 1 ? 'message' : 'messages';
    var channel = slack.getChannelByName(standardChannel);
    var message = ":notes: " + "Im back!!" + "\n";
    channel.send(message);

    return console.log("You have " + unreads + " unread " + messages);




});

slack.on('message', function(message) {
    var channel, channelError, channelName, errors, response, text, textError, ts, type, typeError, user, userName;
    channel = slack.getChannelGroupOrDMByID(message.channel);
    user = slack.getUserByID(message.user);
    response = '';
    type = message.type, ts = message.ts, text = message.text;
    channelName = (channel != null ? channel.is_channel : void 0) ? '#' : '';
    channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
    userName = (user != null ? user.name : void 0) != null ? "@" + user.name : "UNKNOWN_USER";
    console.log("Received: " + type + " " + channelName + " " + userName + " " + ts + " \"" + text + "\"");
    if (type === 'message' && (text != null) && (channel != null)) {
        input = text.split(' ');
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
            case 'stop':
                _stop(input, channel);
            break;
            case 'flush':
                _flush(input, channel);
            break;
            case 'play':
                _play(input, channel);
            break;
            case 'help':
                _help(input, channel);
            break;
            case 'dong':
            case 'gong':
                _gong(channel, userName);
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
            default:
            break;
        }
    } else {
        typeError = type !== 'message' ? "unexpected type " + type + "." : null;
        textError = text == null ? 'text was undefined.' : null;
        channelError = channel == null ? 'channel was undefined.' : null;
        errors = [typeError, textError, channelError].filter(function(element) {
            return element !== null;
        }).join(' ');
        return console.log("@" + slack.self.name + " could not respond. " + errors);
  }
});

slack.on('error', function(error) {
    return console.error("Error: " + error);
});

slack.login();



function _getVolume(channel) {

    sonos.getVolume(function(err, vol) {
        console.log(err, vol);
        channel.send('Vol is ' + vol + ' deadly dB _(ddB)_');
    });
}

function _setVolume(input, channel) {
	if(channel.name !== adminChannel){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
		return
	}

    var vol = input[1];

    if(isNaN(vol)) {
        channel.send('Nope.');
        return;
    } else {
        vol = Number(vol);
        console.log(vol);
        if(vol > 55) {
            channel.send('You also could have tinnitus _(say: tih-neye-tus)_');
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
            channel.send('Couldn\'t fetch the queue');

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
                channel.send(message);
            });
        }
    });
}

function _gong(channel, userName) {
    if(!(userName in gongScore)) {
        gongScore[userName] = 1
        gongCounter++;
        channel.send("Is it really THAT bad?! Oh well.. This is GONG " + gongCounter + " out of " + gongLimit);
        if(gongCounter >= gongLimit) {
            channel.send("The music got GOONGED!");
            _nextTrack(channel, true)
            gongCounter = 0;
            gongScore={}
        }
    } else{
        if(gongScore[userName] >= gongLimitPerUser) {
            channel.send("Are you trying to cheat " + userName + "? DENIED!")
        }else {
            gongScore[userName] = gongScore[userName] + 1
            gongCounter++;
                    channel.send("Is it really THAT bad?! Oh well.. This is GONG " + gongCounter + " out of " + gongLimit);
                    if(gongCounter >= gongLimit) {
                        channel.send("The music got GOONGED!");
                        _nextTrack(channel)
                         gongCounter = 0;
                         gongScore={}
                    }
        }
    }
}

function _previous(input, channel) {
	if(channel.name !== adminChannel){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
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
    '`search` _text_ : search for a track, does NOT add it to the queue\n' +
    '`add` _text_ : Add song to the queue and start playing if idle.\n' +
    '`append` _text_ : Append a song to the previous playlist and start playing the same list again.\n' +
    '`gong` : The current track is bad! Vote for skipping this track\n' +
    '`vote` _exactSongTitle_ : Vote for a specific song title in the queue.\n' +
    '`volume` : view current volume\n' +
    '`list` : list current queue\n' +
    '------ ADMIN FUNCTIONS ------\n' +
    '`flush` : flush the current queue\n' +
    '`setvolume` _number_ : sets volume\n' +
    '`play` : play track\n' +
    '`stop` : stop life\n' +
    '`next` : play next track\n' +
    '`previous` : play previous track\n' +
    '=====================\n'
    channel.send(message);
}

function _play(input, channel) {
	if(channel.name !== adminChannel){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
		return
	}
    sonos.selectQueue(function (err, result) {
        sonos.play(function (err, playing) {
             console.log([err, playing])
                if(playing) {
                channel.send('WHHHHHYYYYYY? Just do an *add* and the music should start..  you´re making me confused....');
                }
            });
    });
}

function _stop(input, channel) {
	if(channel.name !== adminChannel){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
		return
	}
    sonos.stop(function (err, stopped) {
        console.log([err, stopped])
        if(stopped) {
            channel.send('Why.. WHYY!?');
        }
    });
}

function _flush(input, channel) {
	if(channel.name !== adminChannel){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
		return
	}
    sonos.flush(function (err, flushed) {
        console.log([err, flushed])
        if(flushed) {
            channel.send('Ok.. clean slate..  Let´s make it better this time!!');
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

function _nextTrack(channel, byPassChannelValidation) {
	if(channel.name !== adminChannel && !byPassChannelValidation){
		console.log("Only admins are allowed for this action!")
		channel.send("Only admins are allowed for this action!")
		return
	}
    sonos.next(function (err, nexted) {
        if(err) {
            console.log(err);
        } else {
            channel.send('Playing the next track...');
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


            var message = 'We´re dancing to *' + track.artist + '* - *' + track.title + '* ('+pmin+':'+psec+'/'+fmin+':'+fsec+')';
            channel.send(message);
        }
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

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=1');
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
                            sonos.addSpotifyQueue(spid, function (err, res) {
                                var message = '';
                                if(res) {
                                    var queueLength = res[0].FirstTrackNumberEnqueued;
                                    console.log('queueLength', queueLength);
                                    message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                                } else {
                                    message = 'Error!';
                                    console.log(err);
                                }
                                channel.send(message);
                                if(res) {
                                    // And finally..  lets start rocking...
                                    sonos.selectQueue(function (err, result) {
                                        sonos.play(function (err, playing) {
                                            console.log([err, playing])
                                            if(playing) {
                                                channel.send('Appending to old playlist... lack of creativity?!');
                                            }
                                        });
                                    });
                                }
                   });
                            } else if (state === 'playing') {
                    //Tell them to use add...
                   channel.send("Already playing...  use add..")
                        } else if (state === 'paused') {
                        channel.send("I'm frozen! Alive!")
                    } else if (state === 'transitioning') {
                        channel.send("Mayday, mayday! I'm sinking!!")
                    } else if (state === 'no_media') {
                        channel.send("Nothing to play, nothing to do. I'm rethinking my life")
                    } else {
                      channel.send("No freaking idea. What is this [" + state + "]?")
                    }
		}
        });
    } else {
        channel.send('Sorry could not find that track :(');
    }

    // return channel.send("I have now added the following in my queue: " + input[2] + " by " + input[1]+"\n"+"https://api.spotify.com/v1/search?q=" + input[2] + "+" + input[1]+"&type=track&limit=1");
}



function _add(input, channel) {

    var query = '';
    for(var i = 1; i < input.length; i++) {
        query += urlencode(input[i]);
        if(i < input.length-1) {
            query += ' ';
        }
    }

    var getapi = urllibsync.request('https://api.spotify.com/v1/search?q=' + query + '&type=track&limit=1');
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
                            channel.send('Clean slate..  Let´s make it better this time!!');
                            //Then add the track to playlist...
                            sonos.addSpotifyQueue(spid, function (err, res) {
                                var message = '';
                                if(res) {
                                    var queueLength = res[0].FirstTrackNumberEnqueued;
                                    console.log('queueLength', queueLength);
                                    message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                                } else {
                                    message = 'Error!';
                                    console.log(err);
                                }
                                channel.send(message);
                                if(res) {
                                    // And finally..  lets start rocking...
                                    sonos.selectQueue(function (err, result) {
                                        sonos.play(function (err, playing) {
                                            console.log([err, playing])
                                            if(playing) {
                                                channel.send('Flushed old playlist...  Time to rock again!');
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    });
			    } else if (state === 'playing') {
                    //Add the track to playlist...
                    sonos.addSpotifyQueue(spid, function (err, res) {
                        var message = '';
                        if(res) {
                            var queueLength = res[0].FirstTrackNumberEnqueued;
                            console.log('queueLength', queueLength);
                            message = 'I have added "' + trackName + '" to the queue!\n'+albumImg+'\nPosition in queue is ' + queueLength;
                        } else {
                            message = 'Error!';
                            console.log(err);
                        }
                        channel.send(message)
                    });
    			} else if (state === 'paused') {
    		      	channel.send("I'm frozen! Alive!")
    		    } else if (state === 'transitioning') {
    		      	channel.send("Mayday, mayday! I'm sinking!!")
    		    } else if (state === 'no_media') {
    		      	channel.send("Nothing to play, nothing to do. I'm rethinking my life")
    		    } else {
    		      channel.send("No freaking idea. What is this [" + state + "]?")
    		    }
        	}
    	});
    } else {
        channel.send('Sorry could not find that track :(');
    }

    // return channel.send("I have now added the following in my queue: " + input[2] + " by " + input[1]+"\n"+"https://api.spotify.com/v1/search?q=" + input[2] + "+" + input[1]+"&type=track&limit=1");
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
            channel.send(message)


            } else {
            channel.send('Sorry could not find that track :(');
    }
}

*/
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

		for(var i = 1; i <= data.tracks.items.length; i++) {



        var spid = data.tracks.items[i-1].id;
        var uri = data.tracks.items[i-1].uri;
        var external_url = data.tracks.items[i-1].external_urls.spotify;

        var albumImg = data.tracks.items[i-1].album.images[2].url;
        var trackName = data.tracks.items[i-1].artists[0].name + ' - ' + data.tracks.items[i-1].name;




            //Print the result...
            message = 'I found the following track: "' + trackName + '" if you want to play it, use the add command..\n';
            channel.send(message)

      	}
            } else {
            channel.send('Sorry could not find that track :(');
    }
}



function _vote(text, channel, userName) {
    var trackName = text.substring(text.indexOf(' ')+1)
    sonos.getQueue(function (err, result) {
        if (err || !result) {
            console.log(err)
            channel.send('Couldn\'t fetch the queue');
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
                            channel.send("Voting so many times " + userName + "! DENIED!")
                            return
                        }else
                        {
                            votes[trackName].push(userName)
                            channel.send("Valid vote by " + userName + "!")
                            votedTimes++
                        }
                        if(votedTimes >= voteVictory)
                        {
                            channel.send("Vote passed! Will put " + trackName + " on top! Will reset votes for this track.")
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
                        channel.send("Valid vote by " + userName + "!")
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
			      channel.send("Sonos is currently sleeping!")
			} else if (state === 'playing') {
		      	channel.send("Sonos is rocking!")
			} else if (state === 'paused') {
		      	channel.send("I'm frozen! Alive!")
		    	} else if (state === 'transitioning') {
		      	channel.send("Mayday, mayday! I'm sinking!!")
		    	} else if (state === 'no_media') {
		      	channel.send("Nothing to play, nothing to do. I'm rethinking my life")
		    	}else{
		    		channel.send("No freaking idea. What is this [" + state + "]?")
		    }
        	}
    	});
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

