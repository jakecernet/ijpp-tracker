import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { fetchLppAllRoutes, formatPrecomputedArrival } from "../Api";
import SubTabs from "../components/SubTabs";
import { useLikedList } from "../hooks/useLikedList";
import {
	LIKED_ROUTES_KEY,
	LIKED_STATIONS_KEY,
	getRouteId,
	getStationId,
} from "../utils/likes";
import { isLppOperator, isSzOperator } from "../utils/operators";

const SEARCH_DEBOUNCE_MS = 300;
const LINE_TABS = [
	["arrivals", "Prihodi", "BusIcon"],
	["all", "Vse linije", "SquareText"],
	["liked", "Shranjene", "Heart"],
];
const ROW_GAP = 8;

const includesTerm = (value, term) =>
	typeof value === "string" && value.toLowerCase().includes(term);

const bgColorMap = (item) => {
	const operator = item?.operator || item?.operatorName;
	const type = item?.type;
	const name = typeof operator === "string" ? operator.toLowerCase() : "";

	if (type === "LPP" || isLppOperator(operator)) return "var(--lpp-color)";
	if (type === "SZ" || isSzOperator(operator)) return "var(--sz-color)";
	if (name.includes("nomago")) return "var(--nomago-color)";
	if (name.includes("marprom")) return "var(--marprom-color)";
	if (name.includes("arriva")) return "var(--arriva-color)";
	if (name.includes("murska")) return "var(--murska-color)";
	if (name.includes("kranj")) return "var(--kranj-color)";
	return "var(--default-color)";
};

const formatDelay = (scheduledDeparture, actualDeparture) => {
	if (!scheduledDeparture || !actualDeparture) return "N/A";
	const scheduled = new Date(scheduledDeparture);
	const actual = new Date(actualDeparture);
	if (Number.isNaN(scheduled.getTime()) || Number.isNaN(actual.getTime())) {
		return "N/A";
	}
	// Negativna zamuda (prezgodaj) se je prej izpisala kot "--2 min".
	return ` ${Math.round((actual - scheduled) / 60000)} min`;
};

const getEndpointName = (endpoint) => {
	if (!endpoint) return "";
	if (typeof endpoint === "string") return endpoint;
	return (
		endpoint.name ||
		endpoint.stopName ||
		endpoint.stationName ||
		endpoint.title ||
		""
	);
};

const joinEndpoints = (item) =>
	[getEndpointName(item.from), getEndpointName(item.to)]
		.filter(Boolean)
		.join(" - ");

const getRouteDisplayName = (item) =>
	item.displayName ||
	item.lineName ||
	item.headsign ||
	item.name ||
	item.tripName ||
	joinEndpoints(item);

const onActivateKey = (handler) => (event) => {
	if (event.key === "Enter" || event.key === " ") {
		event.preventDefault();
		handler();
	}
};

const RouteItem = memo(({ item, isLiked, onToggleLike, onClick }) => {
	const open = () => onClick(item);
	return (
		<li
			className="route-item"
			role="button"
			tabIndex={0}
			onClick={open}
			onKeyDown={onActivateKey(open)}
			style={{ "--operator-color": bgColorMap(item) }}>
			<div className="left">
				<span className="line-badge">
					{item.lineNumber ??
						item.routeName ??
						item.routeShortName ??
						item.tripShort ??
						item.tripId?.slice(5) ??
						"?"}
				</span>
				<h3>{getRouteDisplayName(item)}</h3>
			</div>
			<button
				type="button"
				className={`like-btn ${isLiked ? "liked" : ""}`}
				onClick={(event) => onToggleLike(item, event)}
				onKeyDown={(event) => event.stopPropagation()}
				aria-pressed={isLiked}
				aria-label={
					isLiked
						? "Odstrani iz priljubljenih"
						: "Dodaj med priljubljene"
				}>
				<Heart size={20} fill={isLiked ? "currentColor" : "none"} />
			</button>
		</li>
	);
});

