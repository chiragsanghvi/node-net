// Load TCP , Sys and router modules

require('util-log-timestamp');

var net = require('net'),
  sys = require('sys'),
  data = require('./data.js'),
  Appacitive = require('./AppacitiveSDK.js'),
  Router = require('node-simple-router');
  config = require('./config.js');

// To track config for changes of firmware version
require('fs').watch('./config.js', function(e, filename) {
  var oldFirmwareVersion = config.firmwareVersion;

  delete require.cache[require.resolve('./config.js')];
  config = require('./config.js');

  if (oldFirmwareVersion != config.firmwareVersion) {
    console.log("FirmwareVersion changed from " + oldFirmwareVersion + " to " + config.firmwareVersion);
    data.setFirmwareVersion(config.firmwareVersion);
  }

  console.log("config file changed");
  data.setConfig(config);
  
});

// Keep track of the device clients
var clients = {};

// An incremental id to assign a particular socket identify 
var clientId = 1000000 

// A counter for tracking no of clients
var noOfClients = 0;

// A list of all sockets for devices
var deviceSockets = {};

// Cleans the input of carriage return, newline
var cleanInput = function (data) {
  return data.toString().replace(/(\r\n|\n|\r)/gm,"");
};

// Log initial message on server
var logMessage = function(message) {
  if (message && message.trim().length > 0) {
    var domain = require('domain').create();

    domain.run(function(){
      var log = new Appacitive.Object('log');
      log.set('message', message);
      log.save();
    });

    domain.on('error', function() {
      domain.dispose();
    });
  }
};

var sendUpgradeInformation = function(message, socket) {
  var response = 'UPGRADE|' + config.firmwareVersion + '|' + config['server-ip'] + '|' 
               + config['file-path'] + '|'
               + config['username'] + '|'
               + config['password'] + '|';
  if (socket.writable)  socket.write(response);
};

// Parses the message and performs specific operation
var performOperation = function(message, socket) {

  // Create a domain for exception handling
  var domain = require('domain').create();

  // For logging message 
  logMessage(message.toString());

  domain.on('error', function(err) {
    sys.puts("Data Error for " + socket.name + " : "  + err.message + '\n' + err.stack);
    domain.dispose();
  });

  domain.run(function() {

    try {
      // Parse data into message object
      message = JSON.parse(cleanInput(message.toString()));
    } catch(e) {
      sys.puts("Error for " + socket.name + " : " + e.message);
      if (socket.writable) socket.write( config.firmwareVersion + "|400|");
      return;
    }

    // If message object is not formed or it doesn't contains did(deviceid) and gc(geocode), then directly send a "400" response
    if (message && message.did) {
      
      // Set this socket for a particular device 
      if (!deviceSockets[message.did]) deviceSockets[message.did] = { count: 0}
      
      // Set no of connections for a particular device 
      if (!deviceSockets[message.did][socket.id]) deviceSockets[message.did].count++;

      // Set last seen property 
      deviceSockets[message.did][socket.id] = new Date();

      // Set deviceId in socket too
      socket.deviceId = message.did;

      
      if (message.t && message.t == 2) {
        sendUpgradeInformation(message, socket);
      } else {
        //if message type is 0 or 1 then call add data
        data.addData(message, socket);
      }
      return;
    } 

    if (socket.writable) socket.write( config.firmwareVersion + "|400|");
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

  // Send socket alive every 45 seconds
  socket.setKeepAlive(true, 45000);

  // Set idle timeout to 1800000 (30 minutes)
  socket.setTimeout(1800000);

  // Timeout handling for scokets
  socket.on("timeout", function() {
    sys.puts(socket.name + " timed out");

    // Destroy socket
    socket.destroy();

    //delete client from clients
    deleteClient(socket);
  });
 
  // Close signal from client side
  socket.on("close", function() {
    sys.puts(socket.name + " close signal received");

    // Destroy socket
    socket.end();

    //delete client from clients
    deleteClient(socket);
  });
  
  
});

tcpServer.on('error', function(e) {
  sys.puts("\n\nTCP server error " + e.message + "\n Stack: " + e.stack + "\n\n");
});

// Start listening on tcp-port read from config
tcpServer.listen(config['tcp-port']);
 
console.log("TCP Server running at port " + config['tcp-port']);

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

// Route to get all logs
router.get('/logs', function(req, res){
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(JSON.stringify(Appacitive.logs)));
});

// Route to get all error logs
router.get('/logs/errors', function(req, res){
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(JSON.stringify(Appacitive.logs.errors)));
});

var static = require('node-static');
var fileServer = new static.Server('./maps');

router.get('/', function(request, response) {
  fileServer.serve(request, response);
});

router.get('/scripts/AppacitiveSDK.min.js', function(request, response) {
  fileServer.serve(request, response);
});

router.get('/images/dot.png', function(request, response) {
  fileServer.serve(request, response);
});

router.get('/images/bluedot.png', function(request, response) {
  fileServer.serve(request, response);
});

router.get('/images/current.gif', function(request, response) {
  fileServer.serve(request, response);
});

router.get('/scripts/jquery.js', function(request, response) {
  fileServer.serve(request, response);
});

// Start an HTTP Server for logs with router
var httpServer = require('http').createServer(router);

httpServer.on('error', function(e) {
  sys.puts("\n\nHttp server error " + e.message + "\n Stack: " + e.stack + "\n\n");
});

// Start listening on http-port in config
httpServer.listen(config['http-port']);

console.log("HTTP Server running at port " + config['http-port'] + "\n");