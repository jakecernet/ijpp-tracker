import React, { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain } from "react-icons/fa";
import "./App.css";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const SettingsTab = lazy(() => import("./tabs/settings"));

function App() {
	const [activeStation, setActiveStation] = useState(
		localStorage.getItem("activeStation")
			? JSON.parse(localStorage.getItem("activeStation"))
			: ["Vrhnika", [46.057, 14.295], 123456789]
	);
	const [gpsPositions, setGpsPositions] = useState([]);
	const [busStops, setBusStops] = useState([]);
	const [currentUrl, setCurrentUrl] = useState(window.location.hash.slice(1));
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
		} else {
			document.location.href = "/#/stations";
			setCurrentUrl("/stations");
		}
	}, []);

	useEffect(() => {
		const fetchGpsPositions = async () => {
			try {
				const response = await fetch(
					"https://ojpp.si/api/vehicle_locations"
				);
				const data = await response.json();
				const newPositions = data.features.map((feature) => ({
					gpsLocation: feature.geometry.coordinates.reverse(),
					operator: feature.properties.operator_name,
					route: feature.properties.route_name || "Neznana linija",
				}));
				setGpsPositions(newPositions);
			} catch (error) {
				console.error("Error fetching GPS positions:", error);
			}
		};

		const fetchBusStops = async () => {
			try {
				if (!localStorage.getItem("busStops")) {
					const response = await fetch(
						"https://ojpp.si/api/stop_locations"
					);
					const data = await response.json();
					const newBusStops = data.features.map((feature) => ({
						name: feature.properties.name,
						gpsLocation: feature.geometry.coordinates.reverse(),
						id: feature.properties.id,
					}));
					setBusStops(newBusStops);
					localStorage.setItem(
						"busStops",
						JSON.stringify(newBusStops)
					);
				} else {
					setBusStops(JSON.parse(localStorage.getItem("busStops")));
				}
			} catch (error) {
				console.error("Error fetching bus stops:", error);
			}
		};

		fetchGpsPositions();
		fetchBusStops();

		const intervalId = setInterval(fetchGpsPositions, 30000); // Update every 30 seconds

		return () => clearInterval(intervalId);
	}, []);

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

	useEffect(() => {
		const fetchBusStopArrivals = async () => {
			try {
				const response = await fetch(
					`https://ojpp.si/api/stop_locations/${activeStation.id}/arrivals`
				);
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
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
			} catch (error) {
				console.error("Error fetching bus stop arrivals:", error);
			}
		};

		if (activeStation && activeStation.id) {
			fetchBusStopArrivals();
		}
	}, [activeStation]);

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
					<Suspense fallback={<div>Loading...</div>}>
						<Routes>
							<Route
								path="/*"
								element={
									<MapTab
										gpsPositions={gpsPositions}
										busStops={busStops}
										activeStation={activeStation}
										setActiveStation={setActiveStation}
										userLocation={userLocation}
										setCurentUrl={setCurrentUrl}
									/>
								}
							/>
							<Route
								path="/map"
								element={
									<MapTab
										gpsPositions={gpsPositions}
										busStops={busStops}
										activeStation={activeStation}
										setActiveStation={setActiveStation}
										userLocation={userLocation}
										setCurentUrl={setCurrentUrl}
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
										setCurentUrl={setCurrentUrl}
									/>
								}
							/>
							<Route path="/settings" element={<SettingsTab />} />
						</Routes>
					</Suspense>
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
