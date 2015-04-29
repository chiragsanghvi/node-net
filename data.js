// Include Appacitive SDK 
var Appacitive = require('./AppacitiveSDK.js'),
	epoch = require('./time.js'),
	sys = require('sys'),
  triangClient = require('./triangClient.js'),
  firmwareVersion = require('./firmwareConfig.js').firmwareVersion;

var http = require('http');

// Initialize it with apikey, appId and env
Appacitive.initialize({
  apikey: 'Wze3QDlA5oM8uHhCK9mTRehqKqJPWKpoOn4u2k+29s8=',
  appId: '43687051486429854',
  env: 'sandbox'
});

// Change base URL for Appacitive
Appacitive.config.apiBaseUrl = "http://apis.appacitive.com/v1.0/";

console.log("AppacitiveSDK loaded");

/* Parses string geocode value and return Appacitive geocode object or false
   This'll basically check for geocode value not being zero
   or calculate it using triangulation depending on 'd' attribute
 */  
var getGeocode = function(message) {
  var promise = new Appacitive.Promise();

  // validate the geocode
  try {
    /* If dimension is 1 then we calculate geocode on basis of triangulation information 
       else we directly cast it into Appacitive.GeoCoords object
       If lat and lng is zero then we reject the promise
       else we fulfill it
     */
    if (message.d == 1 && message.tr) {
      // Call triangClient to calculate geocode
      return triangClient.getGeocode(message.tr, message.ssq ? message.ssq : 50);
    } else {
        var geoCode =  new Appacitive.GeoCoord(message.gc);
        if (geoCode.lat == 0 && geoCode.lng == 0) promise.reject();
        else promise.fulfill(geoCode);
    }
  } catch(e) {
    promise.reject();
  }
  return promise;
}; 

// Sends a push Notifcation
var sendPushNotification = function(data) {
  var options = {
    "broadcast": true, // set this to true for broadcast
    "platformoptions": {
        // platform specific options
        "ios": {
            "sound": "default"
        }
    },
    "data": {
        // message to send
        "alert": "Panic button pressed for device id " + data.get('deviceid')
    }
  };

  sys.puts("Sending push notification");

  try {
    Appacitive.Push.send(options);
  } catch(e) {}
};

/* Finds an window of time depending on appEpoch time
   If window exists for particular deviceid then use it
   or create a new and return it 
 */
var findDataForWindow = function(apData, window, deviceId) {
	var promise = new Appacitive.Promise();
	
	// If data object is set in socket, and its window is similar to passed in window then use it directly
  if (apData) {
    if (apData.get('window') == window) {
      promise.resolve(apData);
      return promise;
    }
  } 
	
  // Create query to search checkin which has following window and deviceId
  var query = new Appacitive.Queries.FindAllQuery({
		pageSize: 1,
		type: 'checkins',
		filter: Appacitive.Filter.And(
		Appacitive.Filter.Property('window').equalToNumber(window),
		Appacitive.Filter.Property('deviceid').equalTo(deviceId)),
		fields: ['*']
	});
 
  /* Fetch checkin for the window
     If no checkin is found then we create a new checkin object and return it 
     else we return found object
   */
	query.fetch().then(function(results) {
		if (results.total == 0) {
			promise.resolve(new Appacitive.Object('checkins'));
		} else {
			promise.resolve(results[0]);
		}
	}, function(err) {
		promise.reject(err);
	});

	return promise;
};

/* Send a Push notification to tracker user and also adds a new panic object
   Connects the new panic object to tracker via panic_history relation
 */
var sendPanicMessage = function(socket, message, geoCode) {
    // If message type is panic then set it in type
    if (message.t && message.t == '1') {
      var panic = new Appacitive.Object('panic').set('geocode', geoCode);
      var tracker_history = new Appacitive.Connection({
        relation: 'panic_history',
        endpoints: [{ 
          object: panic,
          label: 'panic'
        }, {
          object: socket.tracker,
          label: 'tracker'
        }]
      });

      tracker_history.save();

      sendPushNotification(socket.tracker);
    } 
};

// Updates existing tracker information with passed in geocode and battery information
var updateTrackerPosition = function(socket, message, geoCode) {

  /* Sets exisiting location of the tracker and saves it
     Looks for panic message, if t = 1, then it will send a panic message
   */
	var updateTracker = function() {
    if (message.b) socket.tracker.set('battery', message.b);
    
    if (socket.tracker.isNew()) {
		  socket.tracker.set('geocode', geoCode);
      
      socket.tracker.save(function() {
				sendPanicMessage();
			});
			return;
		} else {
      if (geoCode.lat !== 0 && geoCode.lng !== 0) {
        socket.tracker.set('geocode', geoCode);
        socket.tracker.save();
      }
		}
    sendPanicMessage(socket, message, geoCode);
	};

  // If socket already has tracker object then no need to fetch it 
	if (socket.tracker) {
		updateTracker();
		return;
	}

  // Create query to search tracker which has following deviceId
	var query = new Appacitive.Queries.FindAllQuery({
		pageSize: 1,
		type: 'tracker',
		filter: Appacitive.Filter.Property('deviceid').equalTo(message.did),
		fields: []
	});


  /* Fetch tracker for the deviceId
     If no tracker is found then we create a new tracker object and return it 
     else we return found tracker object
   */
	query.fetch().then(function(results) {
		if (results.total == 0) {
      sys.puts("Creating tracker");
			socket.tracker = new Appacitive.Object('tracker');
		} else {
			sys.puts("Found tracker with id " + results[0].id());
      socket.tracker = results[0];
		}
    socket.tracker.set('deviceid', message.did);
		updateTracker();
	}, function(err) {
		sys.puts(JSON.stringify(err));
	});
};

