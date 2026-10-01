import { readJSON, writeJSON } from "./storage";

export const LIKED_ROUTES_KEY = "likedRoutes";
export const LIKED_STATIONS_KEY = "likedStations";

export function loadLiked(key) {
	const stored = readJSON(key, []);
	return Array.isArray(stored) ? stored : [];
}

export const saveLiked = (key, items) => writeJSON(key, items);

/** Stabilen ID postaje; `null`, če ga ni (takšne postaje ni mogoče všečkati). */
export function getStationId(station) {
	return (
		station?.ref_id ?? station?.gtfs_id ?? station?.ijpp_id ?? station?.stopId ?? null
	);
}

/** Stabilen ID linije za priljubljene (lineName → tripId, od najbolj do najmanj specifičnega). */
export function getRouteId(route) {
	return (
		route?.lineName ??
		route?.route_name ??
		route?.lineNumber ??
		route?.routeName ??
		route?.tripShort ??
		route?.tripId
	);
}
