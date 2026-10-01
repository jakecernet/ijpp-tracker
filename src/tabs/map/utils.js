import { isUsableLatLon } from "../../utils/geo";

const HTML_ENTITIES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHTML(value) {
	return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

export function toGeoJSONPoints(items, getCoord, getProps) {
	const features = [];
	for (const item of items || []) {
		const coord = getCoord(item) || [];
		const [lat, lng] = coord;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
		features.push({
			type: "Feature",
			geometry: { type: "Point", coordinates: [lng, lat] },
			properties: getProps ? getProps(item, coord) : {},
		});
	}
	return { type: "FeatureCollection", features };
}

const decodedIcons = new Map();

function decodeIcon(src) {
	if (!decodedIcons.has(src)) {
		decodedIcons.set(
			src,
			new Promise((resolve) => {
				const img = new Image();
				img.onload = () => resolve(img);
				img.onerror = () => resolve(null);
				img.src = src;
			}),
		);
	}
	return decodedIcons.get(src);
}

export async function ensureIcons(map, iconSources) {
	await Promise.all(
		iconSources.map(async ({ id, image }) => {
			if (map.hasImage(id)) return;
			const img = await decodeIcon(image);
			if (!img || map.hasImage(id)) return;
			try {
				map.addImage(id, img, { sdf: false });
			} catch (err) {
				console.warn(`Ne morem dodati slike "${id}":`, err);
			}
		}),
	);
}

/**
 * Extract coordinates from a stop object with various possible formats.
 * @returns [lat, lon] or null if invalid.
 */
export function extractStopCoord(stop) {
	if (!stop) return null;

	// Try gpsLocation array first
	if (Array.isArray(stop.gpsLocation)) {
		const [lat, lon] = stop.gpsLocation;
		if (isUsableLatLon(lat, lon)) return [lat, lon];
	}

	// Try stop_location (LPP format)
	if (stop.stop_location) {
		if (Array.isArray(stop.stop_location)) {
			const [lat, lon] = stop.stop_location;
			if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
		} else if (typeof stop.stop_location === "object") {
			const lat = Number(stop.stop_location.lat ?? stop.stop_location[0]);
			const lon = Number(stop.stop_location.lon ?? stop.stop_location[1]);
			if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
		}
	}

	// Try direct lat/lon properties
	const lat = Number(stop.latitude ?? stop.lat ?? stop.stop_lat);
	const lon = Number(stop.longitude ?? stop.lon ?? stop.stop_lon);
	if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];

	return null;
}

/**
 * Get stop name from various possible property names.
 */
export function extractStopName(stop) {
	return (
		stop?.name ||
		stop?.stop_name ||
		stop?.station_name ||
		stop?.route_name ||
		""
	);
}

/**
 * Convert stops array to GeoJSON features.
 */
export function stopsToFeatures(stops, brand, includeFrom, includeTo) {
	const features = [];

	const addStop = (s) => {
		const coord = extractStopCoord(s);
		if (!coord) return;
		features.push({
			type: "Feature",
			geometry: { type: "Point", coordinates: [coord[1], coord[0]] },
			properties: { name: extractStopName(s), brand: brand || "generic" },
		});
	};

	if (includeFrom) addStop(includeFrom);
	if (Array.isArray(stops)) stops.forEach(addStop);
	if (includeTo) addStop(includeTo);

	return features;
}

/**
 * Parse train gpsLocation [lng, lat] to [lat, lng]
 */
export function parseTrainCoord(gpsLocation) {
	if (!Array.isArray(gpsLocation)) return null;
	const [lng, lat] = gpsLocation;
	return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * Koordinate postaje kot [lat, lon] (iz gpsLocation ali lat/lon). Vrednosti
 * `null` se NE pretvorijo v 0 (prej so takšne postaje pristale pri 0°, 0°).
 */
export function getStopCoord(stop) {
	if (!stop) return null;
	const [lat, lon] = Array.isArray(stop.gpsLocation)
		? stop.gpsLocation
		: [stop.lat, stop.lon];
	return isUsableLatLon(lat, lon) ? [lat, lon] : null;
}
