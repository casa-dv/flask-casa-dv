/*jslint browser: true*/
/*global Tangram, L */

/**
 * Global APP variable functions as a plain-object data store
 * for ease of reference.
 *
 * Control flow starts at the bottom of the page, with 'setup'.
 * Setup creates the maps and slider, and loads data, with callbacks to add
 * each dataset to the map.
 * Each callback stores the data and map layers in the APP global, and sets up
 * event listeners for interaction with the map, as well as loading a first
 * set of item details.
 */
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

	var is_places_details_page = !!url.match("/places");

	// round back to last hour
	var now = APP.now = Math.round(moment().valueOf() / (60*60*1000)) * 60*60*1000;
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

		return map;
	}

	function create_timeline(slider){
		noUiSlider.create(slider, {
			start: now,
			step: 1000*60*30, // ms
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
						// display no labels
						return '';
						// display day and hours
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

		onSliderUpdateThrottled = _.throttle(onSliderUpdate, 100);
		slider.noUiSlider.on('update', onSliderUpdateThrottled);
		return slider;
	}
	function onSliderUpdate( values, handle ) {
		var sliderTime = APP.sliderTime = parse_slider_value(values);

		// label Mon 12:05
		var time = moment(sliderTime).format("ddd HH:mm");
		document.querySelector(".timeline_label_bottom").textContent = time;

		display_weather_data(sliderTime);

		filter_events_by_time(sliderTime);
		filter_places_by_time(sliderTime);
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
			APP.data.plaques = [];
			APP.layers.plaques = L.layerGroup();
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
					show_plaques_data(feature);
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
	function show_plaques_data(data){
		if(!data || !data.properties){
			return;
		}
		var props = data.properties;
		var title = props.lead_subject_name;
		var sub = "Plaque";
		var desc = props.inscription;
		document.querySelector("#details_places .title").textContent = title;
		document.querySelector("#details_places .subhead").textContent = sub;
		document.querySelector("#details_places .description").textContent = desc;
	}

	function load_wiki(error,wiki) {
		if(error || !wiki.features){
			APP.data.wiki = [];
			APP.layers.wiki = L.layerGroup();
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

		// show_layer("wiki","places");
		// route_layer("wiki","places",0);
		// show_wiki_data(wiki.features[0]);
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
		// add layer to map on load
		show_layer("places_cafe","places");
		// show place and route to it
		route_layer("places_cafe","places",0);
		show_places_data(APP.data.places_cafe[0], "Cafe");
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
		var layer = get_place_layer(places,type);
		var idx = "places_"+type;
		APP.data[idx] = places;
		APP.layers[idx] = layer;
	}
	function get_place_layer(places,type){
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
					show_places_data(feature,type);
					route_to(APP.location, {
						lng: feature.geometry.coordinates[0],
						lat: feature.geometry.coordinates[1]
					}, "places");
				});
			}
		});
		return layer;
	}
	function show_places_data(data,type){
		if (!data || !data.properties){
			return;
		}
		var props = data.properties;
		var title = props.name;
		var sub = type;

		var desc = [
			"<p>Price: ",
			props.price,
			", Rating: ",
			props.rating,
			"</p><p>",
			"<a href=\"",
			props.url,
			"\" target=\"_blank\">Find out more on Google</a>",
			"</p>"
		].join("");

		document.querySelector("#details_places .title").textContent = title;
		document.querySelector("#details_places .subhead").textContent = sub;
		document.querySelector("#details_places .description").innerHTML = desc;
	}


	function load_events(error,events) {
		if(error || !events.features){
			return;
		}
		var layer = get_events_layer(events);

		APP.data.events = events.features;
		APP.layers.events = layer;

		show_layer("events","events");
		event_type_change(); // trigger filter

	}
	function get_events_layer(events){
		var layer = L.geoJson(events,{
			pointToLayer: function(feature, latlng) {
				var icon = event_name_to_tag(feature.properties.category);
				var myIcon = L.icon({
					iconUrl: "/static/icons/"+icon+".png",
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
		return layer;
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
	function show_event_not_found(cat_name){
		document.querySelector("#details_events .title").textContent = "None found";
		document.querySelector("#details_events .subhead").textContent = cat_name;
		document.querySelector("#details_events .description").innerHTML = "";
	}

	function load_tfl(error,tfl){
		if (error || !tfl.places){
			APP.data.tfl = [];
			APP.layers.tfl = L.layerGroup();
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
			sub = "Nearby Bus Stop";
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
					return false; //centerDot(w.latLng);
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
		if(APP.layers[layer_idx] && APP.maps[map_idx]){
			APP.maps[map_idx].addLayer(APP.layers[layer_idx]);
		}
		APP.activeLayers[map_idx] = layer_idx;
	}

	function route_layer(layer_idx,map_idx,marker_idx){
		if(!APP.layers[layer_idx]){
			route_to(APP.location, APP.location, map_idx);
			return;
		}
		var markers = APP.layers[layer_idx].getLayers();
		if(!markers || !markers.length){
			route_to(APP.location, APP.location, map_idx);
			return;
		}

		if (marker_idx > markers.length - 1){
			marker_idx = 0;
		}
		var end = markers[marker_idx].getLatLng();
		route_to(APP.location, end, map_idx);
	}

	function filter_layer(layer_idx,map_idx,test_cb){
		if(!APP.layers[layer_idx]){
			return;
		}
		var markers = APP.layers[layer_idx].getLayers();
		if(!markers || !markers.length){
			return;
		}
		// hide all
		_.each(markers,function(marker){
			marker._icon.classList.add("hide");
		});

		// filter
		var filtered = _.filter(markers,test_cb);

		// show filtered
		_.each(filtered,function(marker){
			marker._icon.classList.remove("hide");
		});
		return filtered;
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

	function place_type_change(){
		var el = document.querySelector("#details_places input:checked");
		var lookup = {
			"places-coffee":     "places_cafe",
			"places-restaurant": "places_restaurant",
			"places-park":       "places_park",
			"places-atm":        "places_atm",
			"places-wikipedia":  "wiki",
			"places-plaques":    "plaques",
		};
		var layer_idx = lookup[el.id];
		if(layer_idx){
			show_layer(layer_idx,"places");
			route_layer(layer_idx,"places",0);
			if (layer_idx.match("places")){
				var type = layer_idx.split("_")[1];
				show_places_data(APP.data[layer_idx][0], type);
			} else if (layer_idx == "wiki"){
				show_wiki_data(APP.data.wiki[0]);
			} else if (layer_idx == "plaques"){
				show_plaques_data(APP.data.plaques[0]);
			}
		}
	}
	function filter_places_by_time(time){
		var day = +moment(time).format('d');
		var hour_now = +moment(time).format('HHmm');
		var filtered_markers = filter_layer(APP.activeLayers.places,"places",function(marker){
			var opening_hours = marker.feature.properties.opening_hours;
			// no opening hours => always open?
			if (!opening_hours){
				return true;
			}
			// each period is like
			// {
			//   "close": {
			//     "day": 0,
			//     "time": "2100"
			//   },
			//   "open": {
			//     "day": 0,
			//     "time": "0900"
			//   }
			// },
			// day: 0 is Sunday

			// get today's opening hours
			var period_today = _.filter(opening_hours,function(period){
				return period.open.day == day;
			});

			if(!period_today.length){
				return false;
			}

			// coerce all vars to an integer from "2300" format strings
			var period = period_today[0];
			var open = +period.open.time;
			var close = +period.close.time;

			var is_open = open <= hour_now && close >= hour_now;
			return is_open;
		});

		if(filtered_markers && filtered_markers.length){
			route_to(APP.location, filtered_markers[0].getLatLng(), "places");
			var type = APP.activeLayers.places.split("_")[1];
			if(type){
				show_places_data(filtered_markers[0].feature, type);
			}
		} else {
			route_to(APP.location, APP.location, "places");
		}
	}
	function event_type_change(){
		var el = document.querySelector("#details_events input:checked");
		var cat = el.id.split("-")[1];
		var cat_name = event_tag_to_name(cat);
		filter_events_by_category(cat_name);
	}
	function filter_events_by_category(cat_name){
		var filtered_markers = filter_layer("events","events",function(marker){
			return marker.feature.properties.category === cat_name;
		});

		if(filtered_markers && filtered_markers.length){
			route_to(APP.location, filtered_markers[0].getLatLng(), "events");
			show_event_data(filtered_markers[0].feature);
		} else {
			show_event_not_found(cat_name);
			route_to(APP.location, APP.location, "events");
		}
	}
	function filter_events_by_time(time){
		var filtered_markers = filter_layer("events","events",function(marker){
			var start = moment(marker.feature.properties.start);
			var end = moment(marker.feature.properties.end);
			return  start <= time &&  end >= time;
		});

		if(filtered_markers && filtered_markers.length){
			route_to(APP.location, filtered_markers[0].getLatLng(), "events");
			show_event_data(filtered_markers[0].feature);
		} else {
			route_to(APP.location, APP.location, "events");
		}
	}
	function event_name_to_tag(name){
		var icon;
		switch (name) {
			case 'Business & Education':
				icon = "education";
				break;
			case 'Culture & Art':
				icon = "culture";
				break;
			case 'Fashion & Health':
				icon = "beauty";
				break;
			case 'Food & Drink':
				icon = "restaurant";
				break;
			case 'Melting Pot & Co':
				icon = "melting-pot";
				break;
			case 'Sport & Travel':
				icon = "sport";
				break;
			default:
				icon = "melting-pot";
				break;
		}
		return icon;
	}
	function event_tag_to_name(tag){
		var name;
		switch (tag) {
			case "education":
				name = 'Business & Education';
				break;
			case "culture":
				name = 'Culture & Art';
				break;
			case "beauty":
				name = 'Fashion & Health';
				break;
			case "restaurant":
				name = 'Food & Drink';
				break;
			case "melting-pot":
				name = 'Melting Pot & Co';
				break;
			case "sport":
				name = 'Sport & Travel';
				break;
			default:
				name = "Melting Pot & Co";
				break;
		}
		return name;
	}

	function draw(){
		console.log("tick");

		// move slider
		var newSliderTime = APP.sliderTime + 60*60*1000; // must be multiple of slider step
		if (newSliderTime > APP.then){
			newSliderTime = APP.now;
		}
		APP.slider.noUiSlider.set(newSliderTime);

		_.delay(draw, 2000);
	}

	function setup(){
		if(!is_places_details_page){
			APP.maps.buses = load_map('map_buses',location);
			APP.maps.events = load_map('map_events',location);
		}
		APP.maps.places = load_map('map_places',location);

		var ll = L.latLng(location);
		if(!is_places_details_page){
			centerDot(ll).addTo(APP.maps.buses);
			centerDot(ll).addTo(APP.maps.events);
		}
		centerDot(ll).addTo(APP.maps.places);

		// load weather
		d3.json(base_url+"/forecast?lat="+location.lat+"&lon="+location.lng,load_weather);

		// load tfl nearby, and events
		if(!is_places_details_page){
			d3.json(base_url + "/tfl/Place?lat="+location.lat+"&lon="+location.lng+"&radius="+radius,load_tfl);
			d3.json(base_url+"/eventbrite?lat="+location.lat+"&lon="+location.lng,load_events);
		}
		// load places (layers not yet added to map)
		d3.json(base_url+"/plaques?lat="+location.lat+"&lon="+location.lng,load_plaques);
		d3.json(base_url+"/dbpedia?lat="+location.lat+"&lon="+location.lng,load_wiki);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=cafe",load_places_cafe);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=restaurant",load_places_restaurant);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=park",load_places_park);
		d3.json(base_url+"/places?lat="+location.lat+"&lon="+location.lng+"&type=atm",load_places_atm);

		var slider = APP.slider = document.getElementById('timeline');
		create_timeline(slider);

		APP.sliderTime = now;

		if(document.location.search.match("autoplay=true")){
			console.log("autoplaying");
			_.delay(draw, 5000);
		}
		document.querySelector("#details_places form").addEventListener("change",place_type_change);
		document.querySelector("#details_events form").addEventListener("change",event_type_change);
	}

	setup();

	return APP;
}());