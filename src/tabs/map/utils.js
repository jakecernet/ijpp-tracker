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

/**
 * Extract coordinates from a stop object with various possible formats.
 * Returns [lat, lon] or null if invalid.
 */
export function extractStopCoord(stop) {
    if (!stop) return null;

    // Try gpsLocation array first
    if (Array.isArray(stop.gpsLocation)) {
        const [lat, lon] = stop.gpsLocation;
        if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
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
 * Parse train gpsLocation string "lng,lat" to [lat, lng]
 */
export function parseTrainCoord(gpsLocation) {
    if (!gpsLocation) return null;
    const [lng, lat] = String(gpsLocation)
        .split(",")
        .map((v) => Number(v.trim()));
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * Get coordinates from stop with gpsLocation array or lat/lon props
 */
export function getStopCoord(stop) {
    if (!stop) return null;
    const lat = Number(
        Array.isArray(stop.gpsLocation) ? stop.gpsLocation[0] : stop.lat
    );
    const lon = Number(
        Array.isArray(stop.gpsLocation) ? stop.gpsLocation[1] : stop.lon
    );
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}
