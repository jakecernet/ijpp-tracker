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
		station?.ref_id ??
		station?.gtfs_id ??
		station?.ijpp_id ??
		station?.stopId ??
		null
	);
}

/**
 * "sz" (vlak) ali "bus" za postajo. Postaje prihajajo iz več mest z različnimi
 * oznakami tipa ("sz", "train-stop", "bus", "bus-stop"), starejše shranjene
 * priljubljene pa tipa sploh nimajo - takrat ga razberemo iz oblike podatkov
 * (SŽ postaje imajo samo `stopId`, avtobusne ref_id / gtfs_id / ijpp_id).
 */
export function getStationKind(station) {
	const type = station?.type;
	if (type === "sz" || type === "train-stop") return "sz";
	if (type === "bus" || type === "bus-stop") return "bus";
	const hasBusId =
		station?.ref_id != null ||
		station?.gtfs_id != null ||
		station?.ijpp_id != null;
	return station?.stopId != null && !hasBusId ? "sz" : "bus";
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
