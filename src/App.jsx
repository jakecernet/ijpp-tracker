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
	const [activeOperators, setActiveOperators] = useState(
		localStorage.getItem("activeOperators")
			? JSON.parse(localStorage.getItem("activeOperators"))
			: ["lpp", "arriva", "nomago", "murska"]
	);
	const [radius, setRadius] = useState(
		localStorage.getItem("radius") || 20
	);

	function activeOperatorsNormal(activeOperators) {
		switch (activeOperators) {
			case "lpp":
				return "Javno podjetje Ljubljanski potniški promet d.o.o.";
			case "arriva":
				return "Arriva d.o.o.";
			case "nomago":
				return "Nomago d.o.o.";
			case "murska":
				return "Avtobusni promet Murska Sobota d.d.";
			default:
				return activeOperators;
		}
	}

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
				const newPositions = data.features
					.filter((feature) => {
						const operatorName =
							feature.properties.operator_name.toLowerCase();
						return activeOperatorsNormal(activeOperators).includes(
							operatorName
						);
					})
					.map((feature) => ({
						gpsLocation: feature.geometry.coordinates.reverse(),
						operator: feature.properties.operator_name,
						route:
							feature.properties.route_name || "Neznana linija",
					}));
				setGpsPositions(newPositions);
				console.log(newPositions);
			} catch (error) {
				console.error("Error fetching GPS positions:", error);
			}
		};

		const fetchBusStops = async () => {
			const distance = (lat1, lon1, lat2, lon2) => {
				const R = 6371;
				const dLat = ((lat2 - lat1) * Math.PI) / 180;
				const dLon = ((lon2 - lon1) * Math.PI) / 180;
				const a =
					Math.sin(dLat / 2) * Math.sin(dLat / 2) +
					Math.cos((lat1 * Math.PI) / 180) *
						Math.cos((lat2 * Math.PI) / 180) *
						Math.sin(dLon / 2) * Math.sin(dLon / 2);
				return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			};

			try {
				if (!localStorage.getItem("busStops")) {
					const response = await fetch("https://ojpp.si/api/stop_locations");
					const data = await response.json();
					const newBusStops = data.features.map((feature) => ({
						name: feature.properties.name,
						gpsLocation: feature.geometry.coordinates.reverse(),
						id: feature.properties.id,
					}));
					const filteredBusStops = newBusStops.filter((stop) => {
						const [lat, lon] = stop.gpsLocation;
						return (
							distance(userLocation[0], userLocation[1], lat, lon) <= +radius
						);
					});
					setBusStops(filteredBusStops);
					localStorage.setItem("busStops", JSON.stringify(filteredBusStops));
				} else {
					const storedBusStops = JSON.parse(localStorage.getItem("busStops"));
					const filteredBusStops = storedBusStops.filter((stop) => {
						const [lat, lon] = stop.gpsLocation;
						return (
							distance(userLocation[0], userLocation[1], lat, lon) <= +radius
						);
					});
					setBusStops(filteredBusStops);
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
							<Route
								path="/settings"
								element={
									<SettingsTab
										setActiveOperators={setActiveOperators}
										activeOperators={activeOperators}
										radius={radius}
										setRadius={setRadius}
									/>
								}
							/>
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
