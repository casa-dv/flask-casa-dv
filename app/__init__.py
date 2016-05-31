from flask import Flask, request, make_response, render_template
from flask.ext.cors import CORS
from flask.ext.redis import FlaskRedis
from redis import StrictRedis

import requests
import json
from datetime import datetime, timedelta

import os
from os.path import join, dirname
from dotenv import load_dotenv

import places
import events

import redis
import psycopg2

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

TFL_APP_ID = os.environ.get("TFL_APP_ID")
TFL_APP_KEY = os.environ.get("TFL_APP_KEY")
EVENTBRITE_TOKEN = os.environ.get("EVENTBRITE_TOKEN")
FORECAST_API_KEY = os.environ.get("FORECAST_API_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
DEBUG = (os.environ.get("DEBUG") == "true")

app = Flask(__name__)
app.config["REDIS_URL"] = "redis://localhost:6379/0"
rc = FlaskRedis.from_custom_provider(StrictRedis, app)
CORS(app)

def json_response(data, code=200):
	resp = make_response(data, code)
	resp.headers['Content-Type'] = "application/json"
	return resp

@app.route("/")
def hello():
	return render_template("index.html")

@app.route("/stops")
def stops():
	return render_template("stops.html")

@app.route("/stops/<stop_id>")
def stop(stop_id):
	details_r = tfl_request({},"StopPoint/"+stop_id)
	details = json.loads(details_r["text"])

	if "httpStatusCode" in details and details["httpStatusCode"] == 404:
		return make_response("Stop not found. Try <a href=\"/stops/490015764C\">Covent Garden / Catherine Street</a>", 400)

	details = parse_stop(details,stop_id)
	# return json_response(json.dumps(details))
	return render_template("stop.html",data=details)

def parse_stop(stop,stop_id):
	if(stop["id"] == stop_id):
		return stop

	if("children" in stop and len(stop["children"])>0):
		for child in stop["children"]:
			found = parse_stop(child,stop_id)
			if(found is not None):
				return found
	return None


@app.route("/places")
def place_route():
	# ?lat=51.511732&lon=-0.123270&type=cafe
	if 'lat' in request.args and 'lon' in request.args and 'type' in request.args:
		lat = request.args['lat']
		lon = request.args['lon']
		place_type = request.args['type']
		key = ":".join(["places",lat,lon,place_type])
		out = rc.get(key)
		if not out:
			out = json.dumps(places.get_places(lat,lon,place_type,GOOGLE_API_KEY))
			rc.setex(key,24*60*60,out)

		return json_response(out)
	else:
		return json_response(json.dumps({"error":"lat, lon and type are required parameters. Try ?lat=51.5218991&lon=-0.1381519"}), 400)

@app.route("/forecast")
def forecast():
	# ?lat=51.5218991&lon=-0.1381519
	# https://api.forecast.io/forecast/APIKEY/LATITUDE,LONGITUDE
	base_url = "https://api.forecast.io/forecast/"+FORECAST_API_KEY+"/"
	params = {
		"extend":"hourly",
		"units":"si",
		"exclude":",".join([
			"currently",
			"minutely",
			"alerts",
			"flags"
		])
	}
	if 'lat' in request.args and 'lon' in request.args:
		lat = request.args['lat']
		lon = request.args['lon']
		key = ":".join(["forecast",lat,lon])
		out = rc.get(key)
		code = 200
		if not out:
			try:
				r = requests.get(base_url+request.args['lat']+","+request.args['lon'], params=params)
				out = r.text
				code = r.status_code
				if code == requests.codes.ok:
					rc.setex(key,60*60,out)

			except requests.exceptions.ConnectionError:
				out = '{"error":"could not connect to forecast api"}'
				code = 500


		resp = make_response(out, code)
		resp.headers['Content-Type'] = "application/json"
		return resp
	else:
		return json_response(json.dumps({"error":"lat and lon are required parameters. Try ?lat=51.5218991&lon=-0.1381519"}), 400)

@app.route("/tfl/<path:api_path>")
def tfl(api_path):
	args = dict(request.args)
	r = tfl_request(args,api_path)

	return json_response(r["text"], r["status_code"])

def tfl_request(args,api_path):

	key = ":".join(["tfl",str(args),api_path])
	r = rc.get(key)
	if not r:
		base_url = "https://api.tfl.gov.uk/"
		args['app_key'] = TFL_APP_KEY
		args['app_id']  = TFL_APP_ID
		r = requests.get(base_url+api_path, params = args)
		r = {"text":r.text,"status_code":r.status_code}
		rc.setex(key,60*60,json.dumps(r))
	else:
		r = json.loads(r)
	return r



@app.route("/eventbrite")
def eventbrite_scraped():
	# expect lat and lon, eg:
	# ?lat=51.5218991&lon=-0.1381519

	if 'lat' in request.args and 'lon' in request.args:
		lat = float(request.args['lat'])
		lon = float(request.args['lon'])
		conn = psycopg2.connect("dbname=tom user=tom")
		cur = conn.cursor()
		sql = """
			SELECT row_to_json(fc) FROM (
				SELECT
					'FeatureCollection' as type,
					array_to_json(array_agg(f)) as features FROM (
						SELECT
							'Feature' as type,
							ST_AsGeoJSON(row.the_geog)::json as geometry,
							row_to_json((
								SELECT props FROM (
									SELECT
									name,
									description,
									url,
									category,
									format,
									start,
									"end",
									postcode,
									address,
									free,
									min,
									max,
									availability,
									donation
								) as props
							)) as properties
						FROM events as row WHERE ST_DWithin(
							row.the_geog,
							ST_GeomFromText(
								'POINT(%s %s)'
								, 4326
							)::geography,
							300 --meters radius
						))
					as f)
				as fc;"""
		values = (lon,lat)
		cur.execute(sql,values)
		out = cur.fetchone()
		return json_response(json.dumps(out[0]), 200)
	else:
		return json_response(json.dumps({"error":"lat and lon are required parameters. Try ?lat=51.5218991&lon=-0.1381519"}), 400)

@app.route("/dbpedia")
def dbpedia():
	# expect lat and lon, eg:
	# ?lat=51.5218991&lon=-0.1381519
	if 'lat' in request.args and 'lon' in request.args:
		lat = float(request.args['lat'])
		lon = float(request.args['lon'])
		conn = psycopg2.connect("dbname=tom user=tom")
		cur = conn.cursor()
		sql = """
			SELECT row_to_json(fc) FROM (
				SELECT
					'FeatureCollection' as type,
					array_to_json(array_agg(f)) as features FROM (
						SELECT
							'Feature' as type,
							ST_AsGeoJSON(row.the_geog)::json as geometry,
							row_to_json((
								SELECT props FROM (
									SELECT
									b as base,
									u as url,
									d as description
								) as props
							)) as properties
						FROM dbpedia as row WHERE ST_DWithin(
							row.the_geog,
							ST_GeomFromText(
								'POINT(%s %s)'
								, 4326
							)::geography,
							300 --meters
						))
					as f)
				as fc;"""
		values = (lon,lat)
		cur.execute(sql,values)
		out = cur.fetchone()
		return json_response(json.dumps(out[0]), 200)
	else:
		return json_response(json.dumps({"error":"lat and lon are required parameters. Try ?lat=51.5218991&lon=-0.1381519"}), 400)

@app.route("/plaques")
def plaques():
	# expect lat and lon, eg:
	# ?lat=51.5218991&lon=-0.1381519
	if 'lat' in request.args and 'lon' in request.args:
		lat = float(request.args['lat'])
		lon = float(request.args['lon'])
		conn = psycopg2.connect("dbname=tom user=tom")
		cur = conn.cursor()
		sql = """
			SELECT row_to_json(fc) FROM (
				SELECT
					'FeatureCollection' as type,
					array_to_json(array_agg(f)) as features FROM (
						SELECT
							'Feature' as type,
							ST_AsGeoJSON(row.the_geog)::json as geometry,
							row_to_json((
								SELECT props FROM (
									SELECT
									inscription,
									colour,
									lead_subject_name,
									lead_subject_type,
									lead_subject_wikipedia,
									lead_subject_born_in,
									lead_subject_died_in,
									main_photo
								) as props
							)) as properties
						FROM plaques as row WHERE ST_DWithin(
							row.the_geog,
							ST_GeomFromText(
								'POINT(%s %s)'
								, 4326
							)::geography,
							300 --meters
						))
					as f)
				as fc;"""
		values = (lon,lat)
		cur.execute(sql,values)
		out = cur.fetchone()
		return json_response(json.dumps(out[0]), 200)
	else:
		return json_response(json.dumps({"error":"lat and lon are required parameters. Try ?lat=51.5218991&lon=-0.1381519"}), 400)

app.debug = DEBUG
if __name__ == "__main__":
    app.run(port=5050)
