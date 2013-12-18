var net = require("net"); //nodejs version of imports
 
var cnt = 0;

//var HOST = 'tavisca-data2.cloudapp.net';
var HOST = 'localhost';
var PORT = 8086;
var noOfClients = 0;

var dids = [1,2,3,4,5,6,7];

var clientTimer = setTimeout(function() {

    clearInterval(clientTimer);

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
                gc: "0,0",
                d: "1",
                t: "0",
                tr: "404,86,c373,,25,544,31,404,86,c373,9c9d,25,542,24,404,86,c373,,45,543,21,404,86,c373,738d,36,547,11,404,86,c373,9e7b,17,546,20,404,86,c373,9c9c,5,537,9,0"
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
}, 100);
