//var http = require('follow-redirects').http;
//var parseString = require('xml2js').parseString;
var sys = require("sys");
    Appacitive = require('./AppacitiveSDK.js'),
    redisClient = require('./redisClient.js'),
    spawn = require('child_process').spawn;

/* Returns cell tower location by calling opencellid API
 */
/*
var getCellTowerLocation = function(tower) {
	var promise = new Appacitive.Promise();

	var request = new Appacitive.HttpRequest();
	//request.url = "http://www.opencellid.org/cell/get?mcc=404&mnc=86&cellid=4791&lac=50025&fmt=txt";
	request.url = String.format("http://217.110.107.122/gpsSuiteCellIDServer/cell/get?mcc={0}&mnc={1}&cellid={2}&lac={3}&fmt=txt", 
												tower.mcc, tower.mnc, tower.cellId, tower.lac);

	request.headers.push({ key: 'content-type', value: 'text/plain'});
	request.send().then(function(response) {
	    parseString(response ,function(err, obj) {
	      if (err) {
	      	promise.reject();
	      } else {
		      if (obj.rsp.err) {
		      	 sys.puts(obj.rsp.err[0]["$"].info);
		      	 promise.reject();
			  } else {
			  	tower = obj.rsp.cell[0]["$"]; 
			    sys.puts(JSON.stirngify(tower));
			    promise.fulfill(tower);
			  }
			}
	    });
	}, function(e) {
	  sys.puts('problem with request: ' + e.message);
	  promise.reject();
	});

	return promise;
};*/

/* Returns cell tower location by fetching from redis or by calling google API
   Execute cell.py to get location for specified cellId and lac
 */ 
var getCellTowerLocation = function(tower) {
	var promise = new Appacitive.Promise();
	var copy = tower;

	redisClient.getTower(tower).then(function(res) {
		tower.lat = res.lat;
		tower.lng = res.lng;
		promise.fulfill(tower);
	}, function() {

		var cell = spawn('python',["cell.py", tower.cellId, tower.lac]);
	    
	    cell.stdout.setEncoding('utf8')
	    cell.stdout.on('data', function (data) {
	      var geoCode;
	      sys.puts(data);
	      try {
	      	var split = data.split(',');
	      	sys.puts(split[0] + "," + split[1])
	      	geoCode = new Appacitive.GeoCoord(split[0], split[1]);
	      } catch(e) {
	      	sys.puts(e.message);
	      	promise.reject();
	      	return;
	      }
	      tower.lat = geoCode.lat;
	      tower.lng = geoCode.lng;
	      redisClient.addTower(tower);
	    });

	    /*
	    cell.stderr.setEncoding('utf8')
	    cell.stderr.on('data', function (data) {
	      sys.puts(data);
	    });*/

	    cell.on('close', function (code) {
	      if (code == 0 && tower.lat && tower.lng) {
	      	tower.signal = copy.signal;
	      	promise.fulfill(tower);
	      } else {
	        promise.reject();
	      }
	    });

	});
    return promise;
};

/* Parses triangInfo to extract tower info from it
   and get rid of trash info
 */
var getCellTowers = function(triangInfo, signalStrength) {
	var split = triangInfo.split(',');
	var towers = [];

	var percentage = 100;

	for (var i = 0; i < split.length; i = i + 1) {
		var str = split[i];
		if (str == '404' || str == '405') {
			var tower = { 
				mcc : str,
				mnc: split[i + 1],
				lac: split[i + 2],
				cellId: split[i + 3]
			};

			if (!tower.mnc || tower.mnc.trim().length == 0 || tower.mnc == '404' || tower.mnc == '405') {
				continue;
			}

			if (!tower.lac || tower.lac.trim().length == 0 || tower.mnc == '404' || tower.mnc == '405') {
				i = i + 1;
				continue;
			}

			if (!tower.cellId || tower.cellId.trim().length == 0 || tower.mnc == '404' || tower.mnc == '405') {
				i = i + 2
				continue;
			}

			tower.lac = parseInt(tower.lac, 16);
			tower.cellId = parseInt(tower.cellId, 16);
			
			//Mean signal strength calculation
			tower.signal = (percentage * signalStrength)/100;
			percentage -= 10;
			towers.push(tower);
		}
	}

	return towers;
};

/* Returns all cellTowers With their locations
   It includes parsing triangInfo
   and getting their location from opencellid API
 */
var getCellTowersWithLocations = function(triangInfo, signalStrength) {
	var promise = new Appacitive.Promise();

	var towers = getCellTowers(triangInfo, signalStrength);

	if (towers.length < 1) { 
		promise.reject();
	} else {
		var tasks = [];
		towers.forEach(function(t) {
			tasks.push(getCellTowerLocation(t));
		});

		Appacitive.Promise.when(tasks).then(function(op) {
			promise.fulfill(op);
		}, function(e, op) {
			if (op && op.length > 0) {
				promise.fulfill(op);
			} else {
				promise.reject();
			}
		});
	}
	return promise;
};

// Triangulates tower locations to find approximate geoCode of device
var getTriangulatedGeocode = function(towers) {

    // For now just calculate center of the co-ordinates
    /*
	var total = towers.length;

    var X = 0.0;
    var Y = 0.0;
    var Z = 0.0;

    towers.forEach(function(i) {

        var lat = i.lat * Math.PI / 180;
        var lng = i.lng * Math.PI / 180;

        var x = Math.cos(lat) * Math.cos(lng);
        var y = Math.cos(lat) * Math.sin(lng);
        var z = Math.sin(lat);

        X += x;
        Y += y;
        Z += z;
    });

    X = X / total;
    Y = Y / total;
    Z = Z / total;

    var lng = Math.atan2(Y, X);
    var hyp = Math.sqrt(X * X + Y * Y);
    var lat = Math.atan2(Z, hyp);

    return new Appacitive.GeoCoord(lat*180/Math.PI, lng*180/Math.PI);*/

    //Will be used when we start recieving signal strength
	var weights = [];
	var sumOfWeights = 0;
	var lat = 0, lng = 0;
	
	// Calculate sum of signals of all towers
	towers.forEach(function(t) {
		sumOfWeights += t.signal; 
	});

	// Iterate over each tower and calculate its weight and then add it to lat and lng
	towers.forEach(function(t) {
		var weight = t.signal/sumOfWeights;
		lat += t.lat * weight;
		lng += t.lng * weight;
	});

	return new Appacitive.GeoCoord(lat, lng);
};

// Returns a promise which if successful contains a triangulated Appacitive.GeoCoord geocode object
var getGeocode = function(triangInfo, signalStrength) {
	var promise = new Appacitive.Promise();

	getCellTowersWithLocations(triangInfo, signalStrength).then(function(towers) {
		var geoCode = getTriangulatedGeocode(towers);
		promise.fulfill(geoCode);
	}, function() {
		promise.reject();
	});

	return promise;
};

exports.getGeocode = getGeocode;