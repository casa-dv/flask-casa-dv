(function(){

	function load_map(id,options){
		var map = L.map(id,
			{
			}
		);
		map.setView([options.lat, options.lng], options.zoom);

		var mapbox_style_light = "annabannanna/ciod0h6u500dcb1nhx8jebkx4";
		var mapbox_style_contrast = "annabannanna/ciotz5593002ldqnf8a87z6jg";

		var mapbox_key = "pk.eyJ1IjoiYW5uYWJhbm5hbm5hIiwiYSI6ImNpbWdscW40bDAwMDgzNG0yZ2FxYTNhZ2YifQ.VmWzlEEOgWa4ydTmqfS06g";
		var mapbox_url = "https://api.mapbox.com/styles/v1/"+mapbox_style_light+"/tiles/{z}/{x}/{y}?access_token="+mapbox_key;

		var layer = L.tileLayer(mapbox_url, {
			attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		map.on("moveend zoomend",set_location_hash);

		return map;
	}

	function set_location_hash(){
		var centre = map.getCenter();
		window.location.hash = 'zoom=' + map.getZoom() + '&lng=' + centre.lng.toFixed(4) + '&lat=' + centre.lat.toFixed(4);
	}

	function update_options_from_hash(options){
		var hash = window.location.hash;
		if (hash.length){
			var elements = hash.substring(1).split('&');
			for (var i = 0; i < elements.length; i++) {
				var pair = elements[i].split('=');
				options[pair[0]] = pair[1];
			}
		}
		return options;
	}
	function get_json(url,cb){
		var r = new XMLHttpRequest();
		r.addEventListener("load", cb);
		r.open("GET", url);
		r.send();
	}

	var options = {
		lat: 51.4987,
		lng: -0.0618,
		zoom: 11
	};
	update_options_from_hash(options);
	function limit_map_height(){
		document.querySelector(".map-wrap").setAttribute("style", "max-width:"+window.innerHeight+"px;");
	}
	window.addEventListener("resize",limit_map_height);
	limit_map_height();
	var map = load_map("map",options);
	d3.json('/static/data/all-stops.geojson.json', function(response){
		var cluster = L.markerClusterGroup({ chunkedLoading: true });
		L.geoJson(response,{
			onEachFeature: function(feature, layer){
				layer.on("click",function(){
					console.log(feature.properties);
				});
				// layer.bindPopup("<a href=\""+feature.properties.wikipedia_url+"\">"+feature.properties.wikipedia_url+"</a>")
			},
			pointToLayer: function( featureData, latlng ){
				var myIcon = L.divIcon({
					className: 'marker-busstop',
					html: [
						'<img tabindex="0" src="http://localhost:5000/static/images/marker-icon.png">',
						"<p>",
						featureData.properties.name,
						"</p>"
					].join("")
				});
				// you can set .my-div-icon styles in CSS
				return L.marker(latlng, {icon: myIcon});
			}
		}).addTo(cluster);
		map.addLayer(cluster);
	});
}());