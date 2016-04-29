urllib-sync
---------------

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![David deps][david-image]][david-url]
[![node version][node-image]][node-url]
[![Gittip][gittip-image]][gittip-url]

[npm-image]: https://img.shields.io/npm/v/urllib-sync.svg?style=flat-square
[npm-url]: https://npmjs.org/package/urllib-sync
[travis-image]: https://img.shields.io/travis/node-modules/urllib-sync.svg?style=flat-square
[travis-url]: https://travis-ci.org/node-modules/urllib-sync
[coveralls-image]: https://img.shields.io/coveralls/node-modules/urllib-sync.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/node-modules/urllib-sync?branch=master
[david-image]: https://img.shields.io/david/node-modules/urllib-sync.svg?style=flat-square
[david-url]: https://david-dm.org/node-modules/urllib-sync
[node-image]: https://img.shields.io/badge/node.js-%3E=_0.11-red.svg?style=flat-square
[node-url]: http://nodejs.org/download/
[gittip-image]: https://img.shields.io/gittip/dead-horse.svg?style=flat-square
[gittip-url]: https://www.gittip.com/dead-horse/

sync http request powered by [urllib](https://github.com/node-modules/urllib) 
and spawnSync.

___Notice: Only support node v0.11.13+___

## Installation

```bash
$ npm install urllib-sync --save
```

## Usage

```js
var request = require('urllib-sync').request;

var res = request('https://github.com');
// res should have status, data, headers
```

more options please check out [urllib](https://github.com/node-modules/urllib)

### License

MIT
