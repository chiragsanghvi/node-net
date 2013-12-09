var net = require("net"); //nodejs version of imports
 
var cnt = 0;

//var HOST = 'tavisca-data2.cloudapp.net';
var HOST = 'localhost';
var PORT = 8086;
var noOfClients = 0;

var dids = [1,2,3,4,5,6,7];

var clientTimer = setInterval(function() {

    clearInterval(clientTimer);

    var client = new net.Socket();
    var requestCnt = 0;
    var timer = null;
    client.connect(PORT, HOST, function() {

        console.log('CONNECTED TO: ' + HOST + ':' + PORT);
        
        timer = setInterval(function() {
            // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
            cnt++;

            var did = dids.shift();
            dids.push(did);

            var data = {
                did: "test123",
                cid: "temp" + cnt,
                gc: "10,20",
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
}, 100);

