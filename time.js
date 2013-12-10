
var appEpochTime = Math.floor(new Date("2013-12-09T00:00:00.000Z").getTime() / 1000);
var windowTime = 3600; // In seconds

exports.getWindowWithDisplacement = function() {
	// Get existingtime in seconds
	var existingTime = Math.floor(new Date().getTime() / 1000);
	
	// Calculate window
	var diff = existingTime - appEpochTime;
	var remainder = diff % windowTime;
	var window = diff;
	if (remainder !== 0) window = diff - remainder;
	
	// Calculate displacement 
	return {
		displacement: remainder,
		window: Math.floor(window/windowTime)
	};
};
