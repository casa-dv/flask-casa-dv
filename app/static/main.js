/*jslint browser: true*/
/*global Tangram, L */

APP = (function () {

	var APP = {

	};
	APP.maps = {
		buses: undefined,
		places: undefined,
		events: undefined
	};
	APP.data ={};
	var base_url;

	var url = document.location + "";
	if(url.match("localhost")){
		base_url = "http://localhost:5000";
	} else {
		base_url = "http://casa-dv.made-by-tom.co.uk";
	}

	var now = APP.now = moment().valueOf();
	var then = APP.then = moment().add(7,'days').valueOf();
	var radius = APP.radius = 300;

	var location = APP.location = {
		lat:51.501603,
		lng:-0.125984,
		zoom: 16
	};
	if (window.stop_details){
		location.lat = stop_details.lat;
		location.lng = stop_details.lng;
	}

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
						// if(+moment(value).format('k') === 24){
						// 	return moment(value).format('dddd');
						// } else {
						// 	return moment(value).format('ha');
						// }
					}
				}
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

	function load_weather(weather) {
		APP.data.weather = weather;
	}

	function getWeatherAtTime(time){
		//takes the time
		if(meteo && meteo.hourly && meteo.hourly.data) {
			// looks in the array of hourly data
			var hourly = meteo.hourly.data;

			var diff = time - slider.start;
			var index = Math.floor(diff / 1000 / 60 / 60);
			return hourly[index];
		}
	}

	function load_plaques(plaques) {
		if(!plaques.features){
			return;
		}
		L.geoJson(plaques,{
			pointToLayer: function(feature, latlng) {
				var myIcon = L.icon({
					iconUrl: "/static/icons/plaques.png",
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				});

				return L.marker(latlng, {icon: myIcon});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					var props = feature.properties;
					document.querySelector(".place_title").textContent = props.inscription;
					// TODO active/selected state per marker
				});
			}
		}).addTo(APP.maps.places);
	}

	function load_wiki(wiki) {
		L.geoJson(wiki,{
			pointToLayer: function(feature, latlng) {
				var myIcon = L.icon({
					iconUrl: "/static/icons/wikipedia.png",
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				});

				return L.marker(latlng, {icon: myIcon});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					console.log(feature.properties);
				});
			}
		}).addTo(APP.maps.places);

		route_to(
			location,
			{
				lng: wiki.features[0].geometry.coordinates[0],
				lat: wiki.features[0].geometry.coordinates[1]
			},
			APP.maps.places
		);
	}

	function load_places(places) {

	}

	function load_events(events) {
		if(!events.features){
			return;
		}
		L.geoJson(events,{
			pointToLayer: function(feature, latlng) {
				var icon;
				switch (feature.properties.category) {
					case 'Business & Education':
						icon = "education.png";
						break;
					case 'Culture & Art':
						icon = "culture.png";
						break;
					case 'Fashion & Health':
						icon = "beauty.png";
						break;
					case 'Food & Drink':
						icon = "restaurant.png";
						break;
					case 'Melting Pot & Co':
						icon = "melting-pot.png";
						break;
					case 'Sport & Travel':
						icon = "sport.png";
						break;
					default:
						icon = "melting-pot.png";
						break;
				}
				var myIcon = L.icon({
					iconUrl: "/static/icons/"+icon,
					// iconRetinaUrl: 'my-icon@2x.png',
					// iconSize: [48, 48],
					// iconAnchor: [24, 24]
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				});

				return L.marker(latlng, {icon: myIcon});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					console.log(feature.properties);
				});
			}
		}).addTo(APP.maps.events);
	}

	function load_tfl(tfl){
		if (!tfl.places){
			return;
		}
		var t;
		var myIcon;
		for (var i = tfl.places.length - 1; i >= 0; i--) {
			t = tfl.places[i];
			if(t.id == stop_details.id){
				continue;
			}
			if (t.placeType == "StopPoint"){
				if (t.stopType == "NaptanPublicBusCoachTram" || t.stopType == "NaptanOnstreetBusCoachStopPair"){
					myIcon = L.icon({
						iconUrl: "/static/icons/bus.png",
						iconSize: [32, 32],
						iconAnchor: [16, 16]
					});
					L.marker([t.lat,t.lon], {icon: myIcon}).addTo(APP.maps.buses);
					continue;
				}
			}
			if (t.placeType == "BikePoint"){
					myIcon = L.icon({
						iconUrl: "/static/icons/bike.png",
						iconSize: [32, 32],
						iconAnchor: [16, 16]
					});
					L.marker([t.lat,t.lon], {icon: myIcon}).addTo(APP.maps.buses);
					continue;
			}
		}
	}

	function route_to(start,end,map){
		var control = L.Routing.control({
			waypoints: [
				L.latLng(start),
				L.latLng(end)
			],
			draggableWaypoints: false,
			addWaypoints: false,
			createMarker: function(i,w){
				return blackDot(w.latLng);
			},
			autoRoute: false,
			show: false,
			fitSelectedRoutes: true, // enable auto-zoom
			lineOptions: {
				styles: [{color: 'black', opacity: 1, weight: 9}],
				missingRouteStyles: [{color: 'black', opacity: 1, weight: 9}]
			}
		}).addTo(map);
		control.route();
	}

	function blackDot(ll){
		return L.circleMarker(ll, {
			fillColor:"#000",
			fillOpacity:1,
			stroke: false,
			radius: 12,
			clickable: false
		});
	}

	function draw(){
		update_time_globals();
	}

	function setup(){
		APP.maps.buses = load_map('map_buses',location);
		APP.maps.places = load_map('map_places',location);
		APP.maps.events = load_map('map_events',location);

		var ll = L.latLng(location);
		blackDot(ll).addTo(APP.maps.buses);
		blackDot(ll).addTo(APP.maps.places);
		blackDot(ll).addTo(APP.maps.events);

		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=cafe,restaurant,park,atm",load_places);
		d3.json(base_url+"/plaques?lat="+location.lat+"&lon="+location.lng,load_plaques);
		d3.json(base_url+"/dbpedia?lat="+location.lat+"&lon="+location.lng,load_wiki);
		d3.json(base_url+"/eventbrite?lat="+location.lat+"&lon="+location.lng,load_events);
		d3.json(base_url+"/forecast?lat="+location.lat+"&lon="+location.lng,load_weather);
		d3.json(base_url + "/tfl/Place?lat="+location.lat+"&lon="+location.lng+"&radius="+radius,load_tfl);

		var slider = document.getElementById('timeline');
		create_timeline(slider);

		window.sliderSliderStart = now;
		window.sliderTime = now;
		update_time_globals();
		if(autoplay){
			window.requestAnimationFrame(draw);
		}
	}

	setup();

	return APP;
}());