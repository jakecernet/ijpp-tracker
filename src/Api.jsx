const now = new Date();
const later = new Date(now.getTime() + 60000); // 1 minuta

import { format } from "date-fns";
import { sl } from "date-fns/locale";

const busStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/unified_stops_with_gtfs.json";

const lppLocationsLink =
    "https://mestnipromet.cyou/api/v1/resources/buses/info";
const ijppLocationsLink = "https://api.beta.brezavta.si/vehicles/locations";
const szLocationsLink = `https://mapper-motis.ojpp-gateway.derp.si/api/v1/map/trips?min=49.415360776528956%2C7.898969151846785&max=36.38523043114108%2C26.9347879737411&startTime=${encodeURIComponent(
    now.toISOString(),
)}&endTime=${encodeURIComponent(later.toISOString())}&zoom=20`;

const ijppArrivalsLink = "https://api.beta.brezavta.si/stops/";
const lppArrivalsLink =
    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=";
const lppRouteLink = "https://tracker.cernetic.cc/api/lpp-route?trip-id=";
const lppRoutePointsLink =
    "https://tracker.cernetic.cc/api/lpp-route-points?route-id=";
const ijppRouteLink = "https://api.beta.brezavta.si/trips/";
const szRouteLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v2/trip?tripId=";
const szArrivalsLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v1/stoptimes?stopId=";

const szStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/sz_stops.json";

/**
 * Univerzalni objekt izbrane rute
 * @type {Object}
 */
let selectedRoute = {
    tripId: "",
    tripName: "",
    operator: "",
    stops: [],
    geometry: [],
    isLPP: false,
    isSZ: false,
};

/**
 * Helper za fetchanje JSON podatkov
 * @param {*} url - Link
 * @returns JSON s podatki
 */
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

const cache = new Map();

// Cache TTL values in milliseconds
const CACHE_TTL = {
    stops: 5 * 60 * 1000, // 5 minutes - static data, rarely changes
    positions: 5 * 1000, // 5 seconds - real-time positions
    arrivals: 15 * 1000, // 15 seconds - arrival predictions
    routes: 5 * 60 * 1000, // 5 minutes - route/trip data
};

// Dedicated route cache keyed by tripId
const routeCache = new Map();
// Track in-flight prefetch promises to avoid duplicate requests
const routeInFlight = new Map();

function getCachedRoute(tripId) {
    const cached = routeCache.get(tripId);
    if (cached && Date.now() - cached.time < CACHE_TTL.routes) {
        return cached.data;
    }
    return null;
}

function setCachedRoute(tripId, data) {
    if (tripId && data) {
        routeCache.set(tripId, { data, time: Date.now() });
    }
}

/**
 * Helper za fetchanje s cachingom
 * @returns
 */
async function cachedFetch(key, ttl, fetcher) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < ttl) return cached.data;
    const data = await fetcher();
    cache.set(key, { data, time: Date.now() });
    return data;
}

/**
 * Prefetch static data (bus stops, train stops) on app initialization
 * Call this early to warm the cache before user needs the data
 */
export async function prefetchStaticData() {
    try {
        // Fetch both in parallel to speed up initial load
        await Promise.all([
            cachedFetch(busStopsLink, CACHE_TTL.stops, () =>
                fetchJson(busStopsLink),
            ),
            cachedFetch(szStopsLink, CACHE_TTL.stops, () =>
                fetchJson(szStopsLink),
            ),
        ]);
        console.log("Static data prefetched successfully");
    } catch (error) {
        console.warn("Prefetch failed, will fetch on demand:", error);
    }
}

/**
 * Helper za dekodiranje nekega sranja za dobit lokacije vlakov
 * @param {string} str - Polyline tekst
 * @returns {Array} Tabelo [longitude, latitude] koordinat
 */
function decodePolyline(str) {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift,
        result,
        byte;
    const factor = 1e5;
    while (index < str.length) {
        shift = result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = result = 0;
        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push([lng / factor, lat / factor]);
    }
    return coordinates;
}

