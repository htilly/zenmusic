describe('htmlencode', function () {
  var assert = require('assert');
  var htmlencode = require('../');
  var str = '<strong>';
  var stru = '’90s';
  var stru_n = '&#8217;90s';
  var str_e = '&lt;strong&gt;';
  var str_n = '&#60;strong&#62;';

  describe('HTML2Numerical', function () {
    it('should convert HTML entities into numerical entities', function () {
      assert.equal(htmlencode.HTML2Numerical(str_e), str_n);
    });
  });

  describe('NumericalToHTML', function () {
    it('should convert Numerical entities into HTML entities', function () {
      assert.equal(htmlencode.NumericalToHTML(str_n), str_e);
    });
  });

  describe('numEncode', function () {
    it('should numerically encodes all unicode characters', function () {
      assert.equal(htmlencode.numEncode(stru), stru_n);
    });
  });

  describe('htmlDecode', function () {
    it('HTML Decode numerical and HTML entities back to original values', function () {
      assert.equal(htmlencode.htmlDecode(str_e), str);
      assert.equal(htmlencode.htmlDecode(str_n), str);
    });
  });

  describe('htmlEncode', function () {
    after(function () {
      htmlencode.EncodeType = 'entity';
    });
    it('encode an input string into either numerical or HTML entities', function () {
      htmlencode.EncodeType = 'entity';
      assert.equal(htmlencode.htmlEncode(str), str_e);
      htmlencode.EncodeType = 'numerical';
      assert.equal(htmlencode.htmlEncode(str), str_n);
    });
  });

  describe('hasEncoded', function () {
    it('should return true if a string contains html or numerical encoded entities', function () {
      assert.ok(htmlencode.hasEncoded(str_e));
      assert.ok(htmlencode.hasEncoded(str_n));
      assert.ok(htmlencode.hasEncoded(stru_n));
    });
  });

  describe('Encoder Class', function () {
    it('should create an instance that may have different properties', function () {
      var alt = new htmlencode.Encoder('numerical');
      assert.equal(alt.EncodeType, 'numerical');
      assert.equal(htmlencode.EncodeType, 'entity');
    });
  });
});