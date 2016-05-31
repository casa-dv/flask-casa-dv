import requests
import json
import random

def get_nearby_places(lat,lon,place_type,key):
	url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
	params = {
		"location":lat+","+lon,
		"radius": 300,
		"type": place_type,
		"key": key
	}
	request = requests.get(url,params=params).json()
	place_ids = [place["place_id"] for place in request["results"]]
	return place_ids

def get_place_details(id,key):
	url = "https://maps.googleapis.com/maps/api/place/details/json"
	params = {
		"key": key,
		"placeid": id
	}
	place = requests.get(url,params=params).json()["result"]

	if "price_level" in place:
		place["price"]=place["price_level"]
	else:
		place["price"]=random.randint(1,4)

	feature = {
		"type": "Feature",
		"geometry": {
			"type": "Point",
			"coordinates":[
				place["geometry"]["location"]["lng"],
				place["geometry"]["location"]["lat"]
			]
		},
		"properties": {}
	}

	if "reviews" in place:
		feature["properties"]["reviews"] = [{
												"text":r["text"],
												"rating":r["rating"]
											} for r in place["reviews"]]

	if "photos" in place:
		feature["properties"]["photos"] = [p["photo_reference"] for p in place["photos"]]

	if "opening_hours" in place:
		feature["properties"]["opening_hours"] = place["opening_hours"]["periods"]

	for prop in ["name","place_id","formatted_phone_number","url","formatted_address","website","price","rating","types"]:
		if prop in place:
			feature["properties"][prop] = place[prop]

	if "rating" not in feature["properties"]:
		feature["properties"]["rating"] = random.randint(1,4)

	return feature

def get_distance(orig_lat,orig_lon,dest_lat,dest_lon,key):
	url = "https://maps.googleapis.com/maps/api/distancematrix/json"
	params = {
		"origins":str(orig_lat)+","+str(orig_lon),
		"destinations":str(dest_lat)+","+str(dest_lon),
		"mode":"walking",
		"key":key
	}
	matrix = requests.get(url,params=params).json()
	text = matrix["rows"][0]["elements"][0]["duration"]["text"]
	distance = text.split(" ")[0]
	return distance


def get_places(lat,lon,place_type,key):
	ids = get_nearby_places(lat,lon,place_type,key)
	places = []
	for place_id in ids:
		place = get_place_details(place_id,key)

		place_lon = place["geometry"]["coordinates"][0]
		place_lat = place["geometry"]["coordinates"][1]
		distance = get_distance(lat,lon,place_lat,place_lon,key)
		place["properties"]["distance"] = distance
		places.append(place)

	return places
