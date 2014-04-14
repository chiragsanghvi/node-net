var net = require("net"); //nodejs version of imports
 
var cnt = 0;

//var HOST = 'dataapp-net.cloudapp.net';
var HOST = 'localhost';
var PORT = 8087;
var noOfClients = 0;

var dids = [1,2,3,4,5,6,7];

var clientTimer = setInterval(function() {

    //clearInterval(clientTimer);

    var client = new net.Socket();
    var requestCnt = 0;
    var timer = null;
    var timeCnt = [];
    client.connect(PORT, HOST, function() {

        console.log('CONNECTED TO: ' + HOST + ':' + PORT);
        
        timer = setInterval(function() {
            // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
            cnt++;

            var did = dids.shift();
            dids.push(did);

            var data = {
                did: "test123",
                cid: "" + cnt,
                gc: "12.9611,77.5455",
                d: "3",
                t: "0"
                //tr: "404,86,c373,,25,544,31,404,86,c373,9c9d,25,542,24,404,86,c373,,45,543,21,404,86,c373,738d,36,547,11,404,86,c373,9e7b,17,546,20,404,86,c373,9c9c,5,537,9,0"
            };

            try {
                timeCnt[cnt] = new Date().getTime();
                if(client.writable) client.write(JSON.stringify(data));// write to the connection
            } catch(e){}

            console.log("Data send " + JSON.stringify(data));
            if (++requestCnt == 20000) {
                client.destroy();
                clearInterval(timer);
            }
        }, 1000);
    });

    // Add a 'data' event handler for the client socket
    // data is what the server sent to this socket
    client.on('data', function(data) {
        var split = data.toString().split('|');
        console.log('DATA: ' + data + "   Time:" + (new Date().getTime() - timeCnt[split[1]]));
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
}, 2000);

/*

var insertInData = function(message, geoCode, socket) {
  // Create Appacitive article object of type 'data'
  var tempData = new Appacitive.Article('data');

  // Set geoCode
  tempData.set('geocode', geoCode);

  // Set deviceid
  tempData.set('deviceid', message.did);

  if (message.b) tempData.set('battery', message.b);

  if (message.tr) tempData.set('triangulation', message.tr);

  if (message.t) tempData.set('type', message.t);

  if (message.d) tempData.set('dimension', message.d);

  if (message.sq) tempData.set('signalquality', message.sq);

  // Save the object
  tempData.save().then(function() {
    sys.puts("New data article created with id : " + tempData.id());
    if(socket.writable) socket.write("200|" + ((message.cid) ? message.cid : 0) + "|" + tempData.id());
  }, function(err) {
    sys.puts(JSON.stringify(err));
    if(socket.writable) socket.write("500|" + ((message.cid) ? message.cid : 0));
  });
};


{"did":"test123","cid":"17:40:54","gc":"0,0","t":"0","d":"1","tr":"404,86,c373,,25,544,31,404,86,c373,9c9d,25,542,24,404,86,c373,,45,543,21,404,86,c373,738d,36,547,11,404,86,c373,9e7b,17,546,20,404,86,c373,9c9c,5,537,9,0","sq": "80","b":"40"}

{"did" : "test123","cid" : "17:40:54","gc" : "12.9611,77.5455", "t" : "0","d" : "3","b" : "40"} 

{"did" : "test123","cid" : "17:40:54","gc" : "12.9611,77.5455", "t" : "3","d" : "3","b" : "40"} 

{"did":"test123","t":"2"}

{"did":"114401760100293","cid":"17:35:1","gc":"0.0,0.0","t":"0","d":"1","tr":"404,86,c373,69d5,43,540,34,404,86,c373,9e7b,17,546,27,404,86,c373,9c9c,5,537,20,404,86,c373,9c9d,25,542,23,404,86,c373,9e7c,49,538,18,0","sq":"23"}


redis-server

forever start -al data1.log -o out.log -e err.log server.js

sudo sysctl -w net.inet.tcp.always_keepalive=1

"12.964827761281963,77.7121544809904"

"12.96412,77.71187" */
