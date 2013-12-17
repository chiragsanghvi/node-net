var getCentrePointFromListOfCoordinates = function(coordList) {
    var total = coordList.length;

    var X = 0.0;
    var Y = 0.0;
    var Z = 0.0;

    coordList.forEach(function(i) {

        var lat = i.lat * Math.PI / 180;
        var lon = i.lon * Math.PI / 180;

        var x = Math.cos(lat) * Math.cos(lon);
        var y = Math.cos(lat) * Math.sin(lon);
        var z = Math.sin(lat);

        X += x;
        Y += y;
        Z += z;
    });

    X = X / total;
    Y = Y / total;
    Z = Z / total;

    var lon = Math.atan2(Y, X);
    var hyp = Math.sqrt(X * X + Y * Y);
    var lat = Math.atan2(Z, hyp);

    return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
};

var center = getCentrePointFromListOfCoordinates([{
    lat: 18.518797,
    lon: 73.854390
}]);

console.log(center);

