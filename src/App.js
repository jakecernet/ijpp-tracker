"use client";

import { useState } from "react";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain } from "react-icons/fa";
import "./App.css";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";

const icon = new L.Icon({
	iconUrl: "https://cdn-icons-png.flaticon.com/512/6618/6618280.png",
	iconSize: [50, 50],
	iconAnchor: [25, 50],
});

const busIcon = new L.Icon({
	iconUrl: "https://cdn-icons-png.flaticon.com/512/7561/7561230.png",
	iconSize: [40, 40],
	iconAnchor: [20, 40],
});

export default function Component() {
	const [activeTab, setActiveTab] = useState("map");
	const [activeStation, setActiveStation] = useState("Kolodvor");
	const [position, setPosition] = useState([46.0569, 14.5058]);
	const [gpsPositons, setGpsPositions] = useState([]);

	useEffect(() => {
		const trips = {};
		fetch("https://ojpp.si/api/vehicle_locations")
			.then((response) => response.json())
			.then((data) => {
				const newPositions = []; // New array to collect positions
				data.features.forEach((feature) => {
					const properties = feature.properties;
					const operatorVehicleId = properties?.operator_vehicle_id;
					if (operatorVehicleId) {
						if (!trips[operatorVehicleId]) {
							trips[operatorVehicleId] = [];
						}
						const gpsLocation = feature.geometry.coordinates;
						gpsLocation.reverse(); // Reverse the array
						const formattedGpsLocation = gpsLocation
							.join(", ")
							.replace(",", ", ");
						properties.gpsLocation = formattedGpsLocation;
						trips[operatorVehicleId].push(properties);
						newPositions.push(gpsLocation); // Push to the new array
					}
				});

				setGpsPositions(newPositions); // Update the state with new positions

				for (const operatorVehicleId in trips) {
					if (trips.hasOwnProperty(operatorVehicleId)) {
						console.log(
							`Trip for operator vehicle ID ${operatorVehicleId}:`
						);
						trips[operatorVehicleId].forEach((properties) => {
							for (const key in properties) {
								if (properties.hasOwnProperty(key)) {
									const value = properties[key];
									const formattedKey = key.replace(/"/g, "");
									const formattedValue =
										typeof value === "string"
											? value.replace(/"/g, "")
											: value;
									console.log(
										`${formattedKey}: ${formattedValue}`
									);
								}
							}
						});
						console.log("---");
					}
				}

				console.log(newPositions);
			})
			.catch((error) => {
				console.error("An error occurred:", error);
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
								{gpsPositons.map((gpsPositon, index) => (
									<Marker
										key={index}
										position={gpsPositon}
										icon={busIcon}
									/>
								))}
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
