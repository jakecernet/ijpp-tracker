const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Razdalja med dvema točkama v metrih (haversine). */
export function haversineMeters(lat1, lon1, lat2, lon2) {
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kot `haversineMeters`, a za pare [lat, lon]. Neveljavni vhod → Infinity. */
export function distanceMeters(a, b) {
	if (!a || !b) return Infinity;
	const [lat1, lon1] = a;
	const [lat2, lon2] = b;
	if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
	return haversineMeters(lat1, lon1, lat2, lon2);
}

/** Smer (0–360°) od točke `from` do točke `to`; oba sta [lon, lat]. */
export function bearingDegrees([lon1, lat1], [lon2, lat2]) {
	const dLon = toRad(lon2 - lon1);
	const phi1 = toRad(lat1);
	const phi2 = toRad(lat2);
	const x = Math.sin(dLon) * Math.cos(phi2);
	const y =
		Math.cos(phi1) * Math.sin(phi2) -
		Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
	return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

/** Koordinate, ki so končne in niso "null island" (0, 0). */
export function isUsableLatLon(lat, lon) {
	return Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}
