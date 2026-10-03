import {
	Suspense,
	lazy,
	useCallback,
	useDeferredValue,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	HashRouter as Router,
	Navigate,
	NavLink,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import {
	Map as MapIcon,
	Route as RouteIcon,
	Settings2,
	TramFront,
	Bookmark,
} from "lucide-react";
import "./App.css";

import {
	detectVehicleType,
	fetchAllBusStops,
	fetchIJPPPositions,
	fetchIJPPTrip,
	fetchIjppArrivals,
	fetchLPPPositions,
	fetchLppArrivals,
	fetchLppRoute,
	fetchSzArrivals,
	fetchSzStops,
	fetchSzTrip,
	fetchTrainPositions,
} from "./Api";

import ErrorBoundary from "./components/ErrorBoundary";
import { usePersistentState } from "./hooks/usePersistentState";
import { usePolling } from "./hooks/usePolling";
import { isLppOperator } from "./utils/operators";

const loadMapTab = () => import("./tabs/map");
const loadStationsTab = () => import("./tabs/stations");
const loadLinesTab = () => import("./tabs/lines");
const loadSettingsTab = () => import("./tabs/settings");

const MapTab = lazy(loadMapTab);
const StationsTab = lazy(loadStationsTab);
const LinesTab = lazy(loadLinesTab);
const SettingsTab = lazy(loadSettingsTab);

const POSITIONS_POLL_MS = 3000;
const POSITIONS_POLL_BACKGROUND_MS = 15000; // na zavihku "Linije" zadostuje redkeje
const TRAINS_POLL_MS = 30000;
const ARRIVALS_POLL_MS = 30000;

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

const DEFAULT_STATION = {
	name: "Izberite postajo",
	coordinates: [46.057, 14.295],
	id: 123456789,
};
const DEFAULT_USER_LOCATION = [46.056, 14.5058];

const isPlainObject = (value) =>
	Boolean(value) && typeof value === "object" && !Array.isArray(value);

function normalizeLayerSettings(saved, fallback) {
	const legacyVisibility =
		isPlainObject(saved) && saved.visibility === undefined ? saved : null;
	const visibility = isPlainObject(saved?.visibility)
		? saved.visibility
		: legacyVisibility;
	const busOperators = isPlainObject(saved?.busOperators)
		? saved.busOperators
		: null;

	return {
		visibility: { ...fallback.visibility, ...visibility },
		busOperators: { ...fallback.busOperators, ...busOperators },
	};
}

const normalizeTheme = (stored, fallback) =>
	stored === "dark" || stored === "light" ? stored : fallback;

const systemTheme = () =>
	window.matchMedia?.("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";

const FALLBACK = <div className="suspense-fallback">Nalaganje...</div>;

function AppShell() {
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const navigateRef = useRef(navigate);
	useEffect(() => {
		navigateRef.current = navigate;
	});

	const isOnMapTab = pathname === "/" || pathname === "/map";
	const isOnLinesTab = pathname === "/lines";

	const [activeStation, setActiveStation] = usePersistentState(
		"activeStation",
		DEFAULT_STATION,
	);
	const [userLocation, setUserLocation] = usePersistentState(
		"userLocation",
		DEFAULT_USER_LOCATION,
	);
	const [theme, setTheme] = usePersistentState("theme", systemTheme, {
		raw: true,
		normalize: normalizeTheme,
	});
	const [mapTheme, setMapTheme] = usePersistentState("mapTheme", "light", {
		raw: true,
		normalize: normalizeTheme,
	});
	const [layerSettings, setLayerSettings] = usePersistentState(
		"mapLayerSettings",
		{ visibility: DEFAULT_VISIBILITY, busOperators: DEFAULT_BUS_OPERATORS },
		{ normalize: normalizeLayerSettings },
	);

	const { visibility, busOperators } = layerSettings;
	const setVisibility = useCallback(
		(update) =>
			setLayerSettings((s) => ({
				...s,
				visibility:
					typeof update === "function"
						? update(s.visibility)
						: update,
			})),
		[setLayerSettings],
	);
	const setBusOperators = useCallback(
		(update) =>
			setLayerSettings((s) => ({
				...s,
				busOperators:
					typeof update === "function"
						? update(s.busOperators)
						: update,
			})),
		[setLayerSettings],
	);

	useLayoutEffect(() => {
		const root = document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(theme);
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute("content", theme === "dark" ? "#0f0f1a" : "#f5f3ff");
	}, [theme]);

	const [busStops, setBusStops] = useState([]);
	const [szStops, setSzStops] = useState([]);
	const [gpsPositions, setGpsPositions] = useState([]);
	const [trains, setTrains] = useState([]);
	const [ijppArrivals, setIjppArrivals] = useState([]);
	const [lppArrivals, setLppArrivals] = useState([]);
	const [szArrivals, setSzArrivals] = useState([]);
	const [arrivalsLoading, setArrivalsLoading] = useState(false);
	const [selectedVehicle, setSelectedVehicle] = useState(null);
	const [routeLoading, setRouteLoading] = useState(false);

	const deferredGpsPositions = useDeferredValue(gpsPositions);

	// Fetcha postaje ob zagonu
	useEffect(() => {
		fetchAllBusStops().then(setBusStops);
		fetchSzStops().then(setSzStops);
	}, []);

	// Uporabnikova lokacija
	useEffect(() => {
		if (!navigator.geolocation) return;
		navigator.geolocation.getCurrentPosition(
			({ coords }) =>
				setUserLocation([coords.latitude, coords.longitude]),
			(error) => console.error("Error getting user's location:", error),
			{ maximumAge: 5 * 60 * 1000, timeout: 15000 },
		);
	}, [setUserLocation]);

	const lastBusPositions = useRef({ lpp: [], ijpp: [] });
	usePolling(
		async () => {
			const [lpp, ijpp] = await Promise.all([
				fetchLPPPositions(),
				fetchIJPPPositions(),
			]);
			if (!lpp && !ijpp) return;
			if (lpp) lastBusPositions.current.lpp = lpp;
			if (ijpp) lastBusPositions.current.ijpp = ijpp;
			setGpsPositions([
				...lastBusPositions.current.lpp,
				...lastBusPositions.current.ijpp,
			]);
		},
		isOnMapTab ? POSITIONS_POLL_MS : POSITIONS_POLL_BACKGROUND_MS,
		isOnMapTab || isOnLinesTab,
	);

	usePolling(
		async () => {
			const data = await fetchTrainPositions();
			if (data) setTrains(data);
		},
		TRAINS_POLL_MS,
		isOnMapTab || isOnLinesTab,
	);

	const lppId = activeStation?.ref_id || activeStation?.station_code;
	const ijppId = activeStation?.gtfs_id;
	const extraId = activeStation?.ijpp_id;
	const szId = activeStation?.stopId;

	const arrivalsRequestRef = useRef(0);
	const loadArrivals = useCallback(async () => {
		const request = ++arrivalsRequestRef.current;
		const settled = await Promise.allSettled([
			lppId ? fetchLppArrivals(lppId) : [],
			ijppId ? fetchIjppArrivals(ijppId) : [],
			extraId ? fetchIjppArrivals(extraId) : [],
			szId ? fetchSzArrivals(szId) : [],
		]);

		if (request !== arrivalsRequestRef.current) return;

		const value = (i) =>
			settled[i].status === "fulfilled" ? settled[i].value : [];
		setLppArrivals(value(0));
		setIjppArrivals([
			...value(1),
			...value(2).filter(
				(arrival) => !isLppOperator(arrival?.operatorName),
			),
		]);
		setSzArrivals(value(3));
	}, [lppId, ijppId, extraId, szId]);

	useEffect(() => {
		let current = true;
		setArrivalsLoading(true);
		loadArrivals().finally(() => {
			if (current) setArrivalsLoading(false);
		});
		return () => {
			current = false;
		};
	}, [loadArrivals]);

	usePolling(loadArrivals, ARRIVALS_POLL_MS, isOnLinesTab);

	const tripRequestRef = useRef(0);

	const getTripFromId = useCallback(async (tripData, type) => {
		const request = ++tripRequestRef.current;
		try {
			const isObject = typeof tripData === "object";
			const tripId = isObject ? tripData.tripId : tripData;

			let route;
			if (type === "LPP") {
				route = await fetchLppRoute(isObject ? tripData : { tripId });
			} else if (type === "SZ") {
				route = await fetchSzTrip(tripId);
			} else {
				route = await fetchIJPPTrip(tripData);
			}
			if (!route) return null;

			if (request === tripRequestRef.current) {
				setSelectedVehicle((prev) =>
					prev && prev.tripId === route.tripId
						? { ...prev, ...route }
						: route,
				);
			}
			return route;
		} catch (error) {
			console.error("Error loading trip from ID:", error);
			return null;
		}
	}, []);

	useEffect(() => {
		const needsRoute =
			selectedVehicle &&
			!(selectedVehicle.geometry && selectedVehicle.stops) &&
			(selectedVehicle.tripId || selectedVehicle.lineId);
		if (!needsRoute) {
			setRouteLoading(false);
			return;
		}

		let current = true;
		setRouteLoading(true);
		getTripFromId(
			selectedVehicle,
			detectVehicleType(selectedVehicle),
		).finally(() => {
			if (current) setRouteLoading(false);
		});
		return () => {
			current = false;
		};
	}, [selectedVehicle, getTripFromId]);

	const handleSetSelectedVehicle = useCallback((vehicle) => {
		if (vehicle === null) tripRequestRef.current++;
		setSelectedVehicle(vehicle);
	}, []);
	const clearSelectedVehicle = useCallback(
		() => handleSetSelectedVehicle(null),
		[handleSetSelectedVehicle],
	);

	const handleSelectStation = useCallback(
		(station) => {
			setActiveStation(station);
			navigateRef.current("/lines");
		},
		[setActiveStation],
	);

	const handleSelectRoute = useCallback(
		async (item, type) => {
			const route = await getTripFromId(item, type);
			if (route) navigateRef.current("/map");
		},
		[getTripFromId],
	);

	useEffect(() => {
		const preload = () =>
			[loadStationsTab, loadLinesTab, loadSettingsTab].forEach((load) =>
				load(),
			);
		if ("requestIdleCallback" in window) {
			const id = requestIdleCallback(preload, { timeout: 5000 });
			return () => cancelIdleCallback(id);
		}
		const id = setTimeout(preload, 2000);
		return () => clearTimeout(id);
	}, []);

	return (
		<div className="container">
			<div className="content">
				<div
					className={`persistent-map${isOnMapTab ? "" : " persistent-map--hidden"}`}>
					<ErrorBoundary>
						<Suspense fallback={FALLBACK}>
							<MapTab
								gpsPositions={deferredGpsPositions}
								trains={trains}
								busStops={busStops}
								trainStops={szStops}
								activeStation={activeStation}
								onSelectStation={handleSelectStation}
								userLocation={userLocation}
								setSelectedVehicle={handleSetSelectedVehicle}
								selectedVehicle={selectedVehicle}
								routeLoading={routeLoading}
								visibility={visibility}
								busOperators={busOperators}
								mapTheme={mapTheme}
								isActive={isOnMapTab}
							/>
						</Suspense>
					</ErrorBoundary>
				</div>
				<ErrorBoundary key={pathname}>
					<Suspense fallback={FALLBACK}>
						<Routes>
							<Route path="/" element={null} />
							<Route path="/map" element={null} />
							<Route
								path="/stations"
								element={
									<StationsTab
										onSelectStation={handleSelectStation}
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
										onSelectRoute={handleSelectRoute}
										arrivalsLoading={arrivalsLoading}
										trains={trains}
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
										mapTheme={mapTheme}
										setMapTheme={setMapTheme}
									/>
								}
							/>
							<Route
								path="*"
								element={<Navigate to="/map" replace />}
							/>
						</Routes>
					</Suspense>
				</ErrorBoundary>
			</div>
			<nav aria-label="Glavna navigacija">
				<NavLink
					to="/map"
					end
					className={({ isActive }) =>
						`mid-nav${isActive || isOnMapTab ? " active" : ""}`
					}
					onClick={clearSelectedVehicle}>
					<MapIcon size={24} />
					<span>Zemljevid</span>
				</NavLink>
				<NavLink to="/stations" onClick={clearSelectedVehicle}>
					<TramFront size={24} />
					<span>Postaje</span>
				</NavLink>
				<NavLink to="/lines" onClick={clearSelectedVehicle}>
					<RouteIcon size={24} />
					<span>Linije</span>
				</NavLink>
				<NavLink to="/settings" onClick={clearSelectedVehicle}>
					<Settings2 size={24} />
					<span>Nastavitve</span>
				</NavLink>
			</nav>
		</div>
	);
}

export default function App() {
	return (
		<Router>
			<AppShell />
		</Router>
	);
}
