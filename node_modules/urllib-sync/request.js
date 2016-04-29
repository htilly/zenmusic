/*!
 * urllib-sync - request.js
 * Copyright(c) Alibaba Group Holding Limited.
 * Author: busi.hyy <busi.hyy@alibaba-inc.com>
 */

'use strict';

/**
 * Module dependencies.
 */

var utility = require('utility');
var urllib = require('urllib');
var path = require('path');
var util = require('util');
var fs = require('fs');
var os = require('os');

var input = {};
try {
  input = utility.base64decode(process.argv[2] || '');
  input = JSON.parse(input);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

urllib.request(input.url, input.args, function (err, data, res) {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }

  var name = util.format('%s:%s', process.pid, Date.now());
  var filepath = path.join(os.tmpDir(), name);

  var type = 'buffer';
  if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
    type = 'json';
    data = JSON.stringify(data);
  } else if (typeof data === 'string') {
    type = 'string';
  }

  fs.writeFileSync(filepath, data);

  var res = {
    path: filepath,
    type: type,
    status: res.statusCode,
    headers: res.headers
  };

  console.log(JSON.stringify(res));
  process.exit(0);
});
