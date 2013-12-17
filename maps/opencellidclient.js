var http = require('follow-redirects').http;
var parseString = require('xml2js').parseString;
var sys = require("sys");
var Appacitive = require('./AppacitiveSDK.js');

var request = new Appacitive.HttpRequest();
request.url = "http://www.opencellid.org/cell/get?mcc=404&mnc=86&cellid=4791&lac=50025&fmt=txt";
request.headers.push({ key: 'content-type', value: 'text/plain'});
request.send().then(function(response) {
    console.log('BODY: ' + response);
    parseString(response ,function(err, obj) {
      console.log(obj.rsp.cell[0]["$"]);
    });
}, function(e) {
  console.log('problem with request: ' + e.message);
});



/*var options = {
    port: 80,
    hostname: 'www.opencellid.org',
    method: 'GET',
    path: '/cell/get?mcc=404&mnc=86&cellid=4791&lac=50025&fmt=txt',
    headers: {"content-type": "text/plain"}
};
var startTime = new Date().getTime();

var req = http.request(options, function(res) {
  console.log('STATUS: ' + res.statusCode);
  console.log('HEADERS: ' + JSON.stringify(res.headers));
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    console.log('BODY: ' + chunk);
    parseString(chunk ,function(err, obj) {
    	console.log(obj.rsp.cell[0]["$"]);
    });
    console.log(new Date().getTime() - startTime);
  });
});

req.on('error', function(e) {
  
});

req.end();*/

