var map = L.map('map');
var lon = -0.125984;
var lat = 51.501603;
map.setView([lat, lon], 15);

var layer = Tangram.leafletLayer({
		scene: "static/daynight.yaml",
		preUpdate: preUpdate,
		postUpdate: postUpdate,
		attribution: '<a href="https://mapzen.com/tangram">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/">Mapzen</a>'
});

var scene = layer.scene;

layer.on('init', function() {
	// everything's good, carry on
	window.addEventListener('resize', resizeMap);
	resizeMap();
});

// Resize map to window
function resizeMap() {
	document.getElementById('map').style.width = window.innerWidth + 'px';
	document.getElementById('map').style.height = window.innerHeight + 'px';
	map.invalidateSize(false);
}

layer.on('error', function(error) {
	// something went wrong
	var noticeTxt, errorEL = document.createElement('div');
	errorEL.setAttribute("class", "error-msg");
		 // WebGL not supported (or at least didn't initialize properly!)
	if (layer.scene && !layer.scene.gl) {
		noticeTxt = document.createTextNode("Your browser doesn't support WebGL. Please try with recent Firefox or Chrome, Tangram is totally worth it.");
		errorEL.appendChild(noticeTxt);
	 }
	 // Something else went wrong, generic error message
	 else {
		noticeTxt = document.createTextNode("We are sorry, but something went wrong, please try later.");
		errorEL.appendChild(noticeTxt);
	 }
	 document.body.appendChild(errorEL);
});

layer.addTo(map);


function preUpdate(will_render) {
		if (!will_render) {
				return;
		}
		daycycle();
}

function postUpdate() {
}

function daycycle() {
		d = new Date();
		t = d.getTime()/10000;

		x = Math.sin(t);
		y = Math.sin(t+(3.14159/2)); // 1/4 offset
		z = Math.sin(t+(3.14159)); // 1/2 offset

		scene.view.camera.axis = {x: x, y: y};

		// offset blue and red for sunset and moonlight effect
		B = x + Math.abs(Math.sin(t+(3.14159*0.5)))/4;
		R = y + Math.abs(Math.sin(t*2))/4;

		scene.lights.sun.diffuse = [R, y, B, 1];
		scene.lights.sun.direction = [x, 1, -0.5];

		px = Math.min(x, 0); // positive x
		py = Math.min(y, 0); // positive y
		// light up the roads at night
		scene.styles.roads.material.emission.amount = [-py, -py, -py, 1];
		// turn water black at night
		scene.styles.water.material.ambient.amount = [py+1, py+1, py+1, 1];
		scene.styles.water.material.diffuse.amount = [py+1, py+1, py+1, 1];

		// turn up buildings' ambient response at night
		ba = -py*0.75+0.75;
		scene.styles.buildings.material.ambient.amount = [ba, ba, ba, 1];

		scene.animated = true;
}