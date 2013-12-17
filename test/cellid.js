var sys = require('sys').
    spawn = require('child_process').spawn;

var getLocation = function(index) {
    var test = spawn('python',["test.py", "47913", "50025"]);
    var res = '';

    test.stdout.on('data', function (data) {
      console.log(data + " index : " + index);
    });

    test.stderr.setEncoding('utf8')
    test.stderr.on('data', function (data) {
      res = data;
    });

    test.on('close', function (code) {
      if (code == 0) {
        console.log(res + " index : " + index);
      } else {
        console.log("Err index : " + index);
      }
    });
}

for(var i=0; i<10; i=i+1) {
    getLocation(i);
}
