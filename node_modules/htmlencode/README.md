# node-htmlencode

A wrapped version of http://www.strictly-software.com/htmlencode library --
only two changes to the original:

1. Renamed global `Encoder` object to `module.exports` so it can be used as a Node module.
2. Fixed leaking global variable `arr` in `htmlDecode` method

## Usage

In addition to the very minor changes described above, the library is wrapped in
a function to allow you to `require` just the individual method(s) you want.

```js
var htmlencode = require('htmlencode');
htmlencode.htmlEncode('<h1>Welcome</h1>');
// &lt;h1&gt;Welcome&lt;/h1&gt;
```

works the same as

```js
var htmlEncode = require('htmlencode').htmlEncode;
htmlEncode('<h1>Welcome</h1>');
// &lt;h1&gt;Welcome&lt;/h1&gt;
```

If you want to change to using numeric HTML entities, you'll still want to do
something like this:

```js
var htmlencode = require('htmlencode');
htmlencode.EncodeType = 'numerical'; // Don't blame me. I didn't name it.
htmlencode.htmlEncode('<h1>Welcome</h1>');
// &#60;h1&#62;Welcome&#60;/h1&#62;
```

Also provided is `module.exports.Encoder`, the wrapper class, so you can do
something like this if you so choose:

```js
var htmlencode = require('htmlencode');
var widget = new htmlencode.Encoder('numerical');
widget.htmlEncode('<h1>Welcome</h1>');
// &#60;h1&#62;Welcome&#60;/h1&#62;
```