/** Pretvori sekunde od polnoči v časovni format HH:MM:SS
 * @param {number} seconds - Sekunde od polnoči
 * @returns Čas v formatu HH:MM:SS
 */
function seconds2time(seconds) {
    const hour = `${Math.floor(seconds / 3600)}`.padStart(2, "0");
    const minute = `${Math.floor((seconds % 3600) / 60)}`.padStart(2, "0");
    const second = `${seconds % 60}`.padStart(2, "0");
    return `${hour}:${minute}:${second}`;
}

/**
 * Formatira čas v obliko HH:mm
 * @param {Date|string} arrivalTime - Čas prihoda
 * @returns Čas v formatu HH:mm ali N/A
 */
export function formatTime(arrivalTime) {
    if (!arrivalTime) return "N/A";
    try {
        const date = new Date(arrivalTime);
        if (isNaN(date.getTime())) return "N/A";
        return format(date, "HH:mm", { locale: sl });
    } catch {
        return "N/A";
    }
}

/**
 * Formatira prihod z ETA minutami in časom
 * @param {Object} arrival - Podatki o prihodu
 * @returns {Object} Objekt s etaMinutes in arrivalTime (HH:mm format)
 */
function computeEtaAndTime(arrival) {
    let etaMin = arrival.etaMinutes ?? arrival.eta_min ?? undefined;
    let actualTime =
        arrival.realtimeDeparture ||
        arrival.actualDeparture ||
        arrival.scheduledDeparture ||
        arrival.estimated_arrival_time ||
        arrival.arrival_time ||
        arrival.realtimeArrival ||
        arrival.scheduledArrival;

    let actualDate = null;
    if (actualTime) {
        actualDate = new Date(actualTime);
        // If parsing failed or if it looks like a time-only string, try prepending today's date
        if (
            isNaN(actualDate.getTime()) &&
            typeof actualTime === "string" &&
            actualTime.match(/^\d{2}:\d{2}(:\d{2})?$/)
        ) {
            const today = new Date().toISOString().split("T")[0];
            actualDate = new Date(`${today}T${actualTime}`);
        }
    }
    if (actualDate && isNaN(actualDate.getTime())) {
        actualDate = null;
    }

    // Generate ETA if missing
    if (etaMin === undefined && actualDate) {
        const now = new Date();
        etaMin = Math.max(
            0,
            Math.round((actualDate.getTime() - now.getTime()) / 60000),
        );
    }

    // Generate actual time if missing
    if (!actualDate && etaMin !== undefined) {
        actualDate = new Date(new Date().getTime() + etaMin * 60000);
    }

    const timeStr = actualDate ? formatTime(actualDate) : "N/A";
    return {
        etaMinutes: etaMin ?? undefined,
        arrivalTime: timeStr,
    };
}

/**
 * Formatira prihod s pre-computed ETA minutami in časom
 * @param {Object} arrival - Podatki o prihodu s etaMinutes in arrivalTime
 * @returns Niz v obliki "X min (HH:mm)"
 */
export function formatPrecomputedArrival(arrival) {
    const etaMin = arrival.etaMinutes ?? "?";
    const timeStr = arrival.arrivalTime ?? "N/A";
    return `${etaMin} min (${timeStr})`;
}

/**
 * Helper za dekodirat routo vlaka iz polylina
 * @param {string} polyline - Polyline tekst
 * @param {Array} points - Tabelo točk
 */
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

/**
 * Še en helper
 */
function isValidCoord([lon, lat]) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lon) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lon) <= 180
    );
}

/**
 * Dejanska helper funkcija za dekodiranje polylina
 **/
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

/**
 *  Fetcha vse bus postaje
 *  @returns Tabelo vseh bus postaj
 */
