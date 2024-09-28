import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import arrivaPNG from "../arriva.png";
import lppPNG from "../lpp.png";
import nomagoPNG from "../nomago.png";
import marpromPNG from "../marprom.png";

const icon = new L.Icon({
	iconUrl: "https://cdn-icons-png.flaticon.com/512/6618/6618280.png",
	iconSize: [50, 50],
	iconAnchor: [25, 50],
});

const lppIcon = new L.Icon({
	iconUrl: lppPNG,
	iconSize: [35, 35],
	iconAnchor: [17.5, 35],
});

const arrivaIcon = new L.Icon({
	iconUrl: arrivaPNG,
	iconSize: [35, 35],
	iconAnchor: [17.5, 35],
});

const nomagoIcon = new L.Icon({
	iconUrl: nomagoPNG,
	iconSize: [35, 35],
	iconAnchor: [17.5, 35],
});

const marpromIcon = new L.Icon({
	iconUrl: marpromPNG,
	iconSize: [35, 35],
	iconAnchor: [17.5, 35],
});

const stopIcon = new L.Icon({
	iconUrl: "https://cdn-icons-png.flaticon.com/512/7561/7561230.png",
	iconSize: [30, 30],
	iconAnchor: [15, 30],
});

function getBusIcon(operator_id) {
	switch (operator_id) {
		case "Javno podjetje Ljubljanski potniški promet d.o.o.":
			return lppIcon;
		case "Nomago d.o.o.":
			return nomagoIcon;
		case "Arriva d.o.o.":
			return arrivaIcon;
		case "Javno podjetje za mestni potniški promet Marprom, d.o.o.":
			return marpromIcon;
		default:
			return icon;
	}
}

function MapCenter({ center }) {
	const map = useMap();
	useEffect(() => {
		map.setView(center);
	}, [center, map]);
	return null;
}

const Map = ({
	position,
	gpsPositons,
	busStops,
	setLocation,
	setActiveStation,
}) => {
	const saveStationToLocalStorage = (name, coordinates) => {
		const stationData = {
			name: name,
			coordinates: coordinates,
		};
		localStorage.setItem("currentStation", JSON.stringify(stationData));
	};

	const [savedStation, setSavedStation] = useState(null);
	const [mapCenter, setMapCenter] = useState(position);

	useEffect(() => {
		const savedStationData = JSON.parse(
			localStorage.getItem("currentStation")
		);
		if (savedStationData) {
			const { name, coordinates } = savedStationData;
			setActiveStation(name);
			setLocation(coordinates);
			setSavedStation(savedStationData);
			setMapCenter(coordinates);
		}
	}, [setActiveStation, setLocation]);

	return (
		<div className="insideDiv">
			<h2>Live Bus Map</h2>
			<div className="map-container">
				<MapContainer
					center={mapCenter}
					zoom={13}
					style={{ height: "100%", width: "100%" }}
					attributionControl={false}
					scrollWheelZoom={true}>
					<MapCenter center={mapCenter} />
					<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
					<Marker position={mapCenter} icon={icon}/>
					<MarkerClusterGroup
						showCoverageOnHover={false}
						spiderfyOnMaxZoom={false}
						disableClusteringAtZoom={10}
						maxClusterRadius={30}>
						{gpsPositons.map((gpsPositon, index) => {
							const operatorName = gpsPositon.operator;
							console.log("Operator name:", operatorName);
							return (
								<Marker
									key={index}
									position={gpsPositon.gpsLocation}
									icon={getBusIcon(operatorName)}
									title={gpsPositon.route}>
									<Popup>
										<p>{gpsPositon.route}</p>
										<p>{gpsPositon.operator}</p>
										<p>{gpsPositon.gpsLocation}</p>
									</Popup>
								</Marker>
							);
						})}
					</MarkerClusterGroup>
					<MarkerClusterGroup
						showCoverageOnHover={false}
						spiderfyOnMaxZoom={false}
						disableClusteringAtZoom={16}
						maxClusterRadius={30}>
						{busStops.map((busStop, index) => {
							return (
								<Marker
									key={index}
									position={busStop.gpsLocation}
									icon={stopIcon}
									title={busStop.name}>
									<Popup>
										<h3>{busStop.name}</h3>
										<button
											onClick={() => {
												setLocation(
													busStop.gpsLocation
												);
												setActiveStation(busStop.name);
												saveStationToLocalStorage(
													busStop.name,
													busStop.gpsLocation
												);
												setMapCenter(
													busStop.gpsLocation
												);
											}}>
											Tukaj sem
										</button>
									</Popup>
								</Marker>
							);
						})}
					</MarkerClusterGroup>
				</MapContainer>
			</div>
		</div>
	);
};

export default Map;
