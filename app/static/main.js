/*jslint browser: true*/
/*global Tangram, L */

APP = (function () {

	var APP = {
		maps: {},
		routers: {},
		data: {},
		layers: {},
		activeLayers: {}
	};
	var autoplay = APP.autoplay = false;
	var base_url;

	var url = document.location + "";
	if(url.match("localhost")){
		base_url = "http://localhost:5050";
	} else {
		base_url = "http://casa-dv.made-by-tom.co.uk";
	}

	// round back to last hour
	var now = APP.now = moment().valueOf() - (moment().valueOf() % (60*60*1000));
	var then = APP.then = moment(now).add(7,'days').valueOf();
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
		var mapbox_url = "https://api.mapbox.com/styles/v1/"+mapbox_style_light+"/tiles/{z}/{x}/{y}?access_token="+mapbox_key;

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
		var label = document.createElement("div");
		label.setAttribute("class","timeline_label");
		var label_bottom = document.createElement("div");
		label_bottom.setAttribute("class","timeline_label_bottom");
		document.querySelector(".noUi-origin").appendChild(label);
		document.querySelector(".noUi-origin").appendChild(label_bottom);

		slider.noUiSlider.on('update', function( values, handle ) {
			var sliderTime = window.sliderTime = parse_slider_value(values);

			// label Mon 12:05
			var time = moment(sliderTime).format("ddd HH:mm");
			document.querySelector(".timeline_label_bottom").textContent = time;

			display_weather_data(sliderTime);
			update_time_globals();
		});
		return slider;
	}

	function display_weather_data(time){
		var weather = getWeatherAtTime(time);
		if(weather){
			var label = document.querySelector(".timeline_label");
			label.innerHTML = Math.round(weather.temperature) + "&deg;C";
			label.setAttribute("data-weather", weather.icon);
		}
	}

	function parse_slider_value(values){
		return +(values[0]);
	}

	function load_weather(error,weather) {
		APP.data.weather = weather;
		display_weather_data(window.sliderTime);
	}

	function getWeatherAtTime(time){
		var meteo = APP.data.weather;
		if(meteo && meteo.hourly && meteo.hourly.data) {
			// looks in the array of hourly data
			var hourly = meteo.hourly.data;

			var diff = time - APP.now;
			var index = Math.floor(diff / 1000 / 60 / 60);
			return hourly[index];
		}
	}

	function load_plaques(error,plaques) {
		if(!plaques || !plaques.features){
			return;
		}
		var layer = L.geoJson(plaques,{
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
					route_to(APP.location, {
						lng: feature.geometry.coordinates[0],
						lat: feature.geometry.coordinates[1]
					}, "places");
				});
			}
		});

		APP.data.plaques = plaques.features;
		APP.layers.plaques = layer;
	}

	function load_wiki(error,wiki) {
		if(error || !wiki.features){
			return;
		}
		var layer = L.geoJson(wiki,{
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
					show_wiki_data(feature);
					route_to(APP.location, {
						lng: feature.geometry.coordinates[0],
						lat: feature.geometry.coordinates[1]
					}, "places");
				});
			}
		});

		APP.data.wiki = wiki.features;
		APP.layers.wiki = layer;

		show_layer("wiki","places");
		route_layer("wiki","places",0);
		show_wiki_data(wiki.features[0]);
	}

	function show_wiki_data(data){
		if (!data.properties){
			return;
		}
		var props = data.properties;
		var title = decodeURIComponent(props.base).replace(/_/g," ");
		var sub = "Wikipedia";
		var text;
		if (props.description.match(/^Coordinates/)){
			text = "";
		} else {
			text = props.description;
		}

		var desc = [
			"<p>",
			text,
			"</p><p>",
			"<a href=\"",
			props.url,
			"\" target=\"_blank\">Read more on Wikipedia</a>",
			"</p>"
		].join("");

		document.querySelector("#details_places .title").textContent = title;
		document.querySelector("#details_places .subhead").textContent = sub;
		document.querySelector("#details_places .description").innerHTML = desc;
	}

	function load_places_cafe(error,places) {
		load_places_data(error,places,"cafe");
	}
	function load_places_restaurant(error,places) {
		load_places_data(error,places,"restaurant");
	}
	function load_places_atm(error,places) {
		load_places_data(error,places,"atm");
	}
	function load_places_park(error,places) {
		load_places_data(error,places,"park");
	}
	function load_places_data(error,places,type){
		if(error || !places){
			return;
		}
		var layer = get_place_layer(places);
		var idx = "places_"+type;
		APP.data[idx] = places;
		APP.layers[idx] = layer;
	}
	function get_place_layer(places){
		var layer = L.geoJson(places,{
			pointToLayer: function(feature, latlng) {
				if (_.contains(feature.properties.types, "cafe")){
					icon = "coffee.png";
				} else if (_.contains(feature.properties.types, "restaurant")){
					icon = "restaurant.png";
				} else if (_.contains(feature.properties.types, "atm")){
					icon = "atm.png";
				} else if (_.contains(feature.properties.types, "park")){
					icon = "park.png";
				} else {
					return;
				}
				var myIcon = L.icon({
					iconUrl: "/static/icons/"+icon,
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				});

				return L.marker(latlng, {icon: myIcon});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					route_to(APP.location, {
						lng: feature.geometry.coordinates[0],
						lat: feature.geometry.coordinates[1]
					}, "places");
				});
			}
		});
		return layer;
	}

	function load_events(error,events) {
		if(error || !events.features){
			return;
		}
		var layer = L.geoJson(events,{
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
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				});

				return L.marker(latlng, {icon: myIcon});
			},
			onEachFeature: function (feature, layer) {
				layer.on("click",function(){
					show_event_data(feature);
					route_to(APP.location, {
						lng: feature.geometry.coordinates[0],
						lat: feature.geometry.coordinates[1]
					}, "events");
				});
			}
		});

		APP.data.events = events.features;
		APP.layers.events = layer;

		show_layer("events","events");
		route_layer("events","events",0);
		show_event_data(events.features[0]);
	}

	function show_event_data(data){
		if (!data.properties){
			return;
		}
		var props = data.properties;
		var title = props.name;
		var sub = props.category;
		var date;
		var start = moment(props.start);
		var end = moment(props.end);
		if(start.format("ddd") == end.format("ddd")){
			date = start.format("dddd HH:mm")+"&ndash;"+end.format("HH:mm");
		} else {
			date = start.format("dddd HH:mm")+"&ndash;"+end.format("dddd HH:mm");
		}
		if(props.address){
			date += " at "+props.address;
		}
		var desc = [
			"<p>",
			date,
			"</p><p>",
			props.description,
			"</p><p>",
			"<a href=\"",
			props.url,
			"\" target=\"_blank\">Book now on Eventbrite</a>",
			"</p>"
		].join("");

		document.querySelector("#details_events .title").innerHTML = title;
		document.querySelector("#details_events .subhead").textContent = sub;
		document.querySelector("#details_events .description").innerHTML = desc;
	}

	function load_tfl(error,tfl){
		if (error || !tfl.places){
			return;
		}
		var t;
		var myIcon;
		var marker;
		var layer = new L.layerGroup();
		var data = [];
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
					marker = L.marker([t.lat,t.lon], {icon: myIcon});
					marker.on("click",click_tfl);
					marker._tfl_data = t;
					marker.addTo(layer);
					data.push(t);
				}
				continue;
			}
			if (t.placeType == "BikePoint"){
					myIcon = L.icon({
						iconUrl: "/static/icons/bike.png",
						iconSize: [32, 32],
						iconAnchor: [16, 16]
					});
					marker = L.marker([t.lat,t.lon], {icon: myIcon});
					marker.on("click",click_tfl);
					marker._tfl_data = t;
					marker.addTo(layer);
					data.push(t);
					continue;
			}
		}
		APP.data.tfl = data;
		APP.layers.tfl = layer;

		show_layer("tfl","buses");
		route_layer("tfl","buses",0);
		show_tfl_data(data[0]);
	}

	function click_tfl(e){
		console.log(e);
		var data = e.target._tfl_data;
		show_tfl_data(data);
	}
	function show_tfl_data(data){
		var title;
		var sub;
		var desc ="";
		var pos = {lat: data.lat, lng:data.lon};

		if (data.placeType == "StopPoint"){
			title = data.commonName;
			sub = "Bus Stop";
			if(data.indicator){
				title += " " + data.indicator;
			}
			var lines = [];
			if(data.lines){
				for (var i = data.lines.length - 1; i >= 0; i--) {
					lines.push(data.lines[i].name);
				}
			}
			desc = "<p>"+lines.join(", ") + [
			"</p><p><a href=\"https://tfl.gov.uk/plan-a-journey/?from=",
			encodeURIComponent(data.commonName),
			"\" target=\"_blank\">Plan a journey from here with TfL</a></p>"
			].join("");
		} else {
			title = data.commonName;
			sub = "Bike Stand";
			var bikes = _.findWhere(data.additionalProperties,{key:"NbBikes"});
			var docks = _.findWhere(data.additionalProperties,{key:"NbEmptyDocks"});
			if(bikes && docks){
				desc += "Bikes available: "+bikes.value + " Docks available: "+docks.value+"</p>";
			}
			if(APP.activeLayers.buses == "tfl_bikes"){
				route_to(APP.location, pos, "buses");
			}
		}
		document.querySelector("#details_buses .title").textContent = title;
		document.querySelector("#details_buses .subhead").textContent = sub;
		document.querySelector("#details_buses .description").innerHTML = desc;
		route_to(APP.location, pos, "buses");
	}

	function route_to(start,end,map_id){
		var mapbox_key = "pk.eyJ1IjoiYW5uYWJhbm5hbm5hIiwiYSI6ImNpbWdscW40bDAwMDgzNG0yZ2FxYTNhZ2YifQ.VmWzlEEOgWa4ydTmqfS06g";
		var control;
		if(APP.routers[map_id]){
			control = APP.routers[map_id];
			control.setWaypoints([
				L.latLng(start),
				L.latLng(end)
			]);
		} else {
			control = APP.routers[map_id] = L.Routing.control({
				router: L.Routing.mapbox(mapbox_key,{profile:"mapbox.walking"}),
				waypoints: [
					L.latLng(start),
					L.latLng(end)
				],
				draggableWaypoints: false,
				addWaypoints: false,
				createMarker: function(i,w){
					return centerDot(w.latLng);
				},
				autoRoute: false,
				show: false,
				fitSelectedRoutes: false, // enable auto-zoom
				lineOptions: {
					styles: [{color: '#000000', opacity: 1, weight: 7}],
					missingRouteStyles: [{color: '#000000', opacity: 1, weight: 7}]
				}
			});
			APP.routers[map_id].addTo(APP.maps[map_id]);
		}
		control.route();
	}

	function show_layer(layer_idx,map_idx){
		var active = APP.activeLayers[map_idx];
		if(active && active == layer_idx){
			return;
		}
		if (active){
			APP.maps[map_idx].removeLayer(APP.layers[active]);
		}
		APP.maps[map_idx].addLayer(APP.layers[layer_idx]);
		APP.activeLayers[map_idx] = layer_idx;
	}
	APP.show_layer = show_layer;

	function route_layer(layer_idx,map_idx,marker_idx){
		var markers = APP.layers[layer_idx].getLayers();
		if (marker_idx > markers.length - 1){
			marker_idx = 0;
		}
		var end = markers[marker_idx].getLatLng();
		route_to(APP.location, end, map_idx);
	}

	function centerDot(ll){
		return L.circleMarker(ll, {
			fillColor:"#000000",
			fillOpacity:1,
			stroke: false,
			radius: 7,
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
		centerDot(ll).addTo(APP.maps.buses);
		centerDot(ll).addTo(APP.maps.places);
		centerDot(ll).addTo(APP.maps.events);

		d3.json(base_url + "/tfl/Place?lat="+location.lat+"&lon="+location.lng+"&radius="+radius,load_tfl);
		d3.json(base_url+"/forecast?lat="+location.lat+"&lon="+location.lng,load_weather);
		d3.json(base_url+"/eventbrite?lat="+location.lat+"&lon="+location.lng,load_events);

		// load places (layers not yet added to map)
		d3.json(base_url+"/plaques?lat="+location.lat+"&lon="+location.lng,load_plaques);
		d3.json(base_url+"/dbpedia?lat="+location.lat+"&lon="+location.lng,load_wiki);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=cafe",load_places_cafe);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=restaurant",load_places_restaurant);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=park",load_places_park);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=atm",load_places_atm);

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