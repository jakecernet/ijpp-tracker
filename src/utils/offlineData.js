import { readJSON } from "./storage";
import { decodePolylineOnce, encodePolyline } from "./polyline";

// ---------------------------------------------------------------------------
// Podatki za uporabo brez spletnih klicev (shranjeni v localStorage)
//
// - LPP linije: `routes.json` (trip_id -> trip_int_id) + `shapes-joined.json`
//   (trip_int_id -> geometrija). Geometrije so veliko večje od kvote
//   localStorage (~13 MB), zato jih hranimo kot polyline (~0,7 MB).
// - Postaje: avtobusne (LPP + IJPP) in SŽ.
// ---------------------------------------------------------------------------

const BASE =
	"https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/";

export const SOURCES = {
	routes: `${BASE}routes.json`,
	shapes: `${BASE}shapes-joined.json`,
	busStops: `${BASE}unified_stops_with_gtfs.json`,
	szStops: `${BASE}sz_stops.json`,
};

const KEYS = {
	routes: "offline:lppRoutes",
	shapes: "offline:lppShapes",
	busStops: "offline:busStops",
	szStops: "offline:szStops",
};

const SHAPE_PRECISION = 6;
const DOWNLOAD_TIMEOUT_MS = 120000; // shapes-joined.json je ~13 MB

// Razčlenjeni podatki v pomnilniku (da JSON.parse ne teče ob vsakem iskanju).
const memory = new Map();

function load(name) {
	if (!memory.has(name)) memory.set(name, readJSON(KEYS[name], null));
	return memory.get(name);
}

function save(name, value) {
	// Brez readJSON/writeJSON, ker moramo napako kvote prikazati uporabniku.
	localStorage.setItem(KEYS[name], JSON.stringify(value));
	memory.set(name, value);
}

function remove(name) {
	try {
		localStorage.removeItem(KEYS[name]);
	} catch {
		// ni kritično
	}
	memory.set(name, null);
}

async function download(url) {
	const response = await fetch(url, {
		signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

function isQuotaError(error) {
	return (
		error?.name === "QuotaExceededError" ||
		error?.name === "NS_ERROR_DOM_QUOTA_REACHED"
	);
}

/** Zapiše več ključev; ob napaki povrne prejšnje stanje, da ne ostane polovičen. */
function saveAll(entries) {
	const previous = entries.map(([name]) => [name, load(name)]);
	try {
		for (const [name, value] of entries) save(name, value);
	} catch (error) {
		for (const [name, value] of previous) {
			try {
				if (value == null) remove(name);
				else save(name, value);
			} catch {
				remove(name);
			}
		}
		throw isQuotaError(error)
			? new Error("Ni dovolj prostora v shrambi brskalnika.")
			: error;
	}
}

// ---------------------------------------------------------------------------
// LPP linije
// ---------------------------------------------------------------------------

/** Najdaljši segment (MultiLineString) – enako kot pri spletnem iskanju. */
function longestLine(geometry) {
	if (geometry?.type === "LineString") return geometry.coordinates ?? [];
	if (geometry?.type === "MultiLineString") {
		return (geometry.coordinates ?? []).reduce(
			(best, seg) => (seg.length > best.length ? seg : best),
			[],
		);
	}
	return [];
}

/** Prenese (ali posodobi) vse LPP linije in jih shrani v localStorage. */
export async function downloadLppRoutes() {
	const [routesRaw, shapesRaw] = await Promise.all([
		download(SOURCES.routes),
		download(SOURCES.shapes),
	]);

	const routeList = Array.isArray(routesRaw?.data)
		? routesRaw.data
		: Array.isArray(routesRaw)
			? routesRaw
			: null;
	if (!routeList || !Array.isArray(shapesRaw)) {
		throw new Error("Nepričakovan format podatkov.");
	}

	// trip_id -> [trip_int_id, route_number, route_name]
	const trips = {};
	for (const route of routeList) {
		if (!route?.trip_id || route.trip_int_id == null) continue;
		trips[route.trip_id] = [
			String(route.trip_int_id),
			route.route_number ?? "",
			route.route_name ?? "",
		];
	}

	// trip_int_id -> polyline
	const shapes = {};
	for (const shape of shapesRaw) {
		const line = longestLine(shape?.data);
		if (shape?.trip_int_id == null || line.length < 2) continue;
		shapes[String(shape.trip_int_id)] = encodePolyline(
			line,
			SHAPE_PRECISION,
		);
	}

	const updatedAt = Date.now();
	saveAll([
		["shapes", { updatedAt, shapes }],
		["routes", { updatedAt, trips }],
	]);
	return getLppRoutesInfo();
}

export function getLppRoutesInfo() {
	const routes = load("routes");
	const shapes = load("shapes");
	if (!routes?.trips || !shapes?.shapes) return null;
	return {
		updatedAt: Math.min(routes.updatedAt ?? 0, shapes.updatedAt ?? 0),
		count: Object.keys(shapes.shapes).length,
	};
}

export function clearLppRoutes() {
	remove("routes");
	remove("shapes");
}

/**
 * Geometrija LPP vožnje iz shranjenih podatkov: `trip_id` -> routes.json ->
 * `trip_int_id` -> shranjena geometrija. Če ni zadetka, vrne `null`
 * (klicatelj nato poišče na spletu).
 * Oblika enaka kot pri spletnem iskanju: `[{ tripId, routeNumber, routeName, points }]`,
 * točke v [lat, lon].
 */
export function getStoredLppShape(tripId) {
	if (!tripId) return null;
	const entry = load("routes")?.trips?.[tripId];
	if (!entry) return null;

	const [tripIntId, routeNumber, routeName] = entry;
	const encoded = load("shapes")?.shapes?.[tripIntId];
	if (!encoded) return null;

	const points = decodePolylineOnce(encoded, SHAPE_PRECISION).map(
		([lng, lat]) => [lat, lng],
	);
	if (points.length < 2) return null;

	return [{ tripId, routeNumber, routeName, points }];
}

// ---------------------------------------------------------------------------
// Postaje
// ---------------------------------------------------------------------------

/** Prenese (ali posodobi) avtobusne in železniške postaje. */
export async function downloadStops() {
	const [bus, sz] = await Promise.all([
		download(SOURCES.busStops),
		download(SOURCES.szStops),
	]);
	if (!Array.isArray(bus) || !Array.isArray(sz)) {
		throw new Error("Nepričakovan format podatkov.");
	}

	const updatedAt = Date.now();
	saveAll([
		["busStops", { updatedAt, data: bus }],
		["szStops", { updatedAt, data: sz }],
	]);
	return getStopsInfo();
}

export function getStopsInfo() {
	const bus = load("busStops");
	const sz = load("szStops");
	if (!Array.isArray(bus?.data) || !Array.isArray(sz?.data)) return null;
	return {
		updatedAt: Math.min(bus.updatedAt ?? 0, sz.updatedAt ?? 0),
		busCount: bus.data.length,
		szCount: sz.data.length,
	};
}

export function clearStops() {
	remove("busStops");
	remove("szStops");
}

/** Shranjene avtobusne postaje (surov seznam) ali `null`. */
export function getStoredBusStops() {
	const stored = load("busStops");
	return Array.isArray(stored?.data) ? stored.data : null;
}

/** Shranjene SŽ postaje (surov seznam) ali `null`. */
export function getStoredSzStops() {
	const stored = load("szStops");
	return Array.isArray(stored?.data) ? stored.data : null;
}
