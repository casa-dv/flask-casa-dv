/*jslint browser: true*/
/*global Tangram, L */

APP = (function () {

	var APP = {};
	var base_url;

	var location = document.location + "";
	if(location.match("localhost")){
		base_url = "http://localhost:5000";
	} else {
		base_url = "http://casa-dv.made-by-tom.co.uk";
	}

	var now = moment().valueOf();
	var then = moment().add(7,'days').valueOf();

	var location = {
		lat:51.501603,
		lng:-0.125984,
		zoom: 16
	};
	if (window.stop_details){
		location.lat = stop_details.lat;
		location.lng = stop_details.lng;
	}

	var map_buses;
	var map_places;
	var map_events;

	function load_map(id,location){
		var map = L.map(id,
			{
				zoomControl: false,
				attributionControl:false,
				dragging: false,
				touchZoom: false,
				scrollWheelZoom: false,
				doubleClickZoom: false,
				boxZoom: false,
				tap: false,
				keyboard: false
			}
		);
		map.setView([location.lat, location.lng], location.zoom);

		var mapbox_style_light = "annabannanna/ciod0h6u500dcb1nhx8jebkx4";
		var mapbox_style_contrast = "annabannanna/ciotz5593002ldqnf8a87z6jg";

		var mapbox_key = "pk.eyJ1IjoiYW5uYWJhbm5hbm5hIiwiYSI6ImNpbWdscW40bDAwMDgzNG0yZ2FxYTNhZ2YifQ.VmWzlEEOgWa4ydTmqfS06g";
		var mapbox_url;
		if(id === "map_places"){
			mapbox_url = "https://api.mapbox.com/styles/v1/"+mapbox_style_light+"/tiles/{z}/{x}/{y}?access_token="+mapbox_key;
		} else {
			mapbox_url = "https://api.mapbox.com/styles/v1/"+mapbox_style_contrast+"/tiles/{z}/{x}/{y}?access_token="+mapbox_key;
		}

		var layer = L.tileLayer(mapbox_url, {
			attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(map);

		// var layer = Tangram.leafletLayer({
		// 	scene: 'static/scene.yaml',
		// 	preUpdate: pre_update,
		// 	// attribution: '<a href="https://mapzen.com/tangram" target="_blank">Tangram</a> | &copy; OSM contributors | <a href="https://mapzen.com/" target="_blank">Mapzen</a>'
		// 	attribution: ''
		// });
		// window.addEventListener('load', function () {
		// 	layer.addTo(map);
		// });
		return map;
	}

	function pre_update(will_render) {
		if (!will_render) {
			return;
		}
		daycycle(this);
	}

	function daycycle(scene) {
		var t = window.sliderTime; // unix ms
		var h = window.sliderHour;
		var hx = window.sliderHourIndex;
		var dx = window.sliderDayIndex;

		var w = (3.14159 * (h / 12)) + 3.14159;

		var x = Math.sin(w);
		var y = Math.sin(w+(3.14159/2)); // 1/4 offset

		// offset blue and red for sunset and moonlight effect
		var B = x + Math.abs(Math.sin(t+(3.14159*0.5)))/4;
		var R = y + Math.abs(Math.sin(t*2))/4;

		scene.lights.sun.diffuse = [R, y, B, 1]; // TODO look in weather for colours and sunsetTime/sunriseTime
		scene.lights.sun.direction = [x, 1, -0.5];

		var px = Math.min(x, 0); // positive x
		var py = Math.min(y, 0); // positive y

		// light up the roads at night
		scene.styles["roads"].material.emission.amount = [-0.5-py, -0.5-py, -0.5-py, 1];

		// turn water black at night
		scene.styles["water"].material.ambient.amount = [py+1, py+1, py+1, 1];
		scene.styles["water"].material.diffuse.amount = [py+1, py+1, py+1, 1];

		// turn up buildings' ambient response at night
		var ba = -py*.75+.75;
		scene.styles["buildings"].material.ambient.amount = [ba, ba, ba, 1];

		scene.animated = true;
	}

	function update_time_globals(){
		var t = window.sliderTime;
		window.sliderHour = (+(moment(t).format('k')) - 1);
		window.sliderHourIndex = Math.floor((t - window.sliderSliderStart)/(1000*60*60));
		window.sliderDayIndex = Math.floor(window.sliderHourIndex / 24);
	}

	function create_timeline(slider){
		noUiSlider.create(slider, {
			start: now,
			step: 1000*60*60, // ms
			range: {
				'min': now,
				'max': then
			},
			pips: { // Show a scale with the slider
				mode: 'steps',
				density: 3,
				filter: function(value,type){
					var hour = +moment(value).format('k');
					if(hour === 24){
						return 1;
					}
					if (hour % 6 === 0){
						return 2;
					}
					return 0;
				},
				format: {
					to: function(value){
						return '';	// display no labels
						if(+moment(value).format('k') === 24){
							return moment(value).format('dddd');
						} else {
							return moment(value).format('ha');
						}
					}
				},
				tooltips: true
				// tooltips: [function(value){
				// 	return moment(value).format('ha');
				// }]
			}
		});
		slider.noUiSlider.on('update', function( values, handle ) {
			window.sliderTime = parse_slider_value(values);
			update_time_globals();
		});
		return slider;
	}

	function parse_slider_value(values){
		return +(values[0]);
	}

	function get_json(url,cb){
		var r = new XMLHttpRequest();
		r.addEventListener("load", cb);
		r.open("GET", url);
		r.send();
	}

	function load_weather() {
		window.weather = JSON.parse(this.responseText);
		console.log(weather);
	}

	function load_plaques() {
		var plaques = JSON.parse(this.responseText);
		L.geoJson(plaques,{
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					var props = feature.properties;
					document.querySelector(".place_title").textContent = props.inscription;
					// TODO active/selected state per marker
				});
			}
		}).addTo(map_places);
	}

	function load_wiki() {
		var wiki = JSON.parse(this.responseText);
		L.geoJson(wiki,{
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					console.log(feature.properties);
				});
			}
		}).addTo(map_places);
	}

	function load_places() {
		var places = JSON.parse(this.responseText);
		console.log(places);
	}

	function load_events() {
		var events = JSON.parse(this.responseText);

		L.geoJson(events,{
			style: function(feature) {
				var color;
				switch (feature.properties.category) {
					case 'Business & Education':
						color = "#ffcccc";
						break;
					case 'Culture & Art':
						color = "#ccffcc";
						break;
					case 'Fashion & Health':
						color = "#ccffff";
						break;
					case 'Food & Drink':
						color = "#ccd9ff";
						break;
					case 'Melting Pot & Co':
						color = "#ffccf2";
						break;
					case 'Sport & Travel':
						color = "#ffff00";
						break;
					default:
						color = "#ffccf2";
						break;
				}
				return {
					fillOpacity: 1,
					color: color
				};
			},
			pointToLayer: function(feature, latlng) {
					return new L.CircleMarker(latlng, {radius: 8, fillOpacity: 0.85});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					console.log(feature.properties);
				});
			}
		}).addTo(map_events);
	}

	function setup(){
		map_buses = load_map('map_buses',location);
		map_places = load_map('map_places',location);
		map_events = load_map('map_events',location);

		get_json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=cafe",load_places);
		get_json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=restaurant",load_places);
		get_json(base_url+"/plaques?lat="+location.lat+"&lon="+location.lng,load_plaques);
		get_json(base_url+"/dbpedia?lat="+location.lat+"&lon="+location.lng,load_wiki);
		get_json(base_url+"/eventbrite?lat="+location.lat+"&lon="+location.lng,load_events);
		get_json(base_url+"/forecast?lat="+location.lat+"&lon="+location.lng,load_weather);

		var slider = document.getElementById('timeline');
		create_timeline(slider);

		window.sliderSliderStart = now;
		window.sliderTime = now;
		update_time_globals();
	}

	setup();

	return APP;


}());