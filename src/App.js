"use client";

import { useState, useEffect } from "react";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain } from "react-icons/fa";
import "./App.css";

import MapTab from "./tabs/map";

export default function App() {
	const [activeTab, setActiveTab] = useState("map");
	const [activeStation, setActiveStation] = useState("Dob 2");
	const [position, setPosition] = useState([46.155539, 14.632712]);
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

						const gpsLocation = feature.geometry?.coordinates;
						gpsLocation.reverse();

						const operator = properties.operator_name;

						if (properties.route_name == null) {
							properties.route_name = "Neznana linija";
						}
						const route = properties.route_name;

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
				<div
					className={`tab-content ${
						activeTab === "map" ? "active" : ""
					}`}>
					<MapTab
						position={position}
						gpsPositons={gpsPositons}
						busStops={busStops}
						setLocation={setPosition}
						setActiveStation={setActiveStation}
					/>
				</div>

				<div
					className={`tab-content ${
						activeTab === "arrivals" ? "active" : ""
					}`}>
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

				<div
					className={`tab-content ${
						activeTab === "stations" ? "active" : ""
					}`}>
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

				<div
					className={`tab-content ${
						activeTab === "settings" ? "active" : ""
					}`}>
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
