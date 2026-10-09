import { bearingDegrees, haversineMeters, isUsableLatLon } from "./utils/geo";
import { isLppOperator, isSzOperator } from "./utils/operators";
import {
	getStoredBusStops,
	getStoredLppShape,
	getStoredSzStops,
} from "./utils/offlineData";
import { decodePolylineOnce } from "./utils/polyline";
import {
	clockToDate,
	formatEta,
	formatHHmm,
	localDateKey,
	minutesUntil,
	secondsToClock,
	secondsToDate,
} from "./utils/time";

// ---------------------------------------------------------------------------
// Viri podatkov
// ---------------------------------------------------------------------------

const busStopsLink =
	"https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/unified_stops_with_gtfs.json";
const szStopsLink =
	"https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/sz_stops.json";

const lppLocationsLink =
	"https://mestnipromet.cyou/api/v1/resources/buses/info";
const ijppLocationsLink = "https://api.beta.brezavta.si/vehicles/locations";

const ijppArrivalsLink = "https://api.beta.brezavta.si/stops/";
const lppArrivalsLink =
	"https://tracker.cernetic.cc/api/lpp-arrivals?station-code=";
const lppRouteLink = "https://tracker.cernetic.cc/api/lpp-route?trip-id=";
const lppRoutePointsLink =
	"https://tracker.cernetic.cc/api/lpp-route-points?route-id=";
const lppAllRoutesLink = "https://tracker.cernetic.cc/api/lpp-all-routes";
const ijppRouteLink = "https://api.beta.brezavta.si/trips/";
const szRouteLink =
	"https://mapper-motis.ojpp-gateway.derp.si/api/v2/trip?tripId=";
const szArrivalsLink =
	"https://mapper-motis.ojpp-gateway.derp.si/api/v1/stoptimes?stopId=";

// Barva proge, po kateri v SZ Mapperju prepoznamo potniške vlake.
const SZ_TRAIN_ROUTE_COLOR = "29ace2";

function buildSzLocationsLink() {
	const now = new Date();
	const later = new Date(now.getTime() + 60000);
	return `https://mapper-motis.ojpp-gateway.derp.si/api/v1/map/trips?min=49.415360776528956%2C7.898969151846785&max=36.38523043114108%2C26.9347879737411&startTime=${encodeURIComponent(
		now.toISOString(),
	)}&endTime=${encodeURIComponent(later.toISOString())}&zoom=20`;
}

// ---------------------------------------------------------------------------
// HTTP + predpomnilnik
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15000;

/**
 * fetch + JSON s časovno omejitvijo (zapeta zahteva na mobilnem omrežju sicer
 * za vedno blokira `inFlight` zastavice v pollingu).
 */
async function fetchJson(url, { signal } = {}) {
	const timeout =
		typeof AbortSignal !== "undefined" && AbortSignal.timeout
			? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			: undefined;
	const combined =
		signal && timeout && AbortSignal.any
			? AbortSignal.any([signal, timeout])
			: (signal ?? timeout);

	const response = await fetch(url, { signal: combined });
	if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
	return response.json();
}

const CACHE_TTL = {
	stops: 5 * 60 * 1000,
	positions: 2.5 * 1000,
	arrivals: 10 * 1000,
	routes: 60 * 1000,
	lppRoutes: 30 * 1000, // ETA-ji so relativni na čas prenosa, zato kratek TTL
	routeList: 10 * 60 * 1000,
	geometry: 6 * 60 * 60 * 1000, // geometrija linij se skoraj nikoli ne spremeni
};

const cache = new Map();
const inFlight = new Map();

/** fetch s TTL predpomnilnikom in združevanjem sočasnih enakih zahtev. */
async function cachedFetch(key, ttl, fetcher) {
	const cached = cache.get(key);
	if (cached && Date.now() - cached.time < ttl) return cached.data;
	if (inFlight.has(key)) return inFlight.get(key);

	const promise = fetcher()
		.then((data) => {
			cache.set(key, { data, time: Date.now(), ttl });
			pruneCache();
			return data;
		})
		.finally(() => inFlight.delete(key));

	inFlight.set(key, promise);
	return promise;
}

