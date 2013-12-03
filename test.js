var net = require("net");       //nodejs version of imports
 
var cnt = 0;

var HOST = 'tavisca-data2.cloudapp.net';
var PORT = 8086;
var noOfClients = 0;

var clientTimer = setInterval(function() {
    var client = new net.Socket();
    var requestCnt = 0;
    var timer = null;
    client.connect(PORT, HOST, function() {

        console.log('CONNECTED TO: ' + HOST + ':' + PORT);
        
        timer = setInterval(function() {
            // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
            cnt++;

            var data = {
                did: "test" + cnt,
                cid: "temp" + cnt,
                gc: "10,20"
            };

            try {
                // every 1000ms
                client.write(JSON.stringify(data));// write to the connection
            } catch(e){}

            console.log("Data send " + JSON.stringify(data));
            if (++requestCnt == 20) {
                client.destroy();
                clearInterval(timer);
            }
        }, 1000);
    });

    // Add a 'data' event handler for the client socket
    // data is what the server sent to this socket
    client.on('data', function(data) {
        console.log('DATA: ' + data);
    });

    // Add a 'close' event handler for the client socket
    client.on('close', function() {
        console.log('Connection closed');
    });

    if(++noOfClients >= 150) {
        clearInterval(clientTimer);
    }
}, 100);
