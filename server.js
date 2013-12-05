// Load TCP , Sys and router modules
var net = require('net'),
  sys = require('sys'),
  Router = require('node-simple-router')

// Keep track of the chat clients
var clients = {};

// An incremental id to assign a particular socket identify 
var clientId = 1000000 

// A counter for tracking no of clients
var noOfClients = 0;

// A list of all sockets for devices
var deviceSockets = {};

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

  // Create a domain for exception handling
  var domain = require('domain').create();

  // For logging message 
  //logMessage(data.toString());

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
      
      // Set this socket for a particular device 
      if (!deviceSockets[message.did]) deviceSockets[message.did] = { count: 0}
      
      if (!deviceSockets[message.did][socket.id]) deviceSockets[message.did].count++;

      // Set last seen property 
      deviceSockets[message.did][socket.id] = new Date();

      // Set deviceId in socket too
      socket.deviceId = message.did;

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

// Deletes a client from clients and deviceSockets
var deleteClient = function(socket) {
  var client = clients[socket.id];
  if (client) {
      sys.puts(client.name + " disconnected, total connections " + (--noOfClients));
      if (client.deviceId && deviceSockets[client.deviceId][client.id]) {
        delete deviceSockets[client.deviceId][client.id];
        deviceSockets[client.deviceId].count--;
        if (deviceSockets[client.deviceId].count <= 0) delete deviceSockets[client.deviceId];
      }
      delete clients[socket.id];
  }
};

// Start a TCP Server
var tcpServer = net.createServer(function (socket) {
 
  // Identify this client by name
  socket.name = socket.remoteAddress + ":" + socket.remotePort 

  // Identify this clinet by an id
  socket.id = ++clientId; 

  // Increment noOfClients 
  noOfClients++;

  // Set lastseen for debugging purpose
  socket.lastSeen = new Date();

  // Put this new client in the list
  clients[socket.id] = socket;
  
  // Set content encoding to UTF8, to avoid conversion
  socket.setEncoding('utf8');

  // Log on console about its connection
  console.log(socket.name + " connected , total connections " + noOfClients);
  
  // Handle incoming messages from clients.
  socket.on('data', function (data) {
    if (data && data.toString() == 'exit\r\n') {
      socket.end();
    } else {
      // Set lastseen for debugging purpose
      socket.lastSeen = new Date();

      // add data in Appacitive 'data' schema
      performOperation(data, socket);
    }
  });
 
  // Remove the client from the list when it leaves
  socket.on('end', function () {
    //delete client from clients
    deleteClient(socket);
  });

  // Error handling for sockets
  socket.on("error", function(err) {
    console.log("Caught socket error for " + socket.name);
    console.log(err.stack);

    // Destroy socket
    socket.destroy();

    //delete client from clients
    deleteClient(socket);
  });
  
});

// Start listening on port 8086
tcpServer.listen(8086);
 
console.log("TCP Server running at port 8086");

// Load Http library
var http = require('http');

// Create a new instance of router
var router = Router({ logging: false });

// Route for get connections
router.get('/connections', function (req, res) {
  var connections = [];
  for (var client in clients) {
    var c = clients[client];
    connections.push({
      port: c.remotePort,
      address: c.remoteAddress,
      id: c.id,
      writable : c.writable ? true : false,
      lastSeen: c.lastSeen,
      deviceId: c.deviceId
    });
  }
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ connections: connections, noOfConnections: noOfClients }));
});

// Route to get no of connections
router.get('/connections/count', function(req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ noOfConnections: noOfClients }));
});

// Route to close all sockets
router.post('/connections/close', function(req, res) {
  for (var c in clients) {
    var client = clients[c];
    if (client) {
      client.destroy();
      deleteClient(client);
    }
    delete clients[c];
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("Successful");
});


// Route to close one socket by its id
router.post('/connections/close/:clientId', function(req, res) {
  var client = clients[req.params.clientId];
  if (client) {
    client.destroy();
    deleteClient(client);
  }
  delete clients[req.params.clientId];
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("Successful");
});

// Route to close all sockets by deviceid
router.post('/devices/close/:deviceId', function(req, res) {
  var deviceSocket = deviceSockets[req.params.deviceId];
  if (deviceSocket) {
    for (var conn in deviceSocket) {
      var client = clients[conn];
      if (client) {
        client.destroy();
        deleteClient(client);
      }
    }
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("Successful");
});

// Route to get all device and their noofconnection count
router.get('/devices', function(req, res){
  var devices = [];
  for (var device in deviceSockets) {
    var deviceSocket = deviceSockets[device];
    devices.push({
      noOfConnections: deviceSocket.count,
      deviceId: device
    });
  }
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({ devices: devices, noOfDevices: devices.length }));
});

// Route to get noOfConnections for a device
router.get('/devices/:deviceId', function(req, res){
  var deviceSocket = deviceSockets[req.params.deviceId];
  if (deviceSocket) {
    var connections = [];
    for (var conn in deviceSocket) {
      if (conn !== 'count') {
        connections.push({ id : conn, lastSeen: deviceSocket[conn]});
      }
    }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ connections: connections, noOfConnections: deviceSocket.count }));
  } else {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ noOfConnections: 0, connections: [] }));
  }
});

// Start an HTTP Server for logs with router
var httpServer = require('http').createServer(router);

// Start listening on 8082
httpServer.listen(8082);

console.log("HTTP Server running at port 8082\n");