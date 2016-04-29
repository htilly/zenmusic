/*!
 * urllib-sync - index.js
 * Copyright(c) 2014 dead_horse <dead_horse@qq.com>
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var cp = require('child_process');
var utility = require('utility');
var assert = require('assert');
var path = require('path');
var fs = require('fs');

assert(cp.spawnSync, 'urllib-sync need node version 0.11.13+');

exports.request = function request(url, args) {
  assert(url, 'url required');
  args = args || {};

  var input = utility.base64encode(JSON.stringify({
    url: url,
    args: args
  }));
  var requestPath = path.join(__dirname, './request.js');

  var cmd = process.execPath;
  var _args = [requestPath, input];
  var res = cp.spawnSync(cmd, _args, {
    timeout: (args.timeout || 3000) + 1000
  });

  if (res.error) {
    res.error.url = url;
    res.error.args = args;
    throw res.error;
  }

  if (res.status !== 0) {
    var e = new Error(res.stderr.toString() || 'unknown error');
    e.url = url;
    e.args = args;
    e.status = res.status;
    throw e;
  }

  try {
    res = JSON.parse(res.stdout);
  } catch (err) {
    var e = new Error('parse response error:' + err.message);
    e.url = url;
    e.args = args;
    throw e;
  }

  try {
    var data = fs.readFileSync(res.path);
    switch (res.type) {
      case 'string':
      res.data = data.toString();
      break;
      case 'json':
      res.data = JSON.parse(data.toString());
      break;
      default:
      res.data = data;
    }
  } finally {
    fs.unlinkSync(res.path);
    delete res.path;
  }

  return res;
};