/** Predpomnilnik ključev (npr. prihodi po postajah) sicer raste brez omejitve. */
function pruneCache() {
	if (cache.size <= 60) return;
	const now = Date.now();
	for (const [key, entry] of cache) {
		if (now - entry.time >= entry.ttl) cache.delete(key);
	}
}

// Predpomnilnik podrobnosti vožnje (vsebuje geometrijo, zato je omejen).
const ROUTE_CACHE_MAX = 60;
const routeCache = new Map();
const routeInFlight = new Map();

/** Naloži vožnjo z `loader`, jo predpomni po `key` (za `ttl` ms) in združi sočasne klice. */
function loadRoute(key, loader, ttl = CACHE_TTL.routes) {
	if (key) {
		const hit = routeCache.get(key);
		if (hit && Date.now() - hit.time < ttl) {
			return Promise.resolve(hit.data);
		}
		if (routeInFlight.has(key)) return routeInFlight.get(key);
	}

	const promise = loader()
		.then((data) => {
			if (key && data) {
				routeCache.delete(key);
				routeCache.set(key, { data, time: Date.now() });
				while (routeCache.size > ROUTE_CACHE_MAX) {
					routeCache.delete(routeCache.keys().next().value);
				}
			}
			return data;
		})
		.finally(() => {
			if (key) routeInFlight.delete(key);
		});

	if (key) routeInFlight.set(key, promise);
	return promise;
}

// ---------------------------------------------------------------------------
// Čas in prihodi
// ---------------------------------------------------------------------------

function toDate(value) {
	if (value == null || value === "") return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	const date = new Date(value);
	if (!Number.isNaN(date.getTime())) return date;
	return typeof value === "string" ? clockToDate(value) : null;
}

const ARRIVAL_TIME_FIELDS = [
	"realtimeDeparture",
	"actualDeparture",
	"scheduledDeparture",
	"estimated_arrival_time",
	"arrival_time",
	"realtimeArrival",
	"scheduledArrival",
];

/**
 * Iz prihoda izračuna ETA v minutah in uro prihoda ("HH:mm").
 * Polja s časom so lahko Date, ISO niz ali "HH:MM:SS".
 */
function computeEtaAndTime(arrival) {
	let etaMin = arrival.etaMinutes ?? arrival.eta_min ?? undefined;

	let date = null;
	for (const field of ARRIVAL_TIME_FIELDS) {
		date = toDate(arrival[field]);
		if (date) break;
	}

	if (etaMin === undefined && date) etaMin = minutesUntil(date);
	if (!date && etaMin !== undefined) {
		date = new Date(Date.now() + etaMin * 60000);
	}

	return {
		etaMinutes: etaMin ?? undefined,
		arrivalTime: date ? formatHHmm(date) : "N/A",
	};
}

/**
 * Formatira prihod kot "X min\n(HH:mm)".
 * @param {Object} arrival - prihod z `etaMinutes` in `arrivalTime`
 */
export function formatPrecomputedArrival(arrival) {
	return formatEta(arrival.etaMinutes, arrival.arrivalTime);
}

// ---------------------------------------------------------------------------
// Polyline
// ---------------------------------------------------------------------------

function isValidCoord([lon, lat]) {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		Math.abs(lat) <= 90 &&
		Math.abs(lon) <= 180
	);
}

/** Dekodira polyline v [lon, lat]. Če je videti neveljaven, poskusi precision + 1. */
export function decodePolylineToPoints(str, precision) {
	if (!str || typeof str !== "string") return [];
	let pts = decodePolylineOnce(str, precision);
	const first = pts[0];
	if (!first || !isValidCoord(first)) {
		const alt = decodePolylineOnce(str, precision + 1);
		if (alt[0] && isValidCoord(alt[0])) pts = alt;
	}
	return pts.filter(isValidCoord);
}

// ---------------------------------------------------------------------------
// Postaje
// ---------------------------------------------------------------------------

