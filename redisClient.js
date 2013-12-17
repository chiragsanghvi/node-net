var redis = require("redis"),
    client = redis.createClient(6379, "127.0.0.1", {
    	socket_nodelay: true
    }),
    Appacitive = require('./AppacitiveSDK.js');

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
    console.log("Error " + err);
});

var getKey = function(tower) {
	return tower.mcc + "_" + tower.mnc + "_" + tower.lac + "_" + tower.cellId; 
};

exports.addTower = addTower = function(tower) {
	var key = getKey(tower);
	try {
		client.HMSET(key, tower);	
	} catch(e) {
		console.log("Error " + e);
	}
};

exports.getTower = getTower = function(tower) {
	var promise = new Appacitive.Promise();
	var key = getKey(tower); 
	client.hgetall(key, function (err, obj) {
	    if (err || !obj) {
	    	promise.reject();
	    } else {
	    	promise.fulfill(obj);
	    }
	});
	return promise;
};

/*setTimeout(function() {

	addTower({ mcc: 404, mnc: 86, cellId: 4791, lac: 50025, lat: 10 , lng: 20 });
	getTower({ mcc: 404, mnc: 86, cellId: 4791, lac: 50025 }).then(function(tower) {
		console.log(tower)
	}, function() {
		console.log("error");
	});

}, 0000);*/