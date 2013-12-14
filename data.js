// Include Appacitive SDK 
var Appacitive = require('./AppacitiveSDK.js'),
	epoch = require('./time.js'),
	sys = require('sys');

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
  // validate the geocode
  try {
    return new Appacitive.GeoCoord(geoCode);
  } catch(e) {
    return false;
  }
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

var findDataForWindow = function(apData, window, deviceId) {
	var promise = new Appacitive.Promise();
	
	// If data article is set in socket, and its difference between created and updated date is lessthan 1 hour then use it directly
    if (apData) {
      if (apData.get('window') == window) {
        promise.resolve(apData);
        return promise;
      }
    } 
	
    var query = new Appacitive.Queries.FindAllQuery({
		pageSize: 1,
		schema: 'checkins',
		filter: Appacitive.Filter.And(
			Appacitive.Filter.Property('window').equalToNumber(window),
			Appacitive.Filter.Property('deviceid').equalTo(deviceId)),
		fields: ['*']
	});

	query.fetch().then(function(results) {
		if (results.total == 0) {
			promise.resolve(new Appacitive.Article('checkins'));
		} else {
			promise.resolve(results[0]);
		}
	}, function(err) {
		promise.reject(err);
	});

	return promise;
};

var updateTrackerPosition = function(socket, message, geoCode) {
	
	var sendPanicMessage = function() {
		// If message type is panic then set it in type
      if (message.t && message.t == '1') {
          var panic = new Appacitive.Article('panic').set('geocode', geoCode);
          var tracker_history = new Appacitive.Connection({
          	relation: 'panic_history',
          	endpoints: [{ 
          		article: panic,
          		label: 'panic'
          	}, {
          		article: socket.tracker,
          		label: 'tracker'
          	}]
          });

          tracker_history.save();

          sendPushNotification(socket.tracker);
      } 
	};

	var updateTracker = function() {
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
    sendPanicMessage();
	};

	if (socket.tracker) {
		updateTracker();
		return;
	}

	var query = new Appacitive.Queries.FindAllQuery({
		pageSize: 1,
		schema: 'tracker',
		filter: Appacitive.Filter.Property('deviceid').equalTo(message.did),
		fields: []
	});

	query.fetch().then(function(results) {
		if (results.total == 0) {
      sys.puts("Creating tracker");
			socket.tracker = new Appacitive.Article('tracker');
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

exports.addData = function(message, socket) {
	// Get Appacitive.GeoCoord object for gc sent in message
      var geoCode = getGeocode(message.gc);

      // If geoCode is valid then create
      if (geoCode) {

      	if (geoCode.lat == 0 && geoCode.lng == 0) {
          if (message.t && message.t == '1') {
            updateTrackerPosition(socket, message, geoCode);
          }
          if (socket.writable) socket.write("200|" + ((message.cid) ? message.cid : 0) + "|" + socket.apData ? socket.apData.id() : 0);
          return;
        } 

      	try {
  			  updateTrackerPosition(socket, message, geoCode);
      	} catch(e) {
      		sys.puts(e.message);
      	}

    	  // Get window and displacement from current window
        var diffWindow = epoch.getWindowWithDisplacement();

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

	        // set attributes
		    /*for(var p in message) {
		      if (p != 'gc' && p != 'did' && p != 'cid' && p!== 't') {
		        sys.puts(p);
		        if (typeof message[p] == 'object') {
		          apData.attr(p, JSON.stringify(message[p]));
		        } else {
		          apData.attr(p, message[p].toString());
		        }
		      }
		    }*/

	        //Set object in socket of its not panic action
	        socket.apData = apData;

	        // Save the object
	        return apData.save();
        }).then(function(apData) {
          	if (apData.created) sys.puts("New data article created with id : " + apData.id());
          	else sys.puts("Existing data article updated with id : " + apData.id());

          	// Write 200 message on socket aknowledging success
          	if (socket.writable) socket.write("200|" + ((message.cid) ? message.cid : 0) + "|" + apData.id());
        }, function(err) {
           sys.puts(JSON.stringify(err));
           if (socket.writable) socket.write("500|" + ((message.cid) ? message.cid : 0));
        });

        return;
    } else if (message.t && message.t == '1') {
        updateTrackerPosition(socket, message, new Appacitive.GeoCoord(0, 0));
        if (socket.writable) socket.write("200|" + ((message.cid) ? message.cid : 0) + "|" + socket.apData ? socket.apData.id() : 0);
        return;
    }
    if (socket.writable) socket.write("400");	
};