/** Vse avtobusne postaje (LPP + IJPP, združene). */
const fetchAllBusStops = async () => {
	try {
		const raw =
			getStoredBusStops() ??
			(await cachedFetch(busStopsLink, CACHE_TTL.stops, () =>
				fetchJson(busStopsLink),
			));
		if (!Array.isArray(raw)) return [];

		const stops = [];
		for (const stop of raw) {
			const { latitude, longitude } = stop;
			if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
				continue;
			}
			const gpsLocation = [latitude, longitude];
			stops.push({
				...stop,
				name: stop.name ?? "",
				gpsLocation,
				coordinates: gpsLocation,
				ref_id: stop.ref_id ?? null,
				gtfs_id: stop.gtfs_id ?? null,
				ijpp_id: stop.ijpp_id ?? null,
				routes_on_stop: stop.route_groups_on_station ?? [],
				// LPP: lihi ref_id = smer proti centru
				vCenter: stop.ref_id ? stop.ref_id % 2 === 1 : null,
			});
		}
		return stops;
	} catch (error) {
		console.error("Error fetching bus stops:", error);
		return [];
	}
};

const fetchSzStops = async () => {
	try {
		const raw =
			getStoredSzStops() ??
			(await cachedFetch(szStopsLink, CACHE_TTL.stops, () =>
				fetchJson(szStopsLink),
			));
		return Array.isArray(raw) ? raw : [];
	} catch (error) {
		console.error("Error fetching SZ stops:", error);
		return [];
	}
};

/** Seznam vseh LPP linij (za iskanje). */
const fetchLppAllRoutes = async () => {
	try {
		const raw = await cachedFetch(
			lppAllRoutesLink,
			CACHE_TTL.routeList,
			() => fetchJson(lppAllRoutesLink),
		);
		return Array.isArray(raw?.data) ? raw.data : [];
	} catch (error) {
		console.error("Error fetching LPP routes:", error);
		return [];
	}
};

// ---------------------------------------------------------------------------
// Pozicije vozil
// ---------------------------------------------------------------------------

/**
 * Pozicije LPP avtobusov. Ob napaki vrne `undefined`, da lahko klicatelj
 * obdrži zadnje veljavne podatke (namesto da avtobusi utripajo).
 */
const fetchLPPPositions = async () => {
	try {
		const data = await cachedFetch(
			lppLocationsLink,
			CACHE_TTL.positions,
			() => fetchJson(lppLocationsLink),
		);
		if (!Array.isArray(data?.data)) {
			throw new Error("Unexpected LPP payload");
		}

		return data.data
			.filter((bus) => isUsableLatLon(bus.latitude, bus.longitude))
			.map((bus) => ({
				gpsLocation: [bus.latitude, bus.longitude],
				operator: "Ljubljanski potniški promet d.o.o.",
				lineNumber: bus.line_number,
				lineId: bus.line_id,
				lineName: bus.line_name,
				lineDestination: bus.line_destination,
				speed: bus.speed,
				registrska: bus.bus_name,
				ignition: bus.ignition,
				tripId: bus.trip_id,
				heading: bus.direction,
			}));
	} catch (error) {
		console.error("Error fetching lpp positions:", error);
	}
};

/** Pozicije ostalih (IJPP) avtobusov, brez LPP in SŽ. Ob napaki `undefined`. */
const fetchIJPPPositions = async () => {
	try {
		const data = await cachedFetch(
			ijppLocationsLink,
			CACHE_TTL.positions,
			() => fetchJson(ijppLocationsLink),
		);
		if (!Array.isArray(data)) throw new Error("Unexpected IJPP payload");

		return data
			.filter((vehicle) => {
				const operator = vehicle?.vehicle?.operator_name;
				return (
					!isLppOperator(operator) &&
					operator !== "Slovenske železnice" &&
					isUsableLatLon(vehicle?.lat, vehicle?.lon)
				);
			})
			.map((vehicle) => ({
				gpsLocation: [vehicle.lat, vehicle.lon],
				operator: vehicle.vehicle?.operator_name || "/",
				lineName: vehicle.trip_headsign,
				tripId: vehicle.trip_id,
				vehicleId: vehicle.vehicle?.id,
				stop: vehicle.stop?.name ?? "/",
				stopStatus: vehicle.stop_status,
				heading: vehicle.heading || 0,
			}));
	} catch (error) {
		console.error("Error fetching ijpp positions:", error);
	}
};

