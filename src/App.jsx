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
	getInterpolatedPosition,
} from "./Api.jsx";

const MapTab = lazy(() => import("./tabs/map"));
const StationsTab = lazy(() => import("./tabs/stations"));
const LinesTab = lazy(() => import("./tabs/lines"));
const SettingsTab = lazy(() => import("./tabs/settings"));

const DEFAULT_VISIBILITY = {
	buses: true,
	busStops: true,
	trainPositions: true,
	trainStops: true,
};

const DEFAULT_BUS_OPERATORS = {
	arriva: true,
	lpp: true,
	nomago: true,
	marprom: true,
	murska: true,
	kranj: true,
	generic: true,
};

// Prebere shranjene nastavitve plasti (avtobusi/vlaki/postaje) iz localStorage.
// Robustno: če je shramba poškodovana, manjkajo posamezni ključi, ali gre za
// star (flat) format iz prejšnje verzije aplikacije, se manjkajoči/neveljavni
// podatki tiho dopolnijo z defaulti namesto da se cela nastavitev zavrže.
function loadMapLayerSettings() {
	let saved = null;
	try {
		const raw = localStorage.getItem("mapLayerSettings");
		if (raw) saved = JSON.parse(raw);
	} catch {
		saved = null;
	}

	const isPlainObject = (v) =>
		v && typeof v === "object" && !Array.isArray(v);

	// Stara verzija je nastavitve plasti shranjevala neposredno (brez "visibility" wrapperja)
	const legacyVisibility =
		isPlainObject(saved) && saved.visibility === undefined
			? saved
			: null;

	const visibilitySource = isPlainObject(saved?.visibility)
		? saved.visibility
		: legacyVisibility;

	const busOperatorsSource = isPlainObject(saved?.busOperators)
		? saved.busOperators
		: null;

	return {
		visibility: { ...DEFAULT_VISIBILITY, ...(visibilitySource || {}) },
		busOperators: {
			...DEFAULT_BUS_OPERATORS,
			...(busOperatorsSource || {}),
		},
	};
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

	const [theme, setTheme] = useState(() => {
		const saved = localStorage.getItem("theme");
		return saved ? saved : "light";
	});

	const [isOnMapTab, setIsOnMapTab] = useState(true);
	const [isOnLinesTab, setIsOnLinesTab] = useState(false);

	const [visibility, setVisibility] = useState(
		() => loadMapLayerSettings().visibility,
	);

	const [busOperators, setBusOperators] = useState(
		() => loadMapLayerSettings().busOperators,
	);

	useEffect(() => {
		try {
			const payload = {
				visibility,
				busOperators,
			};
			localStorage.setItem("mapLayerSettings", JSON.stringify(payload));
		} catch (error) {
			console.warn("Ni bilo mogoče shraniti nastavitev plasti:", error);
		}
	}, [visibility, busOperators]);

	const [gpsPositions, setGpsPositions] = useState([]);
	const [trainPositions, setTrainPositions] = useState([]);

	const [selectedVehicle, setSelectedVehicle] = useState(null);

	const [busStops, setBusStops] = useState([]);
	const [szStops, setSzStops] = useState([]);

	const [ijppArrivals, setIjppArrivals] = useState([]);
	const [lppArrivals, setLppArrivals] = useState([]);
	const [szArrivals, setSzArrivals] = useState([]);

	const [routeLoading, setRouteLoading] = useState(false);
	const [arrivalsLoading, setArrivalsLoading] = useState(false);

	const tripsWithTimingRef = useRef([]);
	const animationFrameRef = useRef(null);
	const deferredGpsPositions = useDeferredValue(gpsPositions);
	const deferredTrainPositions = useDeferredValue(trainPositions);

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

	// Na 3 sekunde fetcha pozicije busov, se ustavi ko ni na map tab-u
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

		fetchPositions();

		let intervalId;

		const startPolling = () => {
			// 3s interval with a 2.5s cache TTL so every poll fetches fresh data
			intervalId = setInterval(fetchPositions, 3000);
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
	}, [isOnMapTab]);

	// fetcha pozicije vlakov, animacija je v useEffect spodi
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

	// black magic za animacijo vlakov
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

    // fetchanje in updejtanje prihodov
	const fetchAndUpdateArrivals = useCallback(async () => {
		const lppId = activeStation?.ref_id || activeStation?.station_code;
		const ijppId = activeStation?.gtfs_id;
		const extraId = activeStation?.ijpp_id;
		const szId = activeStation?.stopId;

		const results = await Promise.allSettled([
			lppId ? fetchLppArrivals(lppId) : Promise.resolve([]),
			ijppId ? fetchIjppArrivals(ijppId) : Promise.resolve([]),
			extraId ? fetchIjppArrivals(extraId) : Promise.resolve([]),
			szId ? fetchSzArrivals(szId) : Promise.resolve([]),
		]);

		const lppData =
			results[0].status === "fulfilled" ? results[0].value : [];
		const ijppData =
			results[1].status === "fulfilled" ? results[1].value : [];
		const extraArrivals = (
			results[2].status === "fulfilled" ? results[2].value : []
		).filter(
			(arrival) =>
				!arrival?.operatorName
					?.toLowerCase()
					.includes("ljubljanski potniški promet"),
		);
		const szData =
			results[3].status === "fulfilled" ? results[3].value : [];

		setLppArrivals(lppData);
		setIjppArrivals([...ijppData, ...extraArrivals]);
		setSzArrivals(szData);
	}, [activeStation]);

	// Fetcha prihode + določi stanje če se še nalagajo
	useEffect(() => {
		const loadArrivals = async () => {
			setArrivalsLoading(true);
			try {
				await fetchAndUpdateArrivals();
			} finally {
				setArrivalsLoading(false);
			}
		};

		loadArrivals();
	}, [activeStation, fetchAndUpdateArrivals]);

	// refresha prihode vsakih 30 sekund
	useEffect(() => {
		if (!isOnLinesTab) {
			return;
		}

		const pollArrivals = async () => {
			try {
				await fetchAndUpdateArrivals();
			} catch (error) {
				console.error("Error polling arrivals:", error);
			}
		};

		const POLLING_INTERVAL = 30000;

		const handleVisibilityChange = () => {
			if (!document.hidden) pollArrivals();
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
	}, [isOnLinesTab, fetchAndUpdateArrivals]);

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
				route = await fetchIJPPTrip(tripData);
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

	// Fetcha cel trip
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

	// tracka če je na zemljevidu al na linijah
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

	// neki počist
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
							<div className="suspense-fallback">
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
										visibility={visibility}
										setVisibility={setVisibility}
										busOperators={busOperators}
										setBusOperators={setBusOperators}
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
