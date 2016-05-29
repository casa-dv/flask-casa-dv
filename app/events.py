import json

def process_events_json(data):
	if "events" in data:
		events = []
		for e in data['events']:

			# check all free
			free = [t['free'] for t in e['ticket_classes']]

			prices = []
			any_donation = False
			availability = []

			for ticket in e['ticket_classes']:
				if 'on_sale_status' in ticket and (ticket['on_sale_status'] == 'SOLD_OUT' or ticket['on_sale_status'] == 'UNAVAILABLE'):
					availability.append(False)
				else:
					availability.append(True)

					if ticket['free'] or ticket['donation']:
						prices.append(0)
					else:
						prices.append(ticket['cost']['value'])

					if ticket['donation']:
						any_donation = True

			if len(prices) > 0:
				min_price = min(prices)
				max_price = max(prices)
			else:
				min_price = None
				max_price = None

			event = {
				"properties": {
					"name":         e['name']['html'],
					"event_id":     e['id'],
					"description":  e['description']['text'],
					"url":          e['url'],
					"category":     recode_eventbrite_category(e['category_id']),
					"start":        e['start']['local'],
					"end":          e['end']['local'],
					"postcode":     e['venue']['address']['postal_code'],
					"address":      e['venue']['address']['address_1'],
					"free":         any(free),
					"min":          min_price,
					"max":          max_price,
					"availability": any(availability),
					"donation":     any_donation
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
			events.append(event)

		return events

def recode_eventbrite_category(id):
	# fill this dict with encoding eg "999" (originally Cheese): "Food & Drink"
	cats = {
		"110": "Food & Drink",

		"113": "Culture & Art",
		"104": "Culture & Art",
		"105": "Culture & Art",
		"103": "Culture & Art",

		"114": "Business & Education",
		"115": "Business & Education",
		"102": "Business & Education",
		"112": "Business & Education",
		"101": "Business & Education",

		"116": "Sport & Travel",
		"108": "Sport & Travel",
		"109": "Sport & Travel",
		"118": "Sport & Travel",

		"106": "Fashion & Health",
		"107": "Fashion & Health"
	}

	if id in cats:
		return cats[id]
	else:
		return "Other"