function buildTrain(train) {
	const coords = decodePolylineOnce(train.polyline || "", 5).filter(
		isValidCoord,
	);
	const departure = new Date(train.departure).getTime();
	const arrival = new Date(train.arrival).getTime();
	const delay =
		Math.max(
			departure - new Date(train.scheduledDeparture).getTime(),
			arrival - new Date(train.scheduledArrival).getTime(),
		) || 0;

	// Pot s časovnimi žigi (čas razporejen sorazmerno z razdaljo), po kateri
	// animiramo vlak.
	let path = [];
	if (coords.length >= 2 && Number.isFinite(departure + arrival)) {
		const dists = [0];
		for (let i = 1; i < coords.length; i++) {
			dists.push(
				dists[i - 1] +
					haversineMeters(
						coords[i - 1][1],
						coords[i - 1][0],
						coords[i][1],
						coords[i][0],
					),
			);
		}
		const totalDist = dists[dists.length - 1];
		if (totalDist > 0) {
			const start = departure + delay;
			const duration = arrival + delay - start;
			path = coords.map((coord, i) => ({
				coord,
				time: start + (dists[i] / totalDist) * duration,
			}));
		}
	}

	const fmtTime = (iso) => (iso ? formatHHmm(iso) : "?");
	const trip = train.trips[0];

	return {
		gpsLocation: coords[0],
		path,
		from: train.from,
		to: train.to,
		realtime: train.realTime,
		departure: fmtTime(train.scheduledDeparture),
		arrival: fmtTime(train.scheduledArrival),
		tripId: trip.tripId,
		tripShort: trip.routeShortName?.split(" ").join("") || "?",
		delay,
	};
}

/**
 * Vlaki s celotno potjo za animacijo. Ob napaki vrne `null`, da klicatelj
 * obdrži prejšnji seznam (prazen seznam pomeni "trenutno ni vlakov").
 */
const fetchTrainPositions = async () => {
	try {
		const data = await fetchJson(buildSzLocationsLink());
		if (!Array.isArray(data)) return [];
		return data
			.filter(
				(train) =>
					train.routeColor === SZ_TRAIN_ROUTE_COLOR &&
					train.trips?.[0]?.tripId,
			)
			.map(buildTrain);
	} catch (error) {
		console.error("Error fetching train positions:", error);
		return null;
	}
};

/**
 * Interpolira pozicijo vlaka na poti glede na trenutni čas.
 * @param {Array<{coord: [number, number], time: number}>} path
 * @param {number} now - timestamp (ms)
 * @returns {{coord: [number, number], bearing: number} | null} null, če poti ni
 */
export function getInterpolatedPosition(path, now) {
	if (!path?.length) return null;
	const last = path.length - 1;

	if (now <= path[0].time) {
		const bearing =
			last > 0 ? bearingDegrees(path[0].coord, path[1].coord) : 0;
		return { coord: path[0].coord, bearing };
	}
	if (now >= path[last].time) {
		const bearing =
			last > 0
				? bearingDegrees(path[last - 1].coord, path[last].coord)
				: 0;
		return { coord: path[last].coord, bearing };
	}

	// Binarno iskanje prvega odseka, ki se konča po `now`.
	let lo = 1;
	let hi = last;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (path[mid].time >= now) hi = mid;
		else lo = mid + 1;
	}

	const prev = path[lo - 1];
	const curr = path[lo];
	const span = curr.time - prev.time;
	const t = span > 0 ? (now - prev.time) / span : 0;
	return {
		coord: [
			prev.coord[0] + (curr.coord[0] - prev.coord[0]) * t,
			prev.coord[1] + (curr.coord[1] - prev.coord[1]) * t,
		],
		bearing: bearingDegrees(prev.coord, curr.coord),
	};
}

