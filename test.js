var net = require("net"); //nodejs version of imports
 
var cnt = 0;
var Appacitive = require('./AppacitiveSDK.js');

// Initialize it with apikey, appId and env
Appacitive.initialize({
  apikey: 'Wze3QDlA5oM8uHhCK9mTRehqKqJPWKpoOn4u2k+29s8=',
  appId: '43687051486429854',
  env: 'sandbox'
});

// Change base URL for Appacitive
Appacitive.config.apiBaseUrl = "http://apis.appacitive.com/";

console.log("AppacitiveSDK loaded");

//var HOST = 'tavisca-data2.cloudapp.net';
var HOST = 'localhost';
var PORT = 8086;
var noOfClients = 0;

var dids = [1,2,3,4,5,6,7];
//https://apis.appacitive.com/article/data/find/all?psize=200&pnum=6&fields=geocode&orderby=__utclastupdateddate&query=*deviceid=='359193030273882'
var query = Appacitive.Article.findAll({
    schema: 'data',
    pageSize: 200,
    filter: Appacitive.Filter.And(
                Appacitive.Filter.Property('deviceid').equalTo('359193030273882'),
                Appacitive.Filter.Property('__utcdatecreated').lessThanEqualToDateTime('2013-12-07T23:59:59.9452000z')
            ),
    orderBy: '__utclastupdateddate',
    fields: ["geocode"]
});

query.fetch().then(function(results) {
    console.log("Fetched " +results.length + " records");

    var clientTimer = setTimeout(function() {

        clearInterval(clientTimer);

        var client = new net.Socket();
        var requestCnt = 0;
        var timer = null;
        client.connect(PORT, HOST, function() {

            console.log('CONNECTED TO: ' + HOST + ':' + PORT);
            
            timer = setInterval(function() {
                
                var gc = results[cnt++].get('geocode','geocode');

                if (gc.lat == 0 && gc.lng == 0) return;

                // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 

                var did = dids.shift();
                dids.push(did);

                var data = {
                    did: "test123",
                    cid: "temp" + cnt,
                    gc: gc.toString(),
                    d: '3',
                    t : (requestCnt%10) == 0 ? 1 : 0
                };

                try {
                    // every 1000ms
                    if(client.writable) client.write(JSON.stringify(data));// write to the connection
                } catch(e){}

                console.log("Data send " + JSON.stringify(data));
                if (++requestCnt == 200) {
                    client.destroy();
                    clearInterval(timer);
                }
            }, 5000);
        });

        // Add a 'data' event handler for the client socket
        // data is what the server sent to this socket
        client.on('data', function(data) {
            console.log('DATA: ' + data);
        });

        // Add a 'close' event handler for the client socket
        client.on('close', function() {
            console.log('Connection closed');
            clearInterval(timer);
        });

        if(++noOfClients >= 50) {
            clearInterval(clientTimer);
            clearInterval(timer);
        }
    }, 00);
});


