export function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };
        return entities[char] || char;
    });
}

export function toGeoJSONPoints(items, getCoord, getProps) {
    return {
        type: "FeatureCollection",
        features: (items || [])
            .map((item) => {
                const [lat, lng] = getCoord(item) || [];
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [lng, lat] },
                    properties: getProps ? getProps(item) : {},
                };
            })
            .filter(Boolean),
    };
}

export function loadImage(map, id, src) {
    return new Promise((resolve) => {
        if (map.hasImage(id)) {
            resolve();
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                map.addImage(id, img, { sdf: false });
            } catch (err) {
                console.warn(`Ne morem dodati slike "${id}":`, err);
            }
            resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
    });
}

export function ensureIcons(map, iconSources) {
    return Promise.all(
        iconSources.map(({ id, image }) => loadImage(map, id, image))
    );
}

function decodePolylineOnce(str, precision) {
    const factor = Math.pow(10, precision);
    let index = 0;
    let lat = 0;
    let lng = 0;
    const pts = [];
    while (index < str.length) {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        result = 0;
        shift = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        const latitude = lat / factor;
        const longitude = lng / factor;
        pts.push([longitude, latitude]);
    }
    return pts;
}

function isValidCoord([lon, lat]) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
    );
}

export function decodePolylineToPoints(str, precision) {
    if (!str || typeof str !== "string") return [];
    let pts = decodePolylineOnce(str, precision);
    // If decoded points look implausible (e.g., 3 digits before decimal), try precision+1 (common 1e6 factor)
    const first = pts[0];
    if (!first || !isValidCoord(first)) {
        const alt = decodePolylineOnce(str, precision + 1);
        if (alt[0] && isValidCoord(alt[0])) pts = alt;
    }
    // Filter to valid coordinate range just in case
    return pts.filter(isValidCoord);
}
