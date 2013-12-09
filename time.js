
var appEpochTime = Math.floor((new Date("2013-12-09T00:00:00.000Z").getTime() / 1000)/ 60);
var windowTime = 60; // In minutes

exports.getWindow = function() {
	var existingTime = Math.floor((new Date().getTime() / 1000)/60);
	var diff = existingTime - appEpochTime;
	var remainder = diff % 60;
	if (remainder == 0) {
		return (diff / 60);
	} else {
		return (diff - remainder)/60;
	}
};

exports.getWindowWithDisplacement = function() {
	// Get exitingtime in minutes;
	var existingTime = Math.floor((new Date().getTime() / 1000)/60);
	
	// Calculate window
	var diff = existingTime - appEpochTime;
	var remainder = diff % 60;
	var window = diff;
	if (remainder % 60 !== 0) window = diff - remainder;
	// Calculate displacement 
	return {
		displacement: remainder * 60,
		window: window/60
	};
};
