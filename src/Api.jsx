const now = new Date();
const later = new Date(now.getTime() + 60000); // 1 minute window

const busStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/unified_stops_with_gtfs.json";

const lppLocationsLink =
    "https://mestnipromet.cyou/api/v1/resources/buses/info";
const ijppLocationsLink = "https://tracker.cernetic.cc/api/ijpp-positions";
const szLocationsLink = `https://mapper-motis.ojpp-gateway.derp.si/api/v1/map/trips?min=49.415360776528956%2C7.898969151846785&max=36.38523043114108%2C26.9347879737411&startTime=${encodeURIComponent(
    now.toISOString()
)}&endTime=${encodeURIComponent(later.toISOString())}&zoom=20`;

const ijppArrivalsLink =
    "https://tracker.cernetic.cc/api/ijpp-arrivals?stop-id=";
const lppArrivalsLink =
    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=";
const lppRouteLink = "https://tracker.cernetic.cc/api/lpp-route?trip-id=";
const szRouteLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v2/trip?tripId=";
const szArrivalsLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v1/stoptimes?stopId=";

const szStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/sz_stops.json";

/**
 *  Fetches all bus stops
 *  @returns Array of bus stops
 */
const fetchAllBusStops = async () => {
    try {
        const raw = await fetchJson(busStopsLink);
        const list = Array.isArray(raw) ? raw : [];

        return list
            .map((stop) => {
                const latitude = Number(
                    stop.latitude ?? stop.lat ?? stop["Latitude"]
                );
                const longitude = Number(
                    stop.longitude ?? stop.lon ?? stop["Longitude"]
                );
                const gpsLocation = Array.isArray(stop.gpsLocation)
                    ? stop.gpsLocation
                    : [latitude, longitude];

                if (
                    !Number.isFinite(gpsLocation?.[0]) ||
                    !Number.isFinite(gpsLocation?.[1])
                ) {
                    return null;
                }

                const refId = stop.ref_id ?? stop.refID ?? stop.refId ?? null;
                const ijppId =
                    stop.ijpp_id ?? stop.ijppID ?? stop.ijppId ?? null;

                return {
                    ...stop,
                    name: stop.name ?? stop.stop_name ?? "",
                    gpsLocation: gpsLocation,
                    coordinates: gpsLocation,
                    ref_id: refId,
                    refID: refId,
                    ijpp_id: ijppId,
                    ijppID: ijppId,
                };
            })
            .filter(Boolean);
    } catch (error) {
        console.error("Error fetching bus stops:", error);
        return [];
    }
};

/**
 * Fetches JSON data from a given URL
 * @param {*} url - Link
 * @returns JSON data
 */
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

/**
 * Fetches LPP bus positions
 * @returns Array of LPP bus positions
 */