const fetchAllBusStops = async () => {
    try {
        const raw = await cachedFetch(busStopsLink, CACHE_TTL.stops, () =>
            fetchJson(busStopsLink),
        );
        const list = Array.isArray(raw) ? raw : [];

        return list
            .map((stop) => {
                const latitude = Number(
                    stop.latitude ?? stop.lat ?? stop["Latitude"],
                );
                const longitude = Number(
                    stop.longitude ?? stop.lon ?? stop["Longitude"],
                );
                const gpsLocation = Array.isArray(stop.gpsLocation)
                    ? stop.gpsLocation
                    : [latitude, longitude];
                const vCenter = stop.ref_id % 2 === 1 ? true : false;
                if (
                    !Number.isFinite(gpsLocation?.[0]) ||
                    !Number.isFinite(gpsLocation?.[1])
                ) {
                    return null;
                }

                const refId = stop.ref_id ?? stop.refID ?? stop.refId ?? null;
                const ijppId =
                    stop.ijpp_id ?? stop.ijppID ?? stop.ijppId ?? null;

                const routesOnStop = stop.route_groups_on_station
                    ? stop.route_groups_on_station
                    : [];

                return {
                    ...stop,
                    name: stop.name ?? stop.stop_name ?? "",
                    gpsLocation: gpsLocation,
                    coordinates: gpsLocation,
                    ref_id: refId,
                    ijpp_id: ijppId,
                    routes_on_stop: routesOnStop,
                    vCenter: refId ? vCenter : null,
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error("Error fetching bus stops:", error);
        return [];
    }
};

/**
 * Fetcha postaje vlakov
 * @returns Tabelo s postajami
 */
const fetchSzStops = async () => {
    try {
        const raw = await cachedFetch(szStopsLink, CACHE_TTL.stops, () =>
            fetchJson(szStopsLink),
        );
        return raw;
    } catch (error) {
        console.error("Error fetching SZ stops:", error);
        return [];
    }
};

/**
 * Fetcha LPP bus pozicije
 * @returns Tabela z LPP pozicijami
 */
const fetchLPPPositions = async () => {
    try {
        const data = await fetchJson(lppLocationsLink);

        const lppPositions = data.data.map((bus) => ({
            gpsLocation: [bus.latitude, bus.longitude],
            operator: "Ljubljanski potniški promet d.o.o.",
            lineNumber: bus.line_number,
            lineId: bus.line_id,
            lineName: bus.line_name,
            lineDestination: bus.line_destination,
            speed: bus.speed,
            busName: bus.bus_name,
            ignition: bus.ignition,
            tripId: bus.trip_id,
        }));

        return lppPositions;
    } catch (error) {
        console.error("Error fetching lpp positions:", error);
    }
};

/**
 * Fetcha IJPP podatke o vozilih
 * @returns Tabela z IJPP pozicijami in routami ('stops' lastnost)
 */
const fetchIJPPPositions = async () => {
    try {
        const data = await fetchJson(ijppLocationsLink);
        const ijppPositions = Array.isArray(data)
            ? data
                  .filter(
                      (vehicle) =>
                          vehicle?.vehicle?.operator_name !=
                          "Ljubljanski Potniški Promet",
                  )
                  .map((vehicle) => ({
                      gpsLocation: [vehicle?.lat || 0, vehicle?.lon || 0],
                      heading: vehicle?.heading || 0,
                      operator: vehicle?.vehicle?.operator_name || "/",
                      lineName: vehicle?.trip_headsign,
                      tripId: vehicle?.trip_id,
                      vehicleId: vehicle?.vehicle?.id,
                      stop: vehicle && vehicle.stop ? vehicle.stop.name : "/",
                      stopStatus: vehicle?.stop_status,
                  }))
            : [];
        return ijppPositions;
    } catch (error) {
        console.error("Error fetching ijpp positions:", error);
    }
};

/**
 * Fetcha pozicije vlakov
 * @returns Tabelo s pozicijami vlakov
 */
const fetchTrainPositions = async () => {
    try {
        const data = await fetchJson(szLocationsLink);
        const filteredData = data.filter(
            (train) => train.routeColor == "29ace2",
        );
        const positions = filteredData.map((train) => {
            const formatIso = (iso) => {
                if (!iso) return null;
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return iso;
                const Y = d.getFullYear();
                const M = String(d.getMonth() + 1).padStart(2, "0");
                const D = String(d.getDate()).padStart(2, "0");
                const h = String(d.getHours()).padStart(2, "0");
                const m = String(d.getMinutes()).padStart(2, "0");
                return `${Y}-${M}-${D} ${h}:${m}`;
            };

            return {
                gpsLocation: decodePolyline(train.polyline)[0],
                from: train.from,
                to: train.to,
                realtime: train.realTime,
                departure: formatIso(train.scheduledDeparture),
                arrival: formatIso(train.scheduledArrival),
                tripId: train.trips[0]?.tripId,
                tripShort: train.trips[0]?.routeShortName,
            };
        });

        return positions;
    } catch (error) {
        console.error("Error fetching train positions:", error);
    }
};

/**
 *  Fetcha IJPP trip
 * @param {string} tripId - ID tripa
 * @returns Podrobnosti o tripu
 */
const fetchIJPPTrip = async (trip) => {
    if (!trip) return null;
    const tripId = trip.tripId || trip;
    const cached = getCachedRoute(tripId);
    if (cached) return cached;
    try {
        const dateString = new Date().toISOString().split("T")[0];
        const raw = await fetchJson(
            ijppRouteLink + tripId + `?date=${dateString}`,
        );
        const pointsResponse = await fetchJson(
            ijppRouteLink + tripId + "/geometry",
        );
        const operator = fetchIJPPPositions().then((positions) =>
            fetchIjppArrivals(
                JSON.parse(localStorage.getItem("activeStation")).gtfs_id,
            ).then((arrivals) => {
                const vehicle = positions.find((pos) => pos.tripId === tripId);
                const arrival = arrivals.find((arr) => arr.tripId === tripId);
                return arrival?.operatorName || vehicle?.operator || "";
            }),
        );

        selectedRoute = {
            tripName: raw?.trip_headsign || "",
            tripId: raw?.gtfs_id || "",
            stops: raw?.stop_times
                ? raw.stop_times.map((stop) => ({
                      arrival: seconds2time(stop.arrival_realtime),
                      departure: seconds2time(stop.departure_realtime),
                      realtime: stop.realtime,
                      passed: stop.passed,
                      name: stop.stop.name,
                      gtfsId: stop.stop.gtfs_id,
                      gpsLocation: [stop.stop.lat || 0, stop.stop.lon || 0],
                  }))
                : [],
            geometry: pointsResponse.coordinates || [],
            operator: await operator,
            isLPP: false,
            isSZ: false,
        };
        setCachedRoute(tripId, selectedRoute);
        return selectedRoute;
    } catch (error) {
        console.error("Error fetching IJPP trip:", error);
        return null;
    }
};

/** Fetcha točke LPP route
 * @param {string} routeId - ID route
 * @param {string} tripId - Optional trip ID to filter by specific trip
 * @returns Tabelo s točkami route
 */
const fetchLppPoints = async (routeId, tripId = null) => {
    if (!routeId) return null;
    try {
        const raw = await fetchJson(lppRoutePointsLink + routeId);
        let data = raw.data?.filter((point) => point.geojson_shape != null);

        // If tripId is provided, filter to only include that specific trip's geometry
        if (tripId && data) {
            const matchingTrip = data.find((point) => point.trip_id === tripId);
            // If we found a matching trip, use only that one; otherwise fall back to first trip
            if (matchingTrip) {
                data = [matchingTrip];
            } else if (data.length > 0) {
                // Fall back to first trip if no exact match (different trip on same route)
                data = [data[0]];
            }
        } else if (data && data.length > 0) {
            // No tripId provided - use only the first trip to avoid mixed paths
            data = [data[0]];
        }

        const points = data
            ?.map((point) => {
                // Additional safety check for geojson_shape.type
                if (!point.geojson_shape || !point.geojson_shape.type) {
                    console.warn(
                        "Skipping point with missing geojson_shape:",
                        point,
                    );
                    return null;
                }

                return {
                    tripId: point.trip_id,
                    routeNumber: point.route_number,
                    routeName: point.route_name,
                    points:
                        point.geojson_shape.type === "LineString"
                            ? point.geojson_shape.coordinates.map((coord) => [
                                  coord[1],
                                  coord[0],
                              ])
                            : point.geojson_shape.type === "MultiLineString"
                              ? point.geojson_shape.coordinates.flatMap(
                                    (lineString) =>
                                        lineString.map((coord) => [
                                            coord[1],
                                            coord[0],
                                        ]),
                                )
                              : [],
                };
            })
            .filter(Boolean); // Remove any null entries from the map
        return points && points.length > 0 ? points : null;
    } catch (error) {
        console.error("Error fetching LPP route points:", error);
        return null;
    }
};

/**
 * Fetcha LPP routo za določen trip ID (preko proxyja za https://data.lpp.si/api/route/arrivals-on-route)
 * @param {string} tripId - ID tripa
 * @returns Postaje na poti in prihode na posamezne postaje
 */
const fetchLppRoute = async (lppRoute) => {
    if (!lppRoute) return null;
    const cached = getCachedRoute(lppRoute.tripId);
    if (cached) return cached;
    try {
        const raw = await fetchJson(lppRouteLink + lppRoute.tripId);
        const geometry = await fetchLppPoints(
            lppRoute.lineId || lppRoute.routeId,
            lppRoute.tripId,
        );

        const lineNumber = lppRoute.lineNumber || lppRoute.routeName || "";
        const tripName = lppRoute.lineName || lppRoute.tripName || "";

        selectedRoute = {
            isLPP: true,
            isSZ: false,
            tripId: lppRoute.tripId || "",
            tripName: tripName,
            lineNumber: lineNumber,
            operator: "Javno podjetje Ljubljanski potniški promet d.o.o.",
            stops: Array.isArray(raw.data)
                ? raw.data.map((stop) => ({
                      name: stop.name || "",
                      stopId: stop.station_code || "",
                      gpsLocation: [stop.latitude || 0, stop.longitude || 0],
                      arrivals: stop?.arrivals.map((arrival) => ({
                          eta_min: arrival.eta_min,
                      })),
                  }))
                : [],
            geometry: geometry || [],
        };
        setCachedRoute(lppRoute.tripId, selectedRoute);
        return selectedRoute;
    } catch (error) {
        console.error("Error fetching LPP route:", error);
        return null;
    }
};

/**
 * Fetcha pot SZ linije
 * @param {string} tripId - ID poti
 * @returns Podrobnosti o routi vlaka
 */
const fetchSzTrip = async (tripId) => {
    if (!tripId) return null;
    const cached = getCachedRoute(tripId);
    if (cached) return cached;
    try {
        const fetched = await fetchJson(szRouteLink + tripId);
        const raw = fetched?.legs || null;
        const startStop = raw && raw[0] ? raw[0].from : null;
        const endStop = raw && raw[0] ? raw[0].to : null;
        selectedRoute = Array.isArray(raw)
            ? {
                  from: {
                      name: raw[0]?.from?.name || "",
                      stopId: raw[0]?.from?.stopId || "",
                      gpsLocation: [
                          raw[0]?.from?.lat || 0,
                          raw[0]?.from?.lon || 0,
                      ],
                      departure: raw[0]?.from?.departure || "",
                  },
                  to: {
                      name: raw[0]?.to?.name || "",
                      stopId: raw[0]?.to?.stopId || "",
                      gpsLocation: [raw[0]?.to?.lat || 0, raw[0]?.to?.lon || 0],
                      arrival: raw[0]?.to?.arrival || "",
                  },
                  tripName: raw[0]?.headsign || "",
                  duration: raw[0]?.duration || "",
                  startTime: raw[0]?.startTime || "",
                  endTime: raw[0]?.endTime || "",
                  realTime: raw[0]?.realTime || false,
                  tripId: raw[0]?.tripId || "",
                  shortName: raw[0]?.routeShortName || "",
                  stops: [
                      startStop,
                      ...(raw[0]?.intermediateStops?.map((stop) => ({
                          name: stop?.name || "",
                          stopId: stop?.stopId || "",
                          gpsLocation: [stop?.lat || 0, stop?.lon || 0],
                          arrival: stop?.arrival || "",
                          departure: stop?.departure || "",
                      })) || []),
                      endStop,
                  ],
                  geometry: raw[0]?.legGeometry
                      ? decodePolylineToPoints(
                            raw[0]?.legGeometry?.points || "",
                            6,
                        )
                      : [],
                  operator: "Slovenske železnice d.o.o.",
                  isLPP: false,
                  isSZ: true,
              }
            : null;
        setCachedRoute(tripId, selectedRoute);
        return selectedRoute;
    } catch (error) {
        console.error("Error fetching SZ trip:", error);
        return null;
    }
};

/**
 * Fetcha LPP prihode za dano postajo (preko proxyja za https://data.lpp.si/api/station/arrival)
 * @param {string} stationCode - ID postaje
 * @returns Tabelo prihodov
 */
const fetchLppArrivals = async (stationCode) => {
    if (!stationCode) return [];
    try {
        const raw = await fetchJson(lppArrivalsLink + stationCode);
        const list = Array.isArray(raw?.data?.arrivals)
            ? raw.data.arrivals
            : [];
        const arrivals = list
            .map((arrival) => {
                const etaData = computeEtaAndTime({
                    etaMinutes: arrival.eta_min,
                });
                return {
                    etaMinutes: etaData.etaMinutes,
                    arrivalTime: etaData.arrivalTime,
                    routeName: arrival.route_name,
                    tripName: arrival.trip_name,
                    routeId: arrival.route_id,
                    tripId: arrival.trip_id,
                    vehicleId: arrival.vehicle_id,
                    type: arrival.type,
                    depot: arrival.depot,
                };
            })
            .sort((a, b) => (a.etaMinutes ?? 999) - (b.etaMinutes ?? 999));
        return arrivals;
    } catch (error) {
        console.error("Error fetching LPP arrivals:", error);
        return [];
    }
};

/**
 * Fetcha IJPP prihode za dano IJPP postajo
 * @param {string} ijppId - ID IJPP postaje
 * @returns Tabelo prihodov
 */
const fetchIjppArrivals = async (ijppId) => {
    if (!ijppId) return [];
    try {
        const raw = await fetchJson(
            ijppArrivalsLink + ijppId + "?current=true",
        );
        const list = Array.isArray(raw?.arrivals) ? raw.arrivals : [];
        const arrivals = list.map((arrival) => {
            const etaData = computeEtaAndTime({
                etaMinutes: undefined,
                realtimeDeparture: seconds2time(arrival?.departure_realtime),
                scheduledDeparture: seconds2time(arrival?.departure_scheduled),
            });
            return {
                operatorName: arrival?.agency_name,
                tripName: arrival?.trip_headsign,
                passed: arrival?.passed,
                realTime: arrival?.realtime,
                scheduledArrival: seconds2time(arrival?.arrival_scheduled),
                realtimeArrival: seconds2time(arrival?.arrival_realtime),
                arrivalDelay: arrival?.arrival_delay,
                scheduledDeparture: seconds2time(arrival?.departure_scheduled),
                realtimeDeparture: seconds2time(arrival?.departure_realtime),
                departureDelay: arrival?.departure_delay,
                tripId: arrival?.trip_id,
                routeId: arrival?.route_id,
                routeShortName: arrival?.route_short_name,
                etaMinutes: etaData.etaMinutes,
                arrivalTime: etaData.arrivalTime,
            };
        });
        return arrivals;
    } catch (error) {
        console.error("Error fetching IJPP arrivals:", error);
        return [];
    }
};

/**
 * Fetcha naslednjih 100 prihodov za izbrano železniško postajo
 * @returns Tabelo prihodov
 */
const fetchSzArrivals = async (stationCode) => {
    if (!stationCode) return [];
    try {
        const url = szArrivalsLink + `${encodeURIComponent(stationCode)}&n=100`;
        const raw = await fetchJson(url);
        const arrivals = (raw?.stopTimes || []).map((arrival) => ({
            headsign: arrival?.headsign,
            tripId: arrival?.tripId,
            scheduledDeparture: arrival?.place?.scheduledDeparture,
            actualDeparture: arrival?.place?.actualDeparture,
            routeShortName: arrival?.routeShortName,
        }));
        return arrivals;
    } catch (error) {
        console.error("Error fetching SZ arrivals:", error);
        return [];
    }
};

/**
 * Prefetch routes for all arrivals at the selected station in the background.
 * Fetches in small batches to avoid overloading APIs.
 * @param {Array} ijppArrivals - IJPP arrivals
 * @param {Array} lppArrivals - LPP arrivals
 * @param {Array} szArrivals - SZ arrivals
 */
export async function prefetchRoutesForArrivals(
    ijppArrivals,
    lppArrivals,
    szArrivals,
) {
    const tasks = [];

    for (const arrival of lppArrivals || []) {
        if (arrival.tripId && !getCachedRoute(arrival.tripId)) {
            tasks.push({
                type: "LPP",
                tripId: arrival.tripId,
                data: arrival,
            });
        }
    }

    for (const arrival of ijppArrivals || []) {
        if (arrival.tripId && !getCachedRoute(arrival.tripId)) {
            tasks.push({
                type: "IJPP",
                tripId: arrival.tripId,
                data: arrival,
            });
        }
    }

    for (const arrival of szArrivals || []) {
        if (arrival.tripId && !getCachedRoute(arrival.tripId)) {
            tasks.push({
                type: "SZ",
                tripId: arrival.tripId,
                data: arrival,
            });
        }
    }

    if (tasks.length === 0) return;
    console.log(
        `[prefetch] Prefetching ${tasks.length} routes in background...`,
    );

    const BATCH_SIZE = 3;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
        const batch = tasks.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
            batch.map((task) => {
                // Deduplicate in-flight requests
                if (routeInFlight.has(task.tripId)) {
                    return routeInFlight.get(task.tripId);
                }
                let promise;
                if (task.type === "LPP") {
                    promise = fetchLppRoute({
                        tripId: task.data.tripId,
                        lineId: task.data.routeId,
                        lineNumber: task.data.routeName,
                        lineName: task.data.tripName,
                    });
                } else if (task.type === "SZ") {
                    promise = fetchSzTrip(task.tripId);
                } else {
                    promise = fetchIJPPTrip(task.tripId);
                }
                routeInFlight.set(task.tripId, promise);
                promise.finally(() => routeInFlight.delete(task.tripId));
                return promise;
            }),
        );
        // Small delay between batches to be gentle on the APIs
        if (i + BATCH_SIZE < tasks.length) {
            await new Promise((r) => setTimeout(r, 300));
        }
    }
    console.log(`[prefetch] Done prefetching routes.`);
}

export { fetchLPPPositions, fetchIJPPPositions, fetchTrainPositions };
export { fetchLppArrivals, fetchIjppArrivals, fetchLppRoute, fetchIJPPTrip };
export { fetchSzStops, fetchSzTrip, fetchSzArrivals };
export { fetchAllBusStops };
