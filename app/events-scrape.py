 # -*- coding: utf-8 -*-
import requests
from datetime import datetime, timedelta
import psycopg2

import os
from os.path import join, dirname
from dotenv import load_dotenv

import events

def save_features(features, conn, cur):
	for feature in features:
		save_feature(feature,conn,cur)

def save_feature(feature,conn,cur):
	sql = """INSERT INTO events (
			event_id,
			the_geog,
			name,
			description,
			url,
			category,
			start_time,
			end_time,
			postcode,
			address,
			free,
			min,
			max,
			availability,
			donation
		) VALUES (
			%s,
			ST_GeomFromText('POINT(%s %s)', 4326),
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s,
			%s
		);"""
	values = (
		feature["properties"]["event_id"],
		feature["geometry"]["coordinates"][0],
		feature["geometry"]["coordinates"][1],
		feature["properties"]["name"],
		feature["properties"]["description"],
		feature["properties"]["url"],
		feature["properties"]["category"],
		feature["properties"]["start"],
		feature["properties"]["end"],
		feature["properties"]["postcode"],
		feature["properties"]["address"],
		feature["properties"]["free"],
		feature["properties"]["min"],
		feature["properties"]["max"],
		feature["properties"]["availability"],
		feature["properties"]["donation"],
	)
	try:
		cur.execute(sql, values)
		conn.commit()
	except psycopg2.IntegrityError:
		conn.rollback()
		pass


def get_london_events(page,token):
		now = datetime.now()
		then = now + timedelta(days=7)

		format_s = "%Y-%m-%dT%H:%M:%S"
		start_time=datetime.strftime(now,format_s)
		end_time=datetime.strftime(then,format_s)

		data = {
			"expand":"ticket_classes,venue",
			"venue.city": "london",
			"start_date.range_start": start_time,
			"start_date.range_end": end_time,
			"sort_by":"date",
			"page": page , # request page from API
		}

		response = requests.get(  #make an http request (insteaf of get =put,post,delete)
			"https://www.eventbriteapi.com/v3/events/search/", # URL
			headers = {  # headers = metadata (ex :cookie)     # header (=object) = KEY + VALUE
				"Authorization": "Bearer "+token,              # "Bearer" is specific to eventbrite API
			},
			params=data,  # question marks = all the infos at the end of the url (everything foldng up into a string)
			verify = True,  # Verify SSL certificate (because our url starts with https = secure url)
		)

		return response.json()

def get_all_pages(token,conn,cur):
	last = False #are we on the last page?
	page = 1     #current page number

	while(not last):
		r = get_london_events(page,token)  #get this page of events
		print str(page) + " of " + str(r['pagination']['page_count'])
		save_features(
			events.process_events_json(r),
			conn,
			cur)

		last = r['pagination']['page_count'] == page
		page = page + 1


if __name__ == "__main__":
	dotenv_path = join(dirname(__file__), '.env')
	load_dotenv(dotenv_path)
	EVENTBRITE_TOKEN = os.environ.get("EVENTBRITE_TOKEN")
	conn = psycopg2.connect("dbname=tom user=tom")
	cur = conn.cursor()

	get_all_pages(EVENTBRITE_TOKEN,conn,cur)

	# eg = {
	# 	"properties": {
	# 		"name":         "Test event",
	# 		"description":  "UCL's annual Teaching and Learning Conference will be held on April 19 at the UCL Institute of Education on Bedford Way.  \nThe annual conference brings together staff and students – anyone, in fact, who has a stake in any aspect of learning and teaching – to share interesting ideas and experiences, forge new partnerships and collectively reflect on how to make teaching and learning truly exceptional. This year's theme is ChangeMaking to acknowledge the transformative power of education, and to mark the work of the students in the enhancement initiative UCL ChangeMakers. \nThis year's keynote session will include the presentation of the Provost's Teaching Awards (PTA) and the UCLU's Student Choice Teaching Awards (SCTA).  \nAll staff and students of UCL, as well as guests of the award winners, are welcome to attend. If you are at UCL and wish to submit a proposal please go to the Moodle site (UCL login required). \nLunch will be provided for participants who have registered for the conference daytime sessions. If you have any dietary or disability requirements, or any further questions, please contact tlconference@ucl.ac.uk.  \nPlease book a ticket for the whole event (keynote and awards, sessions and drinks reception) or each separate part of the event you wish to attend. We look forward to seeing you there. \nPlease note: Whole day tickets are now sold out. If you still wish to attend the whole day, please select each of the separate tickets (i.e. keynote, daytime sessions and drinks reception) which are still available. ",
	# 		"url":          "http://initd.org/psycopg/docs/usage.html#passing-parameters-to-sql-queries",
	# 		"category":     "Food & Drink",
	# 		"start":        "2016-04-19T17:30:00",
	# 		"end":          "2016-04-19T17:30:00",
	# 		"postcode":     "N2 0NL",
	# 		"address":      "94, Great North Road",
	# 		"free":         True,
	# 		"min":          0,
	# 		"max":          10,
	# 		"availability": False,
	# 		"donation":     None
	# 	},
	# 	"geometry": {
	# 		"coordinates": [
	# 			float(-0.1324783),
	# 			float(51.387298)
	# 		],
	# 		"type": "Point"
	# 	},
	# 	"type": "Feature"
	# }
	# save_feature(eg, conn,cur)

	cur.close()
	conn.close()