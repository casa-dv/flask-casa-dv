var key = "AIzaSyBLtPceftpSX6ce7Q_7OvudzfBF9sC22-c";
var map = document.getElementById("map");
var req;
var heading;
var pitch;

var adjustments = [

    [ 10,-10], [ 10,  0], [ 10, 20],
    [  0,-10], [  0,  0], [  0, 20],
    [-10,-10], [-10,  0], [-10, 20],

];

for(var i = 0; i<9; i++){
    heading = 160 + adjustments[i][1];
    pitch = 0 + adjustments[i][0];
    lat = stop_details.lat + adjustments[i][0]*0.000006;
    lon = stop_details.lng + adjustments[i][1]*0.000007;
    req = [
        "https://maps.googleapis.com/maps/api/streetview?",
        "size=200x220",
        "&location=", lat,",",lon,
        "&fov=40",
        "&heading=", heading,
        "&pitch=", pitch,
        "&key=", key
    ];
    img = document.createElement("img");
    img.src = req.join("");
    wrap = document.createElement("li");
    wrap.appendChild(img);
    map.appendChild(wrap);
}
