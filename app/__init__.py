from flask import Flask, request, make_response, render_template

import requests
import json
from datetime import datetime, timedelta

import os
from os.path import join, dirname
from dotenv import load_dotenv

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

TFL_APP_ID = os.environ.get("TFL_APP_ID")
TFL_APP_KEY = os.environ.get("TFL_APP_KEY")
EVENTBRITE_TOKEN = os.environ.get("EVENTBRITE_TOKEN")

app = Flask(__name__)

@app.route("/")
def hello():
	return render_template("index.html")

@app.route("/tfl/<path:api_path>")
def tfl(api_path):
	base_url = "https://api.tfl.gov.uk/"
	args = dict(request.args)
	args['app_key'] = TFL_APP_KEY
	args['app_id']  = TFL_APP_ID
	r = requests.get(base_url+api_path, params = args)

	if r.status_code == requests.codes.ok:
		resp = make_response(r.text, 200)
		resp.headers['Content-Type'] = r.headers.get('content-type')
		return resp
	else:
		resp = make_response(r.text, 404)
		return resp

@app.route("/eventbrite_raw/<path:api_path>")
def eventbrite_events(api_path):
	# expect full api path and params (except token)
	# /events/search/
	# ?location.latitude=51.5218991&location.longitude=-0.1381519&location.within=1km&expand=category,ticket_classes,venue
	# &start_date.range_start=2016-05-24T00:00:00&start_date.range_end=2016-05-30T23:59:00
	base_url = "https://www.eventbriteapi.com/v3/"
	headers = {
		"Authorization": "Bearer "+EVENTBRITE_TOKEN,
	}
	r = requests.get(base_url+api_path, params = request.args, headers = headers)

	if r.status_code == requests.codes.ok:
		resp = make_response(r.text, 200)
		resp.headers['Content-Type'] = r.headers.get('content-type')
		return resp
	else:
		resp = make_response(r.text, r.status_code)
		resp.headers['Content-Type'] = r.headers.get('content-type')
		return resp

@app.route("/eventbrite")
def eventbrite_treated():
	# expect lat and lon, eg:
	# ?lat=51.5218991&lon=-0.1381519
	base_url = "https://www.eventbriteapi.com/v3/events/search/"
	headers = {
		"Authorization": "Bearer "+EVENTBRITE_TOKEN,
	}
	args = {
		"location.latitude": request.args.get("lat"),
		"location.longitude": request.args.get("lon"),
		"location.within": "1km",
		"start_date.range_start": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
		"start_date.range_end": (datetime.now()+timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S"), #"2016-03-30T21:00:00",
		# TODO remove category when finished recode_eventbrite_category
		"expand": "category,ticket_classes,venue"
	}

	r = requests.get(base_url, params = args, headers = headers)

	if r.status_code == requests.codes.ok:
		body = process_events_json(r.json())
		resp = make_response(body, 200)
		resp.headers['Content-Type'] = r.headers.get('content-type')
		return resp
	else:
		resp = make_response(r.text, r.status_code)
		resp.headers['Content-Type'] = r.headers.get('content-type')
		return resp

def process_events_json(data):
	if "events" in data:
		events = []
		for e in data['events']:

			# check all free
			free = [t['free'] for t in e['ticket_classes']]

			# check all costs
			if any(free):
				costs = [0] # set up a zero cost if any are free
			else:
				costs = []

			for t in e['ticket_classes']:
				if "cost" in t:
					costs.append(t['cost']['value']) # value in pence

			if len(costs) == 0:
				costs = [0]

			event = {
				"properties": {
					"name": e['name']['html'],
					# "description": e['description']['text'],
					"url": e['url'],
					"category": recode_eventbrite_category(e['category_id']),
					"start": e['start']['local'],
					"end": e['end']['local'],
					"free": any(free),
					"min": min(costs),
					"max": max(costs)
				},
				"geometry": {
					"coordinates": [
						float(e['venue']['longitude']),
						float(e['venue']['latitude'])
					],
					"type": "Point"
				},
				"type": "Feature"
			}

			# for debugging, until finished with recode_eventbrite_category
			if e['category']:
				event['properties']['e_category'] = e['category']['name']

			events.append(event)
		return json.dumps(events)

def recode_eventbrite_category(id):
	# fill this dict with encoding eg "999" (originally Cheese): "Food & Drink"
	cats = {
		"110": "Food & Drink"
	}
	if id in cats:
		return cats[id]
	else:
		return "Other"

app.debug = True
if __name__ == "__main__":
    app.run()