const ArrivalItem = memo(({ arrival, onRouteClick }) => {
	const open = () => onRouteClick(arrival, arrival.type);
	return (
		<div
			className="arrival-item"
			role="button"
			tabIndex={0}
			onClick={open}
			onKeyDown={onActivateKey(open)}
			style={{ "--operator-color": bgColorMap(arrival) }}>
			<div className="left">
				<span className="line-badge">
					{arrival.type === "LPP"
						? arrival.routeName
						: arrival.routeShortName || arrival.tripName}
				</span>
				<div className="info">
					<h3>{arrival.tripName || arrival.headsign}</h3>
					<h4>{arrival.operatorName}</h4>
				</div>
			</div>
			<p className="arrival-item__eta">
				{formatPrecomputedArrival(arrival)}
			</p>
			{arrival.type === "SZ" && arrival.realTime && (
				<p>
					Zamuda:
					<br />
					{formatDelay(
						arrival.scheduledDeparture,
						arrival.realtimeDeparture,
					)}
				</p>
			)}
		</div>
	);
});

const ArrivalRow = memo(({ children }) => (
	<div style={{ paddingBottom: ROW_GAP }}>{children}</div>
));

const SkeletonArrivalItem = memo(() => (
	<div className="arrival-item skeleton" aria-hidden="true">
		<div className="left">
			<div className="circle skeleton-circle"></div>
			<div className="skeleton-text skeleton-title"></div>
		</div>
		<div className="skeleton-text skeleton-time"></div>
	</div>
));

/** Polja, ki jih shranimo za priljubljeno linijo. */
const createLikedRouteEntry = (route) => ({
	name:
		route.displayName ||
		route.lineName ||
		route.route_name ||
		route.tripName ||
		route.tripShort,
	lineNumber: route.lineNumber || route.routeName || route.tripShort,
	operator: route.operator || route.operatorName,
	headsign:
		route.headsign ||
		route.displayName ||
		route.tripName ||
		joinEndpoints(route),
	displayName: route.displayName || route.tripName || joinEndpoints(route),
	tripId: route.tripId,
	tripShort: route.tripShort,
	lineId: route.lineId,
	routeId: route.routeId,
});

const routeTypeOf = (item) =>
	item.type === "SZ" || item.tripShort || isSzOperator(item.operator)
		? "SZ"
		: isLppOperator(item.operator)
			? "LPP"
			: "IJPP";

