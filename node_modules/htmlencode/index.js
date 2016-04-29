/*!
 * node-htmlencode - Wrapped version of http://www.strictly-software.com/htmlencode
 * Copyright(c) 2013 Dan MacTough <danmactough@gmail.com>
 * All rights reserved.
 */

var htmlencode = require('./encoder')
  , extend = require('util')._extend;

var Encoder = function (type) {
  if (type) this.EncodeType = type;
  return this;
};
extend(Encoder.prototype, htmlencode);

var it = new Encoder();

Object.defineProperty(module.exports, 'EncodeType', {
  enumerable: true,
  get: function () { return it.EncodeType; },
  set: function (val) { return it.EncodeType = val; }
});
[ 'HTML2Numerical',
  'NumericalToHTML',
  'numEncode',
  'htmlDecode',
  'htmlEncode',
  'XSSEncode',
  'hasEncoded',
  'stripUnicode',
  'correctEncoding'].forEach(function (method) {
  module.exports[method] = it[method].bind(it);
});
module.exports.Encoder = Encoder;