// ---------------------------------------------------------------------------
// Podrobnosti vožnje (postaje + geometrija)
// ---------------------------------------------------------------------------

/** Podrobnosti IJPP vožnje. */
const fetchIJPPTrip = async (trip) => {
	if (!trip) return null;
	const tripId = trip.tripId || trip;
	const operator =
		(typeof trip === "object" && (trip.operatorName || trip.operator)) ||
		"";

	return loadRoute(tripId, async () => {
		try {
			const [raw, geometry] = await Promise.all([
				fetchJson(`${ijppRouteLink}${tripId}?date=${localDateKey()}`),
				fetchJson(`${ijppRouteLink}${tripId}/geometry`),
			]);

			return {
				tripName: raw?.trip_headsign || "",
				tripId: raw?.gtfs_id || "",
				stops: (raw?.stop_times ?? []).map((stop) => ({
					arrival: secondsToClock(stop.arrival_realtime),
					departure: secondsToClock(stop.departure_realtime),
					realtime: stop.realtime,
					passed: stop.passed,
					name: stop.stop?.name ?? "",
					gtfsId: stop.stop?.gtfs_id,
					gpsLocation: [
						stop.stop?.lat ?? null,
						stop.stop?.lon ?? null,
					],
				})),
				geometry: geometry?.coordinates || [],
				operator,
				isLPP: false,
				isSZ: false,
			};
		} catch (error) {
			console.error("Error fetching IJPP trip:", error);
			return null;
		}
	});
};

/**
 * Geometrija LPP linije (najprej shranjene linije, nato splet). Vrne `[{ tripId, routeNumber, routeName, points }]`
 * s točkami v [lat, lon] (kot pričakuje zemljevid) ali `null`.
 */
const fetchLppPoints = (routeId, tripId = null) =>
	routeId || tripId
		? loadRoute(
				`lpp-shape:${routeId}:${tripId ?? ""}`,
				() => loadLppPoints(routeId, tripId),
				CACHE_TTL.geometry,
			)
		: Promise.resolve(null);

const loadLppPoints = async (routeId, tripId) => {
	const stored = getStoredLppShape(tripId);
	if (stored) return stored;
	if (!routeId) return null;

	try {
		const raw = await cachedFetch(
			lppRoutePointsLink + routeId,
			CACHE_TTL.geometry,
			() => fetchJson(lppRoutePointsLink + routeId),
		);
		const shapes = (raw.data ?? []).filter(
			(point) => point.geojson_shape != null,
		);
		const shape =
			(tripId && shapes.find((point) => point.trip_id === tripId)) ||
			shapes[0];
		if (!shape?.geojson_shape?.type) return null;

		const { type, coordinates } = shape.geojson_shape;
		let line = [];
		if (type === "LineString") {
			line = coordinates;
		} else if (type === "MultiLineString") {
			line = coordinates.reduce(
				(longest, seg) => (seg.length > longest.length ? seg : longest),
				[],
			);
		}

		return [
			{
				tripId: shape.trip_id,
				routeNumber: shape.route_number,
				routeName: shape.route_name,
				points: line.map(([lng, lat]) => [lat, lng]),
			},
		];
	} catch (error) {
		console.error("Error fetching LPP route points:", error);
		return null;
	}
};

/**
 * Podrobnosti LPP vožnje: postaje s prihodi (proxy za
 * https://data.lpp.si/api/route/arrivals-on-route) + geometrija.
 */
