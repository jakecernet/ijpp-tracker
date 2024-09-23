"use client";

import { useState, useEffect } from "react";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain } from "react-icons/fa";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./App.css";

import arrivaPNG from "./arriva.png";
import lppPNG from "./lpp.png";
import nomagoPNG from "./nomago.png";
import marpromPNG from "./marprom.png";

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

export default function Component() {
	const [activeTab, setActiveTab] = useState("map");
	const [activeStation, setActiveStation] = useState("Kolodvor");
	const [position, setPosition] = useState([46.0569, 14.5058]);
	const [gpsPositons, setGpsPositions] = useState([]);
	const [trips, setTrips] = useState({});
	const [busStops, setBusStops] = useState([]);

	useEffect(() => {
		console.log("Fetching vehicle locations...");
		fetch("https://ojpp.si/api/vehicle_locations")
			.then((response) => response.json())
			.then((data) => {
				const newPositions = [];
				const newTrips = {};

				data.features.forEach((feature) => {
					const properties = feature.properties;
					const operatorVehicleId = properties?.operator_vehicle_id;

					if (operatorVehicleId) {
						if (!newTrips[operatorVehicleId]) {
							newTrips[operatorVehicleId] = [];
						}

						const gpsLocation = feature.geometry.coordinates;
						gpsLocation.reverse();

						const operator = properties.operator_name;

						const route = properties.route_short_name;

						newPositions.push({
							gpsLocation,
							operator,
							route,
						});

						const formattedGpsLocation = gpsLocation
							.join(", ")
							.replace(",", ", ");
						properties.gpsLocation = formattedGpsLocation;
						newTrips[operatorVehicleId].push(properties);
					}
				});

				setGpsPositions(newPositions);
				setTrips(newTrips);
			})
			.catch((error) => {
				console.error("An error occurred:", error);
			});

		console.log("Fetching bus stop locations...");
		fetch("https://ojpp.si/api/stop_locations")
			.then((response) => response.json())
			.then((data) => {
				const newBusStops = [];

				data.features.forEach((feature) => {
					const properties = feature.properties;
					const name = feature.properties.name;
					const gpsLocation = feature.geometry.coordinates;
					gpsLocation.reverse();

					const formattedGpsLocation = gpsLocation
						.join(", ")
						.replace(",", ", ");
					properties.gpsLocation = formattedGpsLocation;

					newBusStops.push({
						name,
						gpsLocation,
					});
				});

				setBusStops(newBusStops);
				console.log("Bus stops:", newBusStops);
			});
	}, []);

	function getBusIcon(operator_id) {
		switch (operator_id) {
			case "Javno podjetje Ljubljanski potniški promet d.o.o.":
				return lppIcon;
			case "Nomago d.o.o.":
				return nomagoIcon;
			case "Arriva d.o.o.":
				return arrivaIcon;
			case "Javno podjetje za mestni potniški promet Marprom, d.o.o.": // Marprom
				return marpromIcon;
			default: // LPP or other operators
				return icon;
		}
	}

	return (
		<div className="mobile-container">
			<div className="header">
				<div>
					<FaBus />
					<FaTrain />
				</div>
				<div>
					<span>IJPP Tracker</span>
				</div>
			</div>
			<div className="content">
				{activeTab === "map" && (
					<div className="tab-content">
						<h2>Live Bus Map</h2>
						<div className="map-container">
							<MapContainer
								center={[46.0569, 14.5058]}
								zoom={13}
								style={{ height: "100%", width: "100%" }}
								attributionControl={false}
								scrollWheelZoom={true}>
								<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
								<Marker position={position} icon={icon} />
								<MarkerClusterGroup
									showCoverageOnHover={false}
									spiderfyOnMaxZoom={false}
									disableClusteringAtZoom={10}
									maxClusterRadius={30}>
									{gpsPositons.map((gpsPositon, index) => {
										const operatorName =
											gpsPositon.operator;
										console.log(
											"Operator name:",
											operatorName
										);
										return (
											<Marker
												key={index}
												position={
													gpsPositon.gpsLocation
												}
												icon={getBusIcon(operatorName)}
												title={gpsPositon.route}>
												<Popup>
													<p>{gpsPositon.route}</p>
													<p>{gpsPositon.operator}</p>
													<p>
														{gpsPositon.gpsLocation}
													</p>
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
												<Popup>{busStop.name}</Popup>
											</Marker>
										);
									})}
								</MarkerClusterGroup>
							</MapContainer>
						</div>
					</div>
				)}

				{activeTab === "arrivals" && (
					<div className="tab-content">
						<h2>Prihodi na: {activeStation}</h2>
						<input
							type="text"
							placeholder="Search for a bus route"
							className="search-input"
						/>
						<div className="arrival-item">
							<h3>6B</h3>
							<p>Naslednji prihod: 5 minut</p>
						</div>
						<div className="arrival-item">
							<h3>18L</h3>
							<p>Naslednji prihod: 10 minut</p>
						</div>
						<div className="arrival-item">
							<h3>46</h3>
							<p>Naslednji prihod: 15 minut</p>
						</div>
						<div className="arrival-item">
							<h3>48P</h3>
							<p>Naslednji prihod: 20 minut</p>
						</div>
						<div className="arrival-item">
							<h3>69</h3>
							<p>Naslednji prihod: 36 minut</p>
						</div>
					</div>
				)}

				{activeTab === "stations" && (
					<div className="tab-content">
						<h2>Postaje v bližini</h2>
						<div
							className="station-item"
							onClick={() => {
								setActiveStation("Kolodvor");
								setActiveTab("arrivals");
								setPosition([46.058, 14.5088]);
							}}>
							<MapPin size={24} />
							<div>
								<h3>Kolodvor</h3>
								<p>0.150 km</p>
							</div>
						</div>
						<div
							className="station-item"
							onClick={() => {
								setActiveStation("Bavarski dvor");
								setActiveTab("arrivals");
								setPosition([46.056, 14.5058]);
							}}>
							<MapPin size={24} />
							<div>
								<h3>Bavarski dvor</h3>
								<p>0.500 km</p>
							</div>
						</div>
						<div
							className="station-item"
							onClick={() => {
								setActiveStation("Razstavišče");
								setActiveTab("arrivals");
								setPosition([46.059, 14.5068]);
							}}>
							<MapPin size={24} />
							<div>
								<h3>Razstavišče</h3>
								<p>0.750 km</p>
							</div>
						</div>
						<div
							className="station-item"
							onClick={() => {
								setActiveStation("Tivoli");
								setActiveTab("arrivals");
								setPosition([46.0569, 14.5058]);
							}}>
							<MapPin size={24} />
							<div>
								<h3>Bleiweisova</h3>
								<p>1.000 km</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === "settings" && (
					<div className="tab-content">
						<h2>Settings</h2>
						<div className="setting-item">
							<label htmlFor="notifications">
								Enable Notifications
							</label>
							<input type="checkbox" id="notifications" />
						</div>
						<input
							type="text"
							placeholder="Home Address"
							className="setting-input"
						/>
						<input
							type="text"
							placeholder="Work Address"
							className="setting-input"
						/>
						<button className="save-button">Save Settings</button>
					</div>
				)}
			</div>
			<nav className="bottom-nav">
				<button
					onClick={() => setActiveTab("map")}
					className={activeTab === "map" ? "active" : ""}>
					<Map size={24} />
					<span>Map</span>
				</button>
				<button
					onClick={() => setActiveTab("arrivals")}
					className={activeTab === "arrivals" ? "active" : ""}>
					<Clock size={24} />
					<span>Arrivals</span>
				</button>
				<button
					onClick={() => setActiveTab("stations")}
					className={activeTab === "stations" ? "active" : ""}>
					<MapPin size={24} />
					<span>Near You</span>
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					className={activeTab === "settings" ? "active" : ""}>
					<Settings size={24} />
					<span>Settings</span>
				</button>
			</nav>
		</div>
	);
}
