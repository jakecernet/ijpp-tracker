/** Dekodira Google polyline v [lon, lat] točke. */
export function decodePolylineOnce(str, precision) {
	const factor = 10 ** precision;
	let index = 0;
	let lat = 0;
	let lng = 0;
	const points = [];

	const read = () => {
		let result = 0;
		let shift = 0;
		let byte;
		do {
			byte = str.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		return result & 1 ? ~(result >> 1) : result >> 1;
	};

	while (index < str.length) {
		lat += read();
		lng += read();
		points.push([lng / factor, lat / factor]);
	}
	return points;
}

function encodeValue(value) {
	let v = value < 0 ? ~(value << 1) : value << 1;
	let out = "";
	while (v >= 0x20) {
		out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
		v >>= 5;
	}
	return out + String.fromCharCode(v + 63);
}

/** Zakodira [lon, lat] točke v Google polyline (za kompakten zapis v localStorage). */
export function encodePolyline(points, precision) {
	const factor = 10 ** precision;
	let prevLat = 0;
	let prevLng = 0;
	let out = "";
	for (const [lng, lat] of points) {
		const latE = Math.round(lat * factor);
		const lngE = Math.round(lng * factor);
		out += encodeValue(latE - prevLat) + encodeValue(lngE - prevLng);
		prevLat = latE;
		prevLng = lngE;
	}
	return out;
}