const fetchLppRoute = async (lppRoute) => {
	if (!lppRoute) return null;

	return loadRoute(
		lppRoute.tripId,
		async () => {
			try {
				const [raw, geometry] = await Promise.all([
					fetchJson(lppRouteLink + lppRoute.tripId),
					fetchLppPoints(
						lppRoute.lineId || lppRoute.routeId,
						lppRoute.tripId,
					),
				]);

				return {
					isLPP: true,
					isSZ: false,
					fetchedAt: Date.now(),
					tripId: lppRoute.tripId || "",
					tripName: lppRoute.lineName || lppRoute.tripName || "",
					lineNumber: lppRoute.lineNumber || lppRoute.routeName || "",
					operator:
						"Javno podjetje Ljubljanski potniški promet d.o.o.",
					stops: Array.isArray(raw.data)
						? raw.data.map((stop) => ({
								name: stop.name || "",
								stopId: stop.station_code || "",
								gpsLocation: [
									stop.latitude ?? null,
									stop.longitude ?? null,
								],
								arrivals: (stop.arrivals ?? []).map(
									(arrival) => ({
										eta_min: arrival.eta_min,
									}),
								),
							}))
						: [],
					geometry: geometry || [],
				};
			} catch (error) {
				console.error("Error fetching LPP route:", error);
				return null;
			}
		},
		CACHE_TTL.lppRoutes,
	);
};

const toSzStop = (place) => ({
	name: place?.name || "",
	stopId: place?.stopId || "",
	gpsLocation: [place?.lat ?? null, place?.lon ?? null],
	arrival: place?.arrival || "",
	departure: place?.departure || "",
});

/** Podrobnosti SZ vožnje. */
const fetchSzTrip = async (tripId) => {
	if (!tripId) return null;

	return loadRoute(tripId, async () => {
		try {
			const fetched = await fetchJson(szRouteLink + tripId);
			const leg = Array.isArray(fetched?.legs) ? fetched.legs[0] : null;
			if (!leg) return null;

			const from = toSzStop(leg.from);
			const to = toSzStop(leg.to);
			return {
				from,
				to,
				tripName: leg.headsign || "",
				duration: leg.duration || "",
				startTime: leg.startTime || "",
				endTime: leg.endTime || "",
				realTime: leg.realTime || false,
				tripId: leg.tripId || "",
				tripShort: leg.routeShortName || "",
				brand: "sz",
				stops: [
					from,
					...(leg.intermediateStops ?? []).map(toSzStop),
					to,
				],
				geometry: leg.legGeometry
					? decodePolylineToPoints(leg.legGeometry.points || "", 6)
					: [],
				operator: "Slovenske železnice d.o.o.",
				isLPP: false,
				isSZ: true,
			};
		} catch (error) {
			console.error("Error fetching SZ trip:", error);
			return null;
		}
	});
};

// ---------------------------------------------------------------------------
// Prihodi na postajo
// ---------------------------------------------------------------------------

/** LPP prihodi (proxy za https://data.lpp.si/api/station/arrival). */
const fetchLppArrivals = async (stationCode) => {
	if (!stationCode) return [];
	try {
		const url = lppArrivalsLink + stationCode;
		const raw = await cachedFetch(url, CACHE_TTL.arrivals, () =>
			fetchJson(url),
		);
		const list = Array.isArray(raw?.data?.arrivals)
			? raw.data.arrivals
			: [];
		return list
			.map((arrival) => ({
				...computeEtaAndTime({ etaMinutes: arrival.eta_min }),
				routeName: arrival.route_name,
				tripName: arrival.trip_name,
				routeId: arrival.route_id,
				tripId: arrival.trip_id,
				vehicleId: arrival.vehicle_id,
				type: arrival.type,
				depot: arrival.depot,
				operatorName: "Ljubljanski potniški promet d.o.o.",
			}))
			.sort((a, b) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999));
	} catch (error) {
		console.error("Error fetching LPP arrivals:", error);
		return [];
	}
};

