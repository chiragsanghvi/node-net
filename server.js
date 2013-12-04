// Load TCP Library
var net = require('net'),
  sys = require('sys');

// Keep track of the chat clients
var clients = [];

// Include Appacitive SDK 
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

// Parses string geocode value and return Appacitive geocode object or false
var getGeocode = function(geoCode) {
  // geoCode is not string or its length is 0, return false
  if (typeof geoCode !== 'string' || geoCode.length == 0) return false;
  
  // Split geocode string by ,
  var split = geoCode.split(',');

  // split length is not equal to 2 so return false
  if (split.length !== 2 ) return false;

  // validate the geocode
  try {
    return new Appacitive.GeoCoord(split[0], split[1]);
  } catch(e) {
    return false;
  }
}; 

// Cleans the input of carriage return, newline
var cleanInput = function (data) {
  return data.toString().replace(/(\r\n|\n|\r)/gm,"");
};

// Log initial message on server
var logMessage = function(message) {
  if (message && message.trim().length > 0) {
    var log = new Appacitive.Article('log');
    log.set('message', message);
    var domain = require('domain').create();

    domain.run(function(){
      log.save();
    });

    domain.on('error', function() {
      domain.dispose();
    });
  }
};

// Parses the message and performs specific operation
var performOperation = function(data, socket) {

  var domain = require('domain').create();

  logMessage(data.toString());

  domain.on('error', function(err) {
    sys.puts("Error for " + socket.name + " : "  + err.message);
    domain.dispose();
  });

  domain.run(function() {

    var message = null ;
    try {
      // Parse data into message object
      message = JSON.parse(cleanInput(data.toString()));
    } catch(e) {
      sys.puts("Error for " + socket.name + " : " + e.message);
      if(socket.writable) socket.write("401");
      return;
    }

    // If message object if not formed or it doesn't contains did(deviceid) and gc(geocode), then directly send a "400" response
    if (message && message.did && message.gc && message.cid) {
      
      // Create Appacitive article object of type 'data'
      var apData = new Appacitive.Article('data');

      // Get Appacitive.GeoCoord object for gc sent in message
      var geoCode = getGeocode(message.gc);

      // If geoCode is valid then create
      if (geoCode) {

        // Set geoCode
        apData.set('geocode', geoCode);
        // Set deviceid
        apData.set('deviceid', message.did);
        
        for(var p in message) {
          if (p != 'gc' && p != 'did' && p != 'cid') {
            sys.puts(p);
            if (typeof message[p] == 'object') {
              apData.attr(p, JSON.stringify(message[p]));
            } else {
              apData.attr(p, message[p].toString());
            }
          }
        }

        // Save the object
        apData.save().then(function() {
          sys.puts("New data article created with id : " + apData.id());
          if(socket.writable) socket.write("200|" + message.cid + "|" + apData.id());
        }, function(err) {
          sys.puts(JSON.stringify(err));
          if(socket.writable) socket.write("500|" + message.cid);
        });

        return;
      }
    } 
    if(socket.writable) socket.write("400");
  });
};

// Start a TCP Server
net.createServer(function (socket) {
 
  // Identify this client
  socket.name = socket.remoteAddress + ":" + socket.remotePort 

  // Put this new client in the list
  clients.push(socket);
  
  // Set content encoding to UTF8, to avoid conversion
  socket.setEncoding('UTF-8');

  // Log on console about its connection
  console.log(socket.name + " connected , total connections " + clients.length);
  
  // Handle incoming messages from clients.
  socket.on('data', function (data) {
    console.log(data.toString());
    if(data && data.toString() == 'exit\r\n') {
      socket.end();
    } else {
      performOperation(data, socket);
    }
  });
 
  // Remove the client from the list when it leaves
  socket.on('end', function () {
    var idx = clients.indexOf(socket);
    if (idx !== -1) {
        sys.puts(socket.name + " disconnected, total connections " + (clients.length - 1));
        clients.splice(idx, 1);
    }
  });

  // Error handling for sockets
  socket.on("error", function(err) {
    console.log("Caught socket error for " + socket.name);
    console.log(err.stack);
    // Destroy socket
    socket.destroy();
  });
  
}).listen(8086);
 
console.log("Server running at port 8086\n");