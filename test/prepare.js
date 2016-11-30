var prepare = require('mocha-prepare');
var fs = require('fs');
 
prepare(function (done) {
    fs.writeFileSync('config.json_bak', fs.readFileSync('config.json'));
    fs.writeFileSync('config.json', fs.readFileSync('config.json.example'));
    done();
}, function (done) {
    fs.writeFileSync('config.json', fs.readFileSync('config.json_bak'));
    fs.unlinkSync('config.json_bak')
    done();
});