/** IJPP prihodi na postajo. */
const fetchIjppArrivals = async (ijppId) => {
	if (!ijppId) return [];
	try {
		const url = `${ijppArrivalsLink}${ijppId}?current=true`;
		const raw = await cachedFetch(url, CACHE_TTL.arrivals, () =>
			fetchJson(url),
		);
		const list = Array.isArray(raw?.arrivals) ? raw.arrivals : [];
		return list.map((arrival) => {
			const eta = computeEtaAndTime({
				realtimeDeparture: secondsToDate(arrival?.departure_realtime),
				scheduledDeparture: secondsToDate(arrival?.departure_scheduled),
			});
			return {
				operatorName: arrival?.agency_name,
				tripName: arrival?.trip_headsign,
				passed: arrival?.passed,
				realTime: arrival?.realtime,
				scheduledArrival: secondsToClock(arrival?.arrival_scheduled),
				realtimeArrival: secondsToClock(arrival?.arrival_realtime),
				arrivalDelay: arrival?.arrival_delay,
				scheduledDeparture: secondsToClock(
					arrival?.departure_scheduled,
				),
				realtimeDeparture: secondsToClock(arrival?.departure_realtime),
				departureDelay: arrival?.departure_delay,
				tripId: arrival?.trip_id,
				routeId: arrival?.route_id,
				routeShortName: arrival?.route_short_name,
				etaMinutes: eta.etaMinutes,
				arrivalTime: eta.arrivalTime,
			};
		});
	} catch (error) {
		console.error("Error fetching IJPP arrivals:", error);
		return [];
	}
};

/** Odhodi vlakov s SZ postaje (danes in jutri). */
const fetchSzArrivals = async (stationCode) => {
	if (!stationCode) return [];
	try {
		const url = `${szArrivalsLink}${encodeURIComponent(stationCode)}&n=100`;
		const raw = await cachedFetch(url, CACHE_TTL.arrivals, () =>
			fetchJson(url),
		);

		// API vrne UTC časovne žige, zato primerjamo z UTC datumoma.
		const today = new Date().toISOString().split("T")[0];
		const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0];

		return (raw?.stopTimes || [])
			.filter((arrival) => {
				const day = arrival?.place?.scheduledDeparture?.split("T")[0];
				return day === today || day === tomorrow;
			})
			.map((arrival) => {
				const place = arrival.place;
				const realTime = arrival.realTime || false;
				const { scheduledArrival, scheduledDeparture } = place;
				const actualArrival = realTime ? place.arrival : null;
				const actualDeparture = realTime ? place.departure : null;

				const delayMs = (actual, scheduled) =>
					actual && scheduled
						? new Date(actual) - new Date(scheduled)
						: 0;

				const eta = computeEtaAndTime({
					realtimeArrival: actualArrival,
					scheduledArrival,
					realtimeDeparture: actualDeparture,
					scheduledDeparture,
				});

				return {
					headsign: arrival.headsign,
					tripId: arrival.tripId,
					routeShortName: arrival.routeShortName,
					realTime,
					scheduledArrival,
					scheduledDeparture,
					realtimeArrival: actualArrival,
					realtimeDeparture: actualDeparture,
					arrivalDelay: delayMs(actualArrival, scheduledArrival),
					departureDelay: delayMs(
						actualDeparture,
						scheduledDeparture,
					),
					etaMinutes: eta.etaMinutes,
					arrivalTime: eta.arrivalTime,
					operatorName: "Slovenske železnice d.o.o.",
				};
			});
	} catch (error) {
		console.error("Error fetching SZ arrivals:", error);
		return [];
	}
};

export const prefetchRoute = (item, type) => {
	if (!item) return;
	const kind = type || detectVehicleType(item);
	const request =
		kind === "LPP"
			? fetchLppRoute(typeof item === "object" ? item : { tripId: item })
			: kind === "SZ"
				? fetchSzTrip(item.tripId ?? item)
				: fetchIJPPTrip(item);
	request?.catch?.(() => {});
};

/** Katera vrsta prevoznika je vozilo/vožnja? Določa, kateri API naložimo. */
export const detectVehicleType = (vehicle) => {
	if (!vehicle) return "IJPP";
	if (vehicle.lineId || isLppOperator(vehicle.operator)) return "LPP";
	if (vehicle.tripShort || isSzOperator(vehicle.operator)) return "SZ";
	return "IJPP";
};

export {
	fetchAllBusStops,
	fetchIJPPPositions,
	fetchIJPPTrip,
	fetchIjppArrivals,
	fetchLPPPositions,
	fetchLppAllRoutes,
	fetchLppArrivals,
	fetchLppRoute,
	fetchSzArrivals,
	fetchSzStops,
	fetchSzTrip,
	fetchTrainPositions,
};
