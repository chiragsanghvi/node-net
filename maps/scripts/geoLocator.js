// Initialize it with apikey, appId and env
Appacitive.initialize({
  apikey: 'Wze3QDlA5oM8uHhCK9mTRehqKqJPWKpoOn4u2k+29s8=',
  appId: '43687051486429854',
  env: 'sandbox'
});

google.maps.LatLng.prototype.distanceFrom = function (newLatLng) {
    // setup our variables
    var lat1 = this.lat();
    var radianLat1 = lat1 * (Math.PI / 180);
    var lng1 = this.lng();
    var radianLng1 = lng1 * (Math.PI / 180);
    var lat2 = newLatLng.lat();
    var radianLat2 = lat2 * (Math.PI / 180);
    var lng2 = newLatLng.lng();
    var radianLng2 = lng2 * (Math.PI / 180);
    // sort out the radius, MILES or KM?
    var earth_radius = 3959; // (km = 6378.1) OR (miles = 3959) - radius of the earth

    // sort our the differences
    var diffLat = (radianLat1 - radianLat2);
    var diffLng = (radianLng1 - radianLng2);
    // put on a wave (hey the earth is round after all)
    var sinLat = Math.sin(diffLat / 2);
    var sinLng = Math.sin(diffLng / 2);

    // maths - borrowed from http://www.opensourceconnections.com/wp-content/uploads/2009/02/clientsidehaversinecalculation.html
    var a = Math.pow(sinLat, 2.0) + Math.cos(radianLat1) * Math.cos(radianLat2) * Math.pow(sinLng, 2.0);

    // work out the distance
    var distance = earth_radius * 2 * Math.asin(Math.min(1, Math.sqrt(a)));

    // return the distance
    return distance;
}