const LinesTab = ({
	gpsPositions,
	activeStation,
	ijppArrivals,
	lppArrivals,
	szArrivals,
	onSelectRoute,
	onPrefetchRoute,
	arrivalsLoading,
	trains,
}) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedTerm, setDebouncedTerm] = useState("");
	const [page, setPage] = useState("arrivals"); // arrivals | all | liked
	const [likedRoutes, toggleLikedRoute] = useLikedList(LIKED_ROUTES_KEY);
	const [likedStations, toggleLikedStation] =
		useLikedList(LIKED_STATIONS_KEY);
	const [lppNumberedRoutes, setLppNumberedRoutes] = useState([]);

	useEffect(() => {
		const timer = setTimeout(
			() => setDebouncedTerm(searchTerm),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	useEffect(() => {
		if (page !== "all" || lppNumberedRoutes.length > 0) return;
		let cancelled = false;
		fetchLppAllRoutes().then((routes) => {
			if (!cancelled) setLppNumberedRoutes(routes);
		});
		return () => {
			cancelled = true;
		};
	}, [page, lppNumberedRoutes.length]);

	const term = debouncedTerm.toLowerCase();

	const stationId = getStationId(activeStation);
	const isStationLiked =
		stationId != null && likedStations.some((s) => s.id === stationId);

	const toggleLikeStation = useCallback(
		(event) => {
			event?.stopPropagation();
			if (stationId == null) return;
			toggleLikedStation(stationId, () => ({
				name: activeStation.name,
				data: activeStation,
			}));
		},
		[stationId, activeStation, toggleLikedStation],
	);

	// Vse trenutno aktivne linije (iz GPS pozicij in vlakov), brez podvojenih imen.
	const allActiveRoutes = useMemo(() => {
		const routes = [];
		const seenNames = new Set();

		for (const vehicle of gpsPositions) {
			if (isLppOperator(vehicle?.operator) && !vehicle?.lineName)
				continue;
			const name = vehicle.lineName || vehicle.route_name;
			if (name && !seenNames.has(name)) {
				seenNames.add(name);
				routes.push(vehicle);
			}
		}

		for (const train of trains) {
			const name = train.tripShort;
			if (!name || seenNames.has(name)) continue;
			seenNames.add(name);
			const relation = joinEndpoints(train);
			routes.push({
				...train,
				lineName: name,
				lineNumber: name,
				tripName: relation,
				displayName: relation,
				operator: "Slovenske železnice d.o.o.",
				type: "SZ",
			});
		}
		return routes;
	}, [gpsPositions, trains]);

	const likedRouteIds = useMemo(
		() => new Set(likedRoutes.map((r) => r.id)),
		[likedRoutes],
	);
	const isRouteLiked = useCallback(
		(route) => likedRouteIds.has(getRouteId(route)),
		[likedRouteIds],
	);

	const toggleLikeRoute = useCallback(
		(route, event) => {
			event?.stopPropagation();
			toggleLikedRoute(getRouteId(route), () =>
				createLikedRouteEntry(route),
			);
		},
		[toggleLikedRoute],
	);

	const allArrivals = useMemo(() => {
		const ijpp = (ijppArrivals || [])
			.filter(
				(arrival) =>
					includesTerm(arrival?.tripName, term) &&
					(!isLppOperator(arrival?.operatorName) ||
						arrival?.etaMinutes > 60),
			)
			.map((arrival) => ({ ...arrival, type: "IJPP" }));

		const lpp = (lppArrivals || [])
			.filter(
				(arrival) =>
					includesTerm(arrival.tripName, term) ||
					includesTerm(arrival.routeName, term),
			)
			.map((arrival) => ({ ...arrival, type: "LPP" }));

		const sz = (szArrivals || [])
			.filter((arrival) => includesTerm(arrival.headsign, term))
			.map((arrival) => ({ ...arrival, type: "SZ" }));

		return [...ijpp, ...lpp, ...sz].sort(
			(a, b) => (a.etaMinutes ?? Infinity) - (b.etaMinutes ?? Infinity),
		);
	}, [ijppArrivals, lppArrivals, szArrivals, term]);

	const arrivalKeys = useMemo(() => {
		const seen = new Map();
		return allArrivals.map((arrival) => {
			const base = `${arrival.type}-${arrival.tripId ?? arrival.routeId ?? "x"}`;
			const count = seen.get(base) ?? 0;
			seen.set(base, count + 1);
			return count === 0 ? base : `${base}#${count}`;
		});
	}, [allArrivals]);

	const filteredAllRoutes = useMemo(() => {
		if (term.length < 1) return [];

		const lpp = lppNumberedRoutes
			.filter(
				(route) =>
					includesTerm(route?.route_number?.toString(), term) ||
					includesTerm(route?.route_name, term),
			)
			.map((route) => ({
				lineName: route.route_name,
				lineNumber: route.route_number,
				tripId: route.trip_id,
				routeId: route.route_id,
				lineId: route.route_id,
				operator: "Ljubljanski potniški promet d.o.o.",
			}));

		if (term.length < 3) return lpp;

		const seenIds = new Set(lpp.map(getRouteId));
		const combined = [...lpp];
		for (const route of allActiveRoutes) {
			const label =
				route.lineName ||
				route.route_name ||
				route.lineNumber ||
				route.routeName ||
				route.tripShort ||
				route.tripId ||
				"";
			const id = getRouteId(route);
			if (!String(label).toLowerCase().includes(term) || seenIds.has(id))
				continue;
			seenIds.add(id);
			combined.push(route);
		}
		return combined;
	}, [term, lppNumberedRoutes, allActiveRoutes]);

	const resolvedLikedRoutes = useMemo(() => {
		const activeById = new Map(
			allActiveRoutes.map((r) => [getRouteId(r), r]),
		);
		return likedRoutes
			.filter((liked) =>
				(liked.name || liked.lineNumber || "")
					.toLowerCase()
					.includes(term),
			)
			.map(
				(liked) =>
					activeById.get(liked.id) || {
						lineName: liked.name,
						lineNumber: liked.lineNumber,
						operator: liked.operator,
						headsign: liked.headsign,
						displayName: liked.displayName || liked.name,
						tripId: liked.tripId,
						tripShort: liked.tripShort,
						lineId: liked.lineId,
						routeId: liked.routeId,
					},
			);
	}, [likedRoutes, allActiveRoutes, term]);

	const handleRouteClick = useCallback(
		(item, type) => {
			if (!item.tripId && !item.lineId && !item.routeId) {
				console.warn("No valid trip/line ID for route", item);
				return;
			}
			onSelectRoute(item, type || routeTypeOf(item));
		},
		[onSelectRoute],
	);

	const handlePrefetch = useCallback(
		(item, type) => {
			if (!item.tripId && !item.lineId && !item.routeId) return;
			onPrefetchRoute?.(item, type || routeTypeOf(item));
		},
		[onPrefetchRoute],
	);

	return (
		<div className="insideDiv">
			<div className="lines-header">
				<h2>{activeStation?.name}</h2>
				<button
					type="button"
					className={`like-btn ${isStationLiked ? "liked" : ""}`}
					onClick={toggleLikeStation}
					disabled={stationId == null}
					aria-pressed={isStationLiked}
					aria-label={
						isStationLiked
							? "Odstrani postajo iz priljubljenih"
							: "Dodaj postajo med priljubljene"
					}>
					<Heart
						size={20}
						fill={isStationLiked ? "currentColor" : "none"}
					/>
				</button>
			</div>
			<input
				type="search"
				placeholder={
					page === "arrivals"
						? "Išči po številki linije..."
						: "Išči linije..."
				}
				aria-label="Iskanje linij"
				className="search-input"
				value={searchTerm}
				onChange={(event) => setSearchTerm(event.target.value)}
			/>
			<SubTabs
				label="Prikaz linij"
				tabs={LINE_TABS}
				value={page}
				onChange={setPage}
			/>
			<div className="results">
				{page === "arrivals" && (
					<div className="arrival-list">
						{arrivalsLoading &&
							[0, 1, 2, 3, 4].map((i) => (
								<ArrivalRow key={i}>
									<SkeletonArrivalItem />
								</ArrivalRow>
							))}
						{!arrivalsLoading && allArrivals.length === 0 && (
							<p className="empty-message">
								Ni prihodov na tej postaji.
							</p>
						)}
						{!arrivalsLoading &&
							allArrivals.map((arrival, index) => (
								<ArrivalRow key={arrivalKeys[index]}>
									<ArrivalItem
										arrival={arrival}
										onRouteClick={handleRouteClick}
										onPrefetch={handlePrefetch}
									/>
								</ArrivalRow>
							))}
					</div>
				)}
				{page === "all" && (
					<>
						{searchTerm.length < 1 && (
							<p className="empty-message">
								Vnesite številko linije ali ime.
							</p>
						)}
						{searchTerm.length >= 1 &&
							filteredAllRoutes.length === 0 && (
								<p className="empty-message">Ni rezultatov.</p>
							)}
						<ul className="route-list">
							{filteredAllRoutes.map((route, index) => (
								<RouteItem
									key={getRouteId(route) ?? index}
									item={route}
									isLiked={isRouteLiked(route)}
									onToggleLike={toggleLikeRoute}
									onClick={handleRouteClick}
									onPrefetch={handlePrefetch}
								/>
							))}
						</ul>
					</>
				)}
				{page === "liked" && (
					<>
						{resolvedLikedRoutes.length === 0 && (
							<p className="empty-message">
								Ni priljubljenih linij. Kliknite na ❤️ za
								dodajanje.
							</p>
						)}
						<ul className="route-list">
							{resolvedLikedRoutes.map((route, index) => (
								<RouteItem
									key={getRouteId(route) ?? index}
									item={route}
									isLiked
									onToggleLike={toggleLikeRoute}
									onClick={handleRouteClick}
									onPrefetch={handlePrefetch}
								/>
							))}
						</ul>
					</>
				)}
			</div>
		</div>
	);
};

export default memo(LinesTab);
