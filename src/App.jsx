import {
	useState,
	useEffect,
	lazy,
	Suspense,
	useCallback,
	useDeferredValue,
	useRef,
} from "react";
import {
	HashRouter as Router,
	NavLink,
	Routes,
	Route,
	useLocation,
} from "react-router-dom";
import { Map, BusFront, Route as RouteIcon, Settings2 } from "lucide-react";
import "./App.css";

import {
	fetchAllBusStops,
	fetchLPPPositions,
	fetchIJPPPositions,
	fetchTrainPositions,
	fetchLppArrivals,
	fetchIjppArrivals,
	fetchLppRoute,
	fetchSzStops,
	fetchSzTrip,
	fetchSzArrivals,
	fetchIJPPTrip,
	prefetchStaticData,
	prefetchRoutesForArrivals,
	getInterpolatedPosition,
} from "./Api.jsx";

const MapTab = lazy(() => import("./tabs/map"));
const StationsTab = lazy(() => import("./tabs/stations"));
const LinesTab = lazy(() => import("./tabs/lines"));
const SettingsTab = lazy(() => import("./tabs/settings"));

if (typeof window !== "undefined") {
	import("./tabs/map");
	import("./tabs/stations");
	import("./tabs/lines");
	import("./tabs/settings");
}

function App() {
	const [activeStation, setActiveStation] = useState(
		localStorage.getItem("activeStation")
			? JSON.parse(localStorage.getItem("activeStation"))
			: {
					name: "Izberite postajo",
					coordinates: [46.057, 14.295],
					id: 123456789,
				},
	);
	const [userLocation, setUserLocation] = useState(
		localStorage.getItem("userLocation")
			? JSON.parse(localStorage.getItem("userLocation"))
			: [46.056, 14.5058],
	);

	const [theme, setTheme] = useState(
		localStorage.getItem("theme") || "light",
	);

	const [isOnMapTab, setIsOnMapTab] = useState(true);

	const [visibility, setVisibility] = useState(() => {
		try {
			const saved = localStorage.getItem("mapLayerSettings");
			if (saved) {
				const settings = JSON.parse(saved);
				if (settings.visibility) {
					return settings.visibility;
				}
			}
		} catch {}
		return {
			buses: true,
			busStops: true,
			trainPositions: true,
			trainStops: true,
		};
	});

	const [busOperators, setBusOperators] = useState(() => {
		try {
			const saved = localStorage.getItem("mapLayerSettings");
			if (saved) {
				const settings = JSON.parse(saved);
				if (settings.busOperators) {
					return settings.busOperators;
				}
			}
		} catch {}
		return {
			arriva: true,
			lpp: true,
			nomago: true,
			marprom: true,
			murska: true,
			generic: true,
		};
	});

	useEffect(() => {
		localStorage.getItem("theme")
			? setTheme(localStorage.getItem("theme"))
			: localStorage.setItem("theme", "light");
	}, []);

	const [gpsPositions, setGpsPositions] = useState([]);
	const [trainPositions, setTrainPositions] = useState([]);
	const [selectedVehicle, setSelectedVehicle] = useState(null);
	const [routeLoading, setRouteLoading] = useState(false);
	const [isOnLinesTab, setIsOnLinesTab] = useState(false);

	const [busStops, setBusStops] = useState([]);
	const [szStops, setSzStops] = useState([]);

	const [ijppArrivals, setIjppArrivals] = useState([]);
	const [lppArrivals, setLppArrivals] = useState([]);
	const [szArrivals, setSzArrivals] = useState([]);
	const [arrivalsLoading, setArrivalsLoading] = useState(false);

	const [mapZoom, setMapZoom] = useState(13);

	const tripsWithTimingRef = useRef([]);
	const animationFrameRef = useRef(null);

	const deferredGpsPositions = useDeferredValue(gpsPositions);
	const deferredTrainPositions = useDeferredValue(trainPositions);

	useEffect(() => {
		try {
			const payload = {
				visibility,
				busOperators,
			};
			localStorage.setItem("mapLayerSettings", JSON.stringify(payload));
		} catch {}
	}, [visibility, busOperators]);

	useEffect(() => {
		prefetchStaticData();
	}, []);

	// Fetcha busne postaje ob zagonu
	useEffect(() => {
		const loadBusStops = async () => {
			try {
				const stops = await fetchAllBusStops();
				setBusStops(stops);
			} catch (error) {
				console.error("Error loading bus stops:", error);
				setBusStops([]);
			}
		};
		loadBusStops();
	}, []);

	// Fetcha SZ postaje ob zagonu
	useEffect(() => {
		const load = async () => {
			try {
				const stops = await fetchSzStops();
				setSzStops(stops);
			} catch (error) {
				console.error("Error loading SZ stops:", error);
			}
		};
		load();
	}, []);

	// Na par sekund fetcha pozicije vlakov + busov (hitrost odvisna od zooma)
	useEffect(() => {
		const fetchPositions = async () => {
			try {
				const [lpp, ijpp] = await Promise.all([
					fetchLPPPositions(),
					fetchIJPPPositions(),
				]);

				const lppPositions = Array.isArray(lpp) ? lpp : [];
				const ijppPositions = Array.isArray(ijpp) ? ijpp : [];

				setGpsPositions([...lppPositions, ...ijppPositions]);
			} catch (error) {
				console.error("Error fetching positions:", error);
			}
		};

		if (!isOnMapTab) {
			return;
		}

		// začetni fetch
		fetchPositions();

		let intervalId;
		const getPollingInterval = () => {
			if (mapZoom < 10) return 15000; // Very zoomed out - 15s
			if (mapZoom < 12) return 10000; // Zoomed out - 10s
			if (mapZoom < 14) return 5000; // Medium zoom - 7s
			return 2000; // Zoomed in - 5s
		};
		const POLLING_INTERVAL = getPollingInterval();

		const startPolling = () => {
			intervalId = setInterval(fetchPositions, POLLING_INTERVAL);
		};

		const stopPolling = () => {
			if (intervalId) {
				clearInterval(intervalId);
				intervalId = null;
			}
		};

		const handleVisibilityChange = () => {
			if (document.hidden) {
				stopPolling();
			} else {
				fetchPositions();
				startPolling();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		startPolling();

		return () => {
			stopPolling();
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
		};
	}, [isOnMapTab, mapZoom]);

	// Fetch train trips and build timed paths for animation
	useEffect(() => {
		if (!isOnMapTab) return;

		const fetchTrains = async () => {
			try {
				const data = await fetchTrainPositions();
				tripsWithTimingRef.current = data;
			} catch (error) {
				console.error(
					"Error fetching train trips for animation:",
					error,
				);
			}
		};

		fetchTrains();
		const intervalId = setInterval(fetchTrains, 30000);
		return () => clearInterval(intervalId);
	}, [isOnMapTab]);

	// Animation loop for train positions
	useEffect(() => {
		if (!isOnMapTab) return;

		const animate = () => {
			const now = Date.now();
			const features = tripsWithTimingRef.current.map((train) => {
				const { coord, bearing } = getInterpolatedPosition(
					train.path,
					now,
				);
				return {
					tripId: train.tripId,
					gpsLocation: coord,
					bearing,
					tripShort: train.tripShort,
					delay: train.delay,
					from: train.from,
					to: train.to,
					realtime: train.realtime,
					departure: train.departure,
					arrival: train.arrival,
				};
			});
			setTrainPositions(features);
			animationFrameRef.current = setTimeout(
				() => requestAnimationFrame(animate),
				1000,
			);
		};

		animate();

		return () => {
			if (animationFrameRef.current) {
				clearTimeout(animationFrameRef.current);
			}
		};
	}, [isOnMapTab]);

	// Dobi userjevo lokacijo
	useEffect(() => {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords;
					setUserLocation([latitude, longitude]);
					localStorage.setItem(
						"userLocation",
						JSON.stringify([latitude, longitude]),
					);
				},
				(error) => {
					console.error("Error getting user's location:", error);
				},
			);
		} else {
			console.error("Geolocation is not supported by this browser.");
		}
	}, []);

	// LPP prihodi
	useEffect(() => {
		const load = async () => {
			const lppCode =
				activeStation?.ref_id || activeStation?.station_code;
			if (!lppCode) {
				setLppArrivals([]);
				return;
			}
			try {
				const arrivals = await fetchLppArrivals(lppCode);
				setLppArrivals(arrivals);
			} catch (error) {
				console.error("Error loading LPP arrivals:", error);
				setLppArrivals([]);
			}
		};
		load();
	}, [activeStation]);

	// IJPP prihodi
	useEffect(() => {
		const load = async () => {
			const ijppId = activeStation?.gtfs_id;
			if (!ijppId) {
				setIjppArrivals([]);
				return;
			}
			try {
				const arrivals = await fetchIjppArrivals(ijppId);
				setIjppArrivals(arrivals);
			} catch (error) {
				console.error("Error loading IJPP arrivals:", error);
				setIjppArrivals([]);
			}
		};
		load();
	}, [activeStation]);

	// SZ prihodi
	useEffect(() => {
		const load = async () => {
			const szId = activeStation?.stopId;
			try {
				const arrivals = await fetchSzArrivals(szId);
				setSzArrivals(arrivals);
			} catch (error) {
				console.error("Error loading SZ arrivals:", error);
				setSzArrivals([]);
			}
		};
		load();
	}, [activeStation]);

	// Set loading state when activeStation changes, clear it when all arrivals resolve
	useEffect(() => {
		setArrivalsLoading(true);
	}, [activeStation]);

	useEffect(() => {
		if (
			ijppArrivals.length > 0 ||
			lppArrivals.length > 0 ||
			szArrivals.length > 0
		) {
			setArrivalsLoading(false);
		}
	}, [ijppArrivals, lppArrivals, szArrivals]);

	// Poll arrivals every 30 seconds when on Lines tab
	useEffect(() => {
		if (!isOnLinesTab) {
			return;
		}

		const pollArrivals = async () => {
			try {
				const lppCode =
					activeStation?.ref_id || activeStation?.station_code;
				const ijppId = activeStation?.gtfs_id;
				const szId = activeStation?.stopId;

				const results = await Promise.all([
					lppCode ? fetchLppArrivals(lppCode) : Promise.resolve([]),
					ijppId ? fetchIjppArrivals(ijppId) : Promise.resolve([]),
					szId ? fetchSzArrivals(szId) : Promise.resolve([]),
				]);

				setLppArrivals(results[0]);
				setIjppArrivals(results[1]);
				setSzArrivals(results[2]);
			} catch (error) {
				console.error("Error polling arrivals:", error);
			}
		};

		const POLLING_INTERVAL = 30000; // 30 seconds

		const handleVisibilityChange = () => {
			if (document.hidden) {
				// Stop polling when page is hidden
			} else {
				// Fetch immediately when page becomes visible
				pollArrivals();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		const intervalId = setInterval(pollArrivals, POLLING_INTERVAL);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
		};
	}, [isOnLinesTab, activeStation]);

	// Prefetch routes for all arrivals in the background
	useEffect(() => {
		if (!ijppArrivals.length && !lppArrivals.length && !szArrivals.length)
			return;
		const timer = setTimeout(() => {
			prefetchRoutesForArrivals(ijppArrivals, lppArrivals, szArrivals);
		}, 500);
		return () => clearTimeout(timer);
	}, [ijppArrivals, lppArrivals, szArrivals]);

	// Za fetchanje tripa iz ID-ja
	const getTripFromId = useCallback(async (tripData, type) => {
		try {
			let route = null;
			const tripId =
				typeof tripData === "object" ? tripData.tripId : tripData;

			if (type === "LPP") {
				const param =
					typeof tripData === "object"
						? tripData
						: { tripId: tripData };
				route = await fetchLppRoute(param);
			} else if (type === "SZ") {
				route = await fetchSzTrip(tripId);
			} else {
				route = await fetchIJPPTrip(tripId);
			}

			if (route) {
				setSelectedVehicle((prev) => {
					if (prev && prev.tripId === route.tripId) {
						return { ...prev, ...route };
					}
					return route;
				});
				return route;
			}
		} catch (error) {
			console.error("Error loading trip from ID:", error);
		}
	}, []);

	// Fetch full route details when a vehicle is selected
	useEffect(() => {
		if (!selectedVehicle) {
			setRouteLoading(false);
			return;
		}

		if (selectedVehicle.geometry && selectedVehicle.stops) {
			setRouteLoading(false);
			return;
		}

		if (!selectedVehicle.tripId && !selectedVehicle.lineId) {
			setRouteLoading(false);
			return;
		}

		let type = "IJPP";
		if (
			selectedVehicle.lineId ||
			(selectedVehicle.operator &&
				selectedVehicle.operator
					.toLowerCase()
					.includes("ljubljanski potniški promet"))
		) {
			type = "LPP";
		} else if (
			selectedVehicle.tripShort ||
			(selectedVehicle.operator &&
				selectedVehicle.operator
					.toLowerCase()
					.includes("slovenske železnice"))
		) {
			type = "SZ";
		}

		setRouteLoading(true);
		getTripFromId(selectedVehicle, type).finally(() =>
			setRouteLoading(false),
		);
	}, [selectedVehicle, getTripFromId]);

	// Component to track route changes and update isOnMapTab and isOnLinesTab
	const RouteTracker = useCallback(() => {
		const location = useLocation();

		useEffect(() => {
			const path = location.pathname;
			const onMap = path === "/" || path === "/map" || path === "";
			const onLines = path === "/lines";
			setIsOnMapTab(onMap);
			setIsOnLinesTab(onLines);
		}, [location.pathname]);

		return null;
	}, []);

	const clearSelectedVehicle = useCallback(
		() => setSelectedVehicle(null),
		[],
	);

	return (
		<Router>
			<RouteTracker />
			<div className={`container ${theme}`}>
				<div className="content">
					<Suspense
						fallback={
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									height: "100%",
									fontSize: "14px",
									color: "#94a3b8",
								}}>
								Nalaganje...
							</div>
						}>
						<Routes>
							<Route
								path="/*"
								element={
									<MapTab
										gpsPositions={deferredGpsPositions}
										busStops={busStops}
										trainStops={szStops}
										activeStation={activeStation}
										setActiveStation={setActiveStation}
										userLocation={userLocation}
										trainPositions={deferredTrainPositions}
										setSelectedVehicle={setSelectedVehicle}
										selectedVehicle={selectedVehicle}
										routeLoading={routeLoading}
										theme={theme}
										setTheme={setTheme}
										visibility={visibility}
										setVisibility={setVisibility}
										busOperators={busOperators}
										setBusOperators={setBusOperators}
										onZoomChange={setMapZoom}
									/>
								}
							/>
							<Route
								path="/stations"
								element={
									<StationsTab
										setActiveStation={setActiveStation}
										busStops={busStops}
										szStops={szStops}
										userLocation={userLocation}
									/>
								}
							/>
							<Route
								path="/lines"
								element={
									<LinesTab
										gpsPositions={gpsPositions}
										activeStation={activeStation}
										ijppArrivals={ijppArrivals}
										lppArrivals={lppArrivals}
										szArrivals={szArrivals}
										getTripFromId={getTripFromId}
										arrivalsLoading={arrivalsLoading}
									/>
								}
							/>
							<Route
								path="/settings"
								element={
									<SettingsTab
										visibility={visibility}
										setVisibility={setVisibility}
										busOperators={busOperators}
										setBusOperators={setBusOperators}
										theme={theme}
										setTheme={setTheme}
									/>
								}
							/>
						</Routes>
					</Suspense>
				</div>
				<nav>
					<NavLink to="/map">
						<button>
							<Map size={24} />
							<h3>Zemljevid</h3>
						</button>
					</NavLink>
					<NavLink to="/stations" onClick={clearSelectedVehicle}>
						<button>
							<BusFront size={24} />
							<h3>Postaje</h3>
						</button>
					</NavLink>
					<NavLink to="/lines" onClick={clearSelectedVehicle}>
						<button>
							<RouteIcon size={24} />
							<h3>Linije</h3>
						</button>
					</NavLink>
					<NavLink to="/settings" onClick={clearSelectedVehicle}>
						<button>
							<Settings2 size={24} />
							<h3>Nastavitve</h3>
						</button>
					</NavLink>
				</nav>
			</div>
		</Router>
	);
}

export default App;
