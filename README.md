[![Build Status](https://travis-ci.org/htilly/zenmusic.svg?branch=master)](https://travis-ci.org/htilly/zenmusic)

# zenmusic
**Slack / Sonos / Spotify / Node.js - Control Sonos through #Slack**

*Screenshot*

![ScreenShot](http://raw.github.com/htilly/zenmusic/master/doc/images/Screenshot.png)



**What is it?**

Quick hack created during one of Schibsted Swedens hackdays by staff from Centralen.
It´s a #slack-bot that control Sonos (and spotify). Highly democratic bot :)
Uses https://github.com/bencevans/node-sonos to controll Sonos.

**What do I need in order to get it to work?**

1: A Sonos player (configured with Spotify).  
2: A slack-bot configured in #Slack  
3: A server running node.js  
4: Know the IP of your Sonos. Preferably a static one.  
5: A Spotify API Key - Base64 representation of client_id:client_secret - [Read more](https://developer.spotify.com/web-api/authorization-guide/#client-credentials-flow) - [Get Keys](https://developer.spotify.com/my-applications/#!/)  
Base64 encoder online can be found [here](https://www.base64encode.org).


**Firewall settings**

Server running the index.js needs to be able to talk to the Sonos on port 1400 (TCP)
Sonos needs to be configured and setup with Spotify and have access to internet.

**Configuration**
You must provide the token of your Slack bot and the IP of your Sonos in either config.json (see config.json.example), as arguments or as environment variables.
Examples:
```bash
node index.js --token "MySlackBotToken" --sonos "192.168.0.1"
```
or
```bash
token="MySlackBotToken" sonos="192.168.0.1" node index.js
```
You can also provide any of the other variables from config.json.example as arguments or environment variables.
The blacklist can be provided as either an array in config.json, or as a comma-separated string when using arguments or environment variables.

Logo for the bot in #Slack can be found at "doc/images/ZenMusic.png

**What can it do?**

It will queue you requests and play it..  However if X amount of people for any strange reason doesn't like the current track, it will listen to the command "**gong**" and eventually skip to the next track.

It also future some admin commands like "setvolume", "next", "stop" etc.

List of commands (just type help in the channel)

* `help` : this list 
* `current` : list current track
* `search` _text_ : search for a track, does NOT add it to the queue
* `add` _text_ : Add song to the queue and start playing if idle.
* `append` _text_ : Append a song to the previous playlist and start playing the same list again.
* `gong` : The current track is bad! Vote for skipping this track
* `gongcheck` : How many gong votes there are currently, as well as who has GONGED.
* `vote` _exactSongTitle_ : Vote for a specific song title in the queue.
* `volume` : view current volume
* `list` : list current queue
* `status` : show the current status

**ADMIN FUNCTIONS**

* `flush` : flush the current queue
* `setvolume` _number_ : sets volume
* `play` : play track
* `stop` : stop life
* `next` : play next track
* `previous` : play previous track
    
**Info**

Please use it to get some music in the office / home. 

We would appreciate if you drop a comment or send a pm... and please feel free to add / change stuff!! Much appreciated!

**Installation**

For installation, see the file INSTALL.

Or have a look at the Wiki.
https://github.com/htilly/zenmusic/wiki


**KnownBugs**

* Validate add / unique track doesn´t work. I.e - You can add same track 10 times in a row.
* Vote does not move track in queue.
 
**ToDo**

* Code cleaning! =)
* Simple "view" window of what is happening in the channel. I.e. - Put on big-screen of what is happening in #music
* Admin: Delete single track from queue.
* Add spotify playlist
* Vote: When voting for a song, put it in top of the queue. Queue is sorted based upon the number of votes.
* A vote shall not automatically skip to the next track. It should just put it higher up the queue.
* Backend DB
* Text-to-speech. 
* Now playing. Announce when starting a new song.
* When asking for "Stat" show most played songs and most active users.
* When local playlist is empty -> fallback and start playing "$playlist", i.e. Spotify topp 100.
* Limit consecutive song additions by non-admin
* Restrict songs already in the queue
* Delete range of songs from queue
* Vote to flush entire queue
* Implement some code-testing

**DONE**

* Added gongcheck - Thanks to "Warren Harding"
* Added blacklist function. Enter usernames in "blacklist.txt".
* Updated 'node-sonos' with getQueue and addSpotify. See: https://github.com/bencevans/node-sonos/commit/bfb995610c8aa20bda09e370b0f5d31ba0caa6a0
* Added new function, search.
* Added new function, Append. Reuse the old queue and add new track to the end of it.
* Admin: Delete entire queue.
* Regularly delete the entries from the queue when the song has been played.
   * When adding a new track, do the following logic:
        * Check "status". (fixed.. sort of..)   
        * If "playing", do a "list". Delete all songs in the queue with lower number than the current track. Then add song to queue.
        * If "sleep" clear queue, add song to queue and do "play".
* Add clear-queue functionality.
* Fix queue function.
* Fix GONG function. If X Gongs within X sec then next.
* Admin commands from i.e."swe-music-admin".
* Vote - If +1 in slack then move in queue. (sort of)
* Ask "what is playing".
