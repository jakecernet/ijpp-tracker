"use client";

import { useState, useEffect } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain } from "react-icons/fa";
import "./App.css";

import MapTab from "./tabs/map";
import NearMeTab from "./tabs/nearMe";
import ArrivalsTab from "./tabs/arrivals";
import SettingsTab from "./tabs/settings";

function App() {
	const [activeStation, setActiveStation] = useState(
		localStorage.getItem("activeStation")
			? JSON.parse(localStorage.getItem("activeStation"))
			: ["Vrhnika", [46.057, 14.295], 12197]
	);
	const [gpsPositons, setGpsPositions] = useState([]);
	const [trips, setTrips] = useState({});
	const stopArrivals = [];
	const [busStops, setBusStops] = useState([]);
	const [currentUrl, setCurrentUrl] = useState(document.location.pathname);
	const [userLocation, setUserLocation] = useState(
		localStorage.getItem("userLocation")
			? JSON.parse(localStorage.getItem("userLocation"))
			: [46.056, 14.5058]
	);
	const [busStopArrivals, setBusStopArrivals] = useState([]);

	useEffect(() => {
		const savedStation = JSON.parse(localStorage.getItem("activeStation"));
		if (savedStation) {
			setActiveStation(savedStation);
		}
	}, []);

	useEffect(() => {
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

		fetch("https://ojpp.si/api/stop_locations")
			.then((response) => response.json())
			.then((data) => {
				const newBusStops = [];

				data.features.forEach((feature) => {
					const properties = feature.properties;
					const name = feature.properties.name;
					const gpsLocation = feature.geometry.coordinates;
					const id = feature.properties.id;
					gpsLocation.reverse();

					const formattedGpsLocation = gpsLocation
						.join(", ")
						.replace(",", ", ");
					properties.gpsLocation = formattedGpsLocation;

					newBusStops.push({
						name,
						gpsLocation,
						id,
					});
				});

				setBusStops(newBusStops);
				console.log("Bus stops:", newBusStops);
			});

		fetch(
			`https://ojpp.si/api/stop_locations/` +
				activeStation.id +
				`/arrivals`
		)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.json();
			})
			.then((data) => {
				const arrivals = data.map((arrival) => ({
					tripId: arrival.trip_id,
					routeId: arrival.route_id,
					routeName: arrival.route_name,
					timeArrival: arrival.time_arrival,
					timeDeparture: arrival.time_departure,
					operator: arrival.operator.name,
				}));
				setBusStopArrivals(arrivals);
				localStorage.setItem(
					"busStopArrivals",
					JSON.stringify(arrivals)
				);
				console.log("Stop arrivals:", arrivals);
			})
			.catch((error) => {
				console.error(
					"An error occurred while fetching stop arrivals:",
					error
				);
			});
	}, [activeStation]);

	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords;
					setUserLocation([latitude, longitude]);
					localStorage.setItem(
						"userLocation",
						JSON.stringify([latitude, longitude])
					);
				},
				(error) => {
					console.error("Error getting user's location:", error);
				}
			);
		} else {
			console.error("Geolocation is not supported by this browser.");
		}
	}, []);

	return (
		<Router>
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
					<Routes>
						<Route
							path="/*"
							element={
								<MapTab
									gpsPositons={gpsPositons}
									busStops={busStops}
									activeStation={activeStation}
									setActiveStation={setActiveStation}
									userLocation={userLocation}
								/>
							}
						/>
						<Route
							path="/map"
							element={
								<MapTab
									gpsPositons={gpsPositons}
									busStops={busStops}
									activeStation={activeStation}
									setActiveStation={setActiveStation}
									userLocation={userLocation}
								/>
							}
						/>
						<Route
							path="/arrivals"
							element={
								<ArrivalsTab
									activeStation={activeStation}
									stopArrivals={busStopArrivals}
								/>
							}
						/>
						<Route
							path="/stations"
							element={
								<NearMeTab
									setActiveStation={setActiveStation}
									busStops={busStops}
									userLocation={userLocation}
								/>
							}
						/>
						<Route path="/settings" element={<SettingsTab />} />
					</Routes>
				</div>
				<nav className="bottom-nav">
					<NavLink to="/map">
						<button
							onClick={() => setCurrentUrl("/map")}
							className={
								currentUrl === "/map" || currentUrl === "/"
									? "active"
									: ""
							}>
							<Map size={24} />
							<span>Zemljevid</span>
						</button>
					</NavLink>
					<NavLink to="/arrivals">
						<button
							onClick={() => setCurrentUrl("/arrivals")}
							className={
								currentUrl === "/arrivals" ? "active" : ""
							}>
							<Clock size={24} />
							<span>Prihodi</span>
						</button>
					</NavLink>
					<NavLink to="/stations">
						<button
							onClick={() => setCurrentUrl("/stations")}
							className={
								currentUrl === "/stations" ? "active" : ""
							}>
							<MapPin size={24} />
							<span>V bližini</span>
						</button>
					</NavLink>
					<NavLink to="/settings">
						<button
							onClick={() => setCurrentUrl("/settings")}
							className={
								currentUrl === "/settings" ? "active" : ""
							}>
							<Settings size={24} />
							<span>Nastavitve</span>
						</button>
					</NavLink>
				</nav>
			</div>
		</Router>
	);
}

export default App;