var insertInData = function(message, geoCode, socket) {
  // Create Appacitive article object of type 'data'
  var tempData = new Appacitive.Object('data');

  // Set geoCode
  tempData.set('geocode', geoCode);

  // Set deviceid
  tempData.set('deviceid', message.did);

  if (message.b) tempData.set('battery', message.b);

  if (message.tr) tempData.set('triangulation', message.tr);

  if (message.t) tempData.set('type', message.t);

  if (message.d) tempData.set('dimension', message.d);

  if (message.sq) tempData.set('signalquality', message.sq);

  if (message.cid) tempData.set('cid', message.cid);

  // Save the object
  tempData.save().then(function() {
    sys.puts("New data object created with id : " + tempData.id());
    if(socket.writable) socket.write(firmwareVersion + "|200|" + ((message.cid) ? message.cid : 0) + "|" + tempData.id());
  }, function(err) {
    sys.puts(JSON.stringify(err));
    if(socket.writable) socket.write(firmwareVersion + "|500|" + ((message.cid) ? message.cid : 0));
  });
};

exports.addData = function(message, socket) {
	 
    // Get window and displacement from current window
    var diffWindow = epoch.getWindowWithDisplacement();

    // Get Appacitive.GeoCoord object for gc sent in message 
    getGeocode(message).then(function(geoCode) {
      
      // TODO: Temporary for debugging purpose, remove once done

      sendToIntanglesServer(message,geoCode);
      insertInData(message, geoCode, socket);

      // Update tracker position
      try {
        updateTrackerPosition(socket, message, geoCode);
      } catch(e) {
        sys.puts(e.message);
      }

      //If message is of type panic then, no need to checkin
      if (message.t && message.t == 1) {
        if (socket.writable) socket.write(firmwareVersion + "|200|" + ((message.cid) ? message.cid : 0) + "|" + (socket.apData ? socket.apData.id() : 0));
        return;
      } 

      // Find checkin window for current window
      findDataForWindow(socket.apData, diffWindow.window, message.did).then(function(apData) {
         
        // Get checkins property from apdata
        var checkins = apData.tryGet('checkins', '');

        //Append geocode
        checkins += (checkins.length == 0 ? '' : '|') + geoCode.toString() + 'D' + ((message.d) ? message.d : 3) + 'T' + diffWindow.displacement;

        // Set checkins
        apData.set('checkins', checkins);

        // Set window
        apData.set('window', diffWindow.window);

        // Set deviceid
        apData.set('deviceid', message.did);

        // Set fields
        apData.fields(["__utcdatecreated", "__utclastupdateddate"]);

        //Set object in socket of its not panic action
        socket.apData = apData;

        // Save the object
        return apData.save();
      }).then(function(apData) {
          if (apData.created) sys.puts("New checkin object created with id : " + apData.id());
          else sys.puts("Existing checkin object updated with id : " + apData.id());

          // Write 200 message on socket aknowledging success
          //if (socket.writable) socket.write(firmwareVersion + "|200|" + ((message.cid) ? message.cid : 0) + "|" + apData.id());
      }, function(err) {
         sys.puts(JSON.stringify(err));
         //if (socket.writable) socket.write(firmwareVersion + "|500|" + ((message.cid) ? message.cid : 0));
      });
    }, function() {
      // If message is of type panic then just send a panic message
      if (message.t && message.t == '1') {
        updateTrackerPosition(socket, message, new Appacitive.GeoCoord(0, 0));
        if (socket.writable) socket.write(firmwareVersion + "|200|" + ((message.cid) ? message.cid : 0) + "|" + socket.apData ? socket.apData.id() : 0);
        return;
      }
      if (socket.writable) socket.write(firmwareVersion + "|400|" + ((message.cid) ? message.cid : 0));  
    });  
};

var sendToIntanglesServer = function(message,geoCode){
  var timestamp = new Date().getTime();
  var options = {
    host: 'dev-ct.intangles.com',
    port : 4000,
    path  : '/data',
    method: 'POST',
    headers : {'Content-Type': 'application/json'}
  };

  var data = 
  {
    imei : message.did,
    latlng : geoCode.toString(),
    timestamp : timestamp,
    battery : message.b,
    fix : ((message.d) ? message.d : 3)
  };

  var request = http.request(options,function(res){
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      var resultObject = JSON.parse(responseString);
    });
  });

  request.write(JSON.stringify(data));
  request.end();
};

exports.setFirmwareVersion = function(ver) {
  firmwareVersion = ver;
};