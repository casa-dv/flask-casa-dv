//js file
console.log("Step 0 - load file");
var map; //map available globally
var events;
var meteo;
var slider;


function loadevents(data1){
	// important javascript concept: the jQuery.getJSON doesn't return data,
	// instead you pass a callback function (like this function)
	// then when the data is available, the function runs.
	console.log("Step 3 - data1 loaded");
	events = data1; //fills up our varibale with data, the one running everywhere afterward
	console.log(data1);


    // Step 5 : create timeline
	console.log("Step 5 - EachTimeline creation");

	var eventTimeline = L.timeline(events, {
    	style: function(feature) {
        	switch (feature.properties.category) {
            	case 'Business & Education': return {color: "#ffcccc"};
            	case 'Culture & Art':   return {color: "#ccffcc"};
            	case 'Fashion & Health': return {color: "#ccffff"};
            	case 'Food & Drink':   return {color: "#ccd9ff"};
            	case 'Melting Pot & Co': return {color: "#ffccf2"};
            	case 'Sport & Travel':   return {color: "#ffff00"};
        	}
    	},
    	pointToLayer: function(feature, latlng) {
       	    	return new L.CircleMarker(latlng, {radius: 8, fillOpacity: 1});
    	},
    	onEachFeature: function (feature, layer) {
        	layer.bindPopup("<h2>"+feature.properties.name+"</h2><p>" + feature.properties.postcode+'</p><a href="'+feature.properties.url+'" target="_blank">View on Eventbrite</a>');
    	}
    });
  	eventTimeline.addTo(map);

  	eventTimeline.on('change',function(e){
  		updateWeather(slider.time); //
  	 });

  	slider.addTimelines(eventTimeline);


	console.log("data is: " + data1);
}


function loadweather(data){   // load meteo data but still a list of object instead of an array
	console.log("Step 4 - data2 loaded");
	meteo = data;
	console.log(data);
}

function updateWeather(time){
	var weather_now = getWeatherAtTime(time);
	if(weather_now){
		var p = document.querySelector('.weather');
		p.textContent = weather_now.summary;
		p.setAttribute("data-weather",weather_now.icon);
	}
	// console.log(weather_now);
}

function getWeatherAtTime(time){  //takes the time
	if(meteo && meteo.hourly && meteo.hourly.data) {  // looks in the array of hourly data
		var hourly = meteo.hourly.data;

		var diff = time - slider.start;    // the difference of the time pointed by slider and the time now because i know data meteo is in order. if diff = 0 =) 0 divided by all that will be 0 =) the first
		var index = Math.floor(diff / 1000 / 60 / 60); // /360000
		return hourly[index];
	}
}

// this is a function - later we will make it run once (on load)
function setup() {

	// Step 1 : set up basemap (cartodb, tilemile or tilelayer)
	console.log("Step 1 - set up map");

	// create a leaflet map in the container map id and then set it to zoom to london with lat long coordinates, zoom
	// into my empty container <div id="mapid"></div>
	map = L.map('mapid').setView([51.505, -0.09], 13);

	var mapbox_style_light = "annabannanna/ciod0h6u500dcb1nhx8jebkx4";
	var mapbox_style_contrast = "annabannanna/ciotz5593002ldqnf8a87z6jg";
	var mapbox_key = "pk.eyJ1IjoiYW5uYWJhbm5hbm5hIiwiYSI6ImNpbWdscW40bDAwMDgzNG0yZ2FxYTNhZ2YifQ.VmWzlEEOgWa4ydTmqfS06g";
	var url = 'https://api.mapbox.com/styles/v1/'+mapbox_style_contrast+'/tiles/{z}/{x}/{y}?access_token='+mapbox_key;
	L.tileLayer(url, { maxZoom: 18,  }).addTo(map);



	// Step 2 : create timeline
	console.log("Step 2 - Timecursor creation");

 	slider = L.timelineSliderControl({
 		// start: moment().valueOf(),  // moment gets the time now, value of returns an int value of that date called in unix time in ms
 		end: moment().add(7,'days').valueOf(), // add 7 days to now
    	formatOutput: function(date){
      		return moment(date).format("MMMM Do h:mm:ss a");
    	}
  	});
  	map.addControl(slider);



	// Step 3 load datasets
	jQuery.getJSON('events.json', loadevents) //once data loaded, run function loadData1
	//other ways to run things : usefulk to detect errors :
	jQuery.getJSON('http://casa-dv.made-by-tom.co.uk/forecast?lat=51.5218991&lon=-0.13815119', loadweather)//once
} //Close function





// once the page is ready, run loadMap
// this runs once and add the listener to the browser
if(window.addEventListener){   //once the page is loaded 'DOMcontent' then run setup
	// here loadMap is the callback function; it will run when the browser is done loading the page
	window.addEventListener('DOMContentLoaded', setup, false); //'DOMcontentLoaded' = representation of an HTML in the browser
} else {
	window.onload=setup;
}
