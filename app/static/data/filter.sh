cat all-stops.json | jq -c '{
	type,
	features: [ .features[] | {
		type: "Feature",
		geometry: {
			type: "Point",
			coordinates: [
				.geometry.coordinates[0],
				.geometry.coordinates[1]
			]
		},
		properties: {
			name: .properties.Stop_Name,
			id: .properties.Naptan_Atco
		}
	}]
}' > all-stops.geojson.json