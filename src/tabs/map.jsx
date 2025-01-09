import React, { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import arrivaPNG from "../img/arriva.png";
import lppPNG from "../img/lpp.png";
import nomagoPNG from "../img/nomago.png";
import marpromPNG from "../img/marprom.png";
import userPNG from "../img/user.png";

const MapCenter = React.memo(({ center }) => {
	const map = useMap();

	useEffect(() => {
		map.setView(center);
	}, [center, map]);

	return null;
});

const stopIcon = new L.Icon({
	iconUrl: "https://cdn-icons-png.flaticon.com/512/7561/7561230.png",
	iconSize: [30, 30],
	iconAnchor: [15, 30],
});

const userIcon = new L.Icon({
	iconUrl: userPNG,
	iconSize: [35, 35],
	iconAnchor: [17.5, 35],
});

const createOperatorIcon = (iconUrl) =>
	new L.Icon({
		iconUrl,
		iconSize: [35, 35],
		iconAnchor: [17.5, 35],
	});

const operatorIcons = {
	"Javno podjetje Ljubljanski potniški promet d.o.o.":
		createOperatorIcon(lppPNG),
	"Nomago d.o.o.": createOperatorIcon(nomagoPNG),
	"Arriva d.o.o.": createOperatorIcon(arrivaPNG),
	"Javno podjetje za mestni potniški promet Marprom, d.o.o.":
		createOperatorIcon(marpromPNG),
};

const getBusIcon = (operator_id) =>
	operatorIcons[operator_id] ||
	createOperatorIcon(
		"https://cdn-icons-png.flaticon.com/512/6618/6618280.png"
	);

const Map = ({
	gpsPositons,
	busStops,
	activeStation,
	setActiveStation,
	userLocation,
	setCurentUrl,
}) => {
	const activeStation2 = useMemo(() => activeStation, [activeStation]);
	const position = useMemo(
		() =>
			activeStation2.gpsLocation
				? activeStation2.gpsLocation
				: userLocation,
		[activeStation2.gpsLocation, userLocation]
	);

	const [mapCenter, setMapCenter] = useState(position);

	useEffect(() => {
		setMapCenter(position);
	}, [position]);

	const handleStationClick = useCallback(
		(busStop) => {
			setActiveStation(JSON.stringify(busStop));
			setMapCenter(busStop.gpsLocation);
			localStorage.setItem(
				"activeStation",
				JSON.stringify({
					name: busStop.name,
					coordinates: busStop.gpsLocation,
					id: busStop.id,
				})
			);
			setCurentUrl("/arrivals");
			document.location.href = "/#/arrivals";
		},
		[setActiveStation, setCurentUrl]
	);

	const memoizedGpsPositions = useMemo(
		() =>
			gpsPositons.map((gpsPositon, index) => (
				<Marker
					key={`gps-${index}`}
					position={gpsPositon.gpsLocation}
					icon={getBusIcon(gpsPositon.operator)}
					title={gpsPositon.route}>
					<Popup>
						<p>{gpsPositon.route}</p>
						<p>{gpsPositon.operator}</p>
						<p>{gpsPositon.gpsLocation}</p>
					</Popup>
				</Marker>
			)),
		[gpsPositons]
	);

	const memoizedBusStops = useMemo(
		() =>
			busStops.map((busStop, index) => (
				<Marker
					key={`stop-${index}`}
					position={busStop.gpsLocation}
					icon={stopIcon}
					title={busStop.name}>
					<Popup>
						<h3>{busStop.name}</h3>
						<button onClick={() => handleStationClick(busStop)}>
							Tukaj sem
						</button>
					</Popup>
				</Marker>
			)),
		[busStops, handleStationClick]
	);

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
					<Marker
						position={mapCenter}
						icon={L.icon({
							iconUrl:
								"https://cdn-icons-png.flaticon.com/512/6618/6618280.png",
							iconSize: [50, 50],
							iconAnchor: [25, 50],
						})}
					/>
					<MarkerClusterGroup
						showCoverageOnHover={false}
						spiderfyOnMaxZoom={false}
						disableClusteringAtZoom={10}
						maxClusterRadius={30}>
						{memoizedGpsPositions}
					</MarkerClusterGroup>
					<MarkerClusterGroup
						showCoverageOnHover={false}
						spiderfyOnMaxZoom={false}
						disableClusteringAtZoom={16}
						maxClusterRadius={30}>
						{memoizedBusStops}
					</MarkerClusterGroup>
					<Marker
						position={userLocation}
						icon={userIcon}
						title="Tukaj sem">
						<Popup>
							<h3>Vaša lokacija</h3>
						</Popup>
					</Marker>
				</MapContainer>
			</div>
		</div>
	);
};

export default React.memo(Map);