const fetchLPPPositions = async () => {
    try {
        const data = await fetchJson(lppLocationsLink);

        const lppPositions = data.data.map((bus) => ({
            gpsLocation: [bus.latitude, bus.longitude],
            operator: "Javno podjetje Ljubljanski potniški promet d.o.o.",
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
 * Fetches IJPP vehicle positions
 * @returns Array of IJPP vehicle positions
 */
const fetchIJPPPositions = async () => {
    try {
        const data = await fetchJson(ijppLocationsLink);
        const ijppPositions = Array.isArray(data)
            ? data.map((vehicle) => ({
                  gpsLocation: [
                      parseFloat(vehicle?.VehicleLocation?.Latitude) || 0,
                      parseFloat(vehicle?.VehicleLocation?.Longitude) || 0,
                  ],
                  operator:
                      vehicle?.OperatorData?.agency_name ||
                      vehicle?.OperatorRef ||
                      "",
                  lineName:
                      vehicle?.PublishedLineName || vehicle?.LineRef || "",
                  journeyPatternId:
                      vehicle?.JourneyPatternRef ||
                      vehicle?.JourneyPatternName ||
                      null,
                  tripId:
                      vehicle?.LineData?.tripId ||
                      vehicle?.LineData?.trip?.trip_id ||
                      null,
                  routeId:
                      vehicle?.LineData?.trip?.route_id ||
                      vehicle?.LineData?.trip?.routeId ||
                      null,
                  stops: vehicle?.LineData?.stops || [],
              }))
            : [];

        return ijppPositions;
    } catch (error) {
        console.error("Error fetching ijpp positions:", error);
    }
};

/**
 * Fetches SZ train positions
 * @returns Array of SZ train positions
 */
const fetchTrainPositions = async () => {
    try {
        const data = await fetchJson(szLocationsLink);
        const filteredData = data.filter(
            (train) => train.routeColor == "29ace2"
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
 * Helper function to decode a polyline string into coordinates
 * @param {string} str - Encoded polyline string
 * @returns {Array} Array of [longitude, latitude] coordinates
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

/**
 * Fetches LPP arrivals for a given station code
 * @param {string} stationCode - Station code
 * @returns Array of arrivals
 */
const fetchLppArrivals = async (stationCode) => {
    if (!stationCode) return [];
    try {
        const raw = await fetchJson(lppArrivalsLink + stationCode);
        const list = Array.isArray(raw?.data?.arrivals)
            ? raw.data.arrivals
            : [];
        const arrivals = list
            .map((arrival) => ({
                etaMinutes: arrival.eta_min,
                routeName: arrival.route_name,
                tripName: arrival.trip_name,
                routeId: arrival.route_id,
                tripId: arrival.trip_id,
                vehicleId: arrival.vehicle_id,
                type: arrival.type,
                depot: arrival.depot,
                from: arrival.stations?.departure,
                to: arrival.stations?.arrival,
            }))
            .sort((a, b) => a.etaMinutes - b.etaMinutes);
            console.log(arrivals);
        return arrivals;
    } catch (error) {
        console.error("Error fetching LPP arrivals:", error);
        return [];
    }
};

/**
 * Fetches IJPP arrivals for a given IJPP stop ID
 * @param {string} ijppId - IJPP stop ID
 * @returns Array of arrivals
 */
const fetchIjppArrivals = async (ijppId) => {
    if (!ijppId) return [];
    try {
        const raw = await fetchJson(ijppArrivalsLink + ijppId);
        const list = Array.isArray(raw?.routes) ? raw.routes : [];
        const arrivals = list
            .map((arrival) => ({
                name:
                    (arrival?.trips?.first_stop ?? "") +
                    " - " +
                    (arrival?.trips?.last_stop ?? ""),
                arrivalTime: arrival?.trips?.stop_times?.arrival_time ?? null,
            }))
            // some IJPP responses may not have etaMinutes; keep stable order
            .sort((a, b) => {
                const A = Number(a.arrivalTime) || 0;
                const B = Number(b.arrivalTime) || 0;
                return A - B;
            });
        return arrivals;
    } catch (error) {
        console.error("Error fetching IJPP arrivals:", error);
        return [];
    }
};

/**
 * Fetches LPP route details for a given trip ID
 * @param {string} tripId - Trip ID
 * @returns Route details
 */
const fetchLppRoute = async (tripId) => {
    if (!tripId) return null;
    try {
        const raw = await fetchJson(lppRouteLink + tripId);
        return raw?.data ?? null;
    } catch (error) {
        console.error("Error fetching LPP route:", error);
        return null;
    }
};

/**
 * Fetches SZ trip details for a given trip ID
 * @param {string} tripId - Trip ID
 * @returns Trip details
 */
const fetchSzTrip = async (tripId) => {
    if (!tripId) return null;
    try {
        const fetched = await fetchJson(szRouteLink + tripId);
        const raw = fetched?.legs || null;
        const data = Array.isArray(raw)
            ? [
                  {
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
                          gpsLocation: [
                              raw[0]?.to?.lat || 0,
                              raw[0]?.to?.lon || 0,
                          ],
                          arrival: raw[0]?.to?.arrival || "",
                      },

                      tripName: raw[0]?.headsign || "",
                      duration: raw[0]?.duration || "",
                      startTime: raw[0]?.startTime || "",
                      endTime: raw[0]?.endTime || "",
                      realTime: raw[0]?.realTime || false,
                      tripId: raw[0]?.tripId || "",
                      shortName: raw[0]?.routeShortName || "",
                      stops: raw[0]?.intermediateStops.map((stop) => ({
                          name: stop?.name || "",
                          stopId: stop?.stopId || "",
                          gpsLocation: [stop?.lat || 0, stop?.lon || 0],
                          arrival: stop?.arrival || "",
                          departure: stop?.departure || "",
                      })),
                  },
              ]
            : null;
        return data;
    } catch (error) {
        console.error("Error fetching SZ trip:", error);
        return null;
    }
};

/**
 * Fetches stops for sz trains
 * @returns Array of stops
 */
const fetchSzStops = async () => {
    try {
        const raw = await fetchJson(szStopsLink);
        return raw;
    } catch (error) {
        console.error("Error fetching SZ stops:", error);
        return [];
    }
};

/**
 * Fetches next 100 SZ trips for a selected train station
 * @returns Array of trips
 */
const fetchSzArrivals = async (stationCode) => {
    if (!stationCode) return [];
    try {
        const url = szArrivalsLink + `${encodeURIComponent(stationCode)}&n=100`;
        const raw = await fetchJson(url);
        return raw;
    } catch (error) {
        console.error("Error fetching SZ arrivals:", error);
        return [];
    }
};

export { fetchLPPPositions, fetchIJPPPositions, fetchTrainPositions };
export { fetchLppArrivals, fetchIjppArrivals, fetchLppRoute };
export { fetchSzStops, fetchSzTrip, fetchSzArrivals };
export { fetchAllBusStops };
