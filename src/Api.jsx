import { de } from "date-fns/locale";

const now = new Date();
const later = new Date(now.getTime() + 60000); // 1 minuta

const busStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/unified_stops_with_gtfs.json";

const lppLocationsLink =
    "https://mestnipromet.cyou/api/v1/resources/buses/info";
const ijppLocationsLink = "https://api.beta.brezavta.si/vehicles/locations";
const szLocationsLink = `https://mapper-motis.ojpp-gateway.derp.si/api/v1/map/trips?min=49.415360776528956%2C7.898969151846785&max=36.38523043114108%2C26.9347879737411&startTime=${encodeURIComponent(
    now.toISOString()
)}&endTime=${encodeURIComponent(later.toISOString())}&zoom=20`;

const ijppArrivalsLink = "https://api.beta.brezavta.si/stops/";
const lppArrivalsLink =
    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=";
const lppRouteLink = "https://tracker.cernetic.cc/api/lpp-route?trip-id=";
const ijppRouteLink = "https://api.beta.brezavta.si/trips/";
const szRouteLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v2/trip?tripId=";
const szArrivalsLink =
    "https://mapper-motis.ojpp-gateway.derp.si/api/v1/stoptimes?stopId=";

const szStopsLink =
    "https://raw.githubusercontent.com/jakecernet/ijpp-json/refs/heads/main/sz_stops.json";

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

/**
 *  Fetcha vse bus postaje
 *  @returns Tabelo vseh bus postaj
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
 * Fetcha LPP bus pozicije
 * @returns Tabela z LPP pozicijami
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
                          "Ljubljanski Potniški Promet"
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

/**
 *  Fetcha IJPP trip
 * @param {string} tripId - ID tripa
 * @returns Podrobnosti o tripu
 */
const fetchIJPPTrip = async (tripId) => {
    if (!tripId) return null;
    try {
        const dateString = new Date().toISOString().split("T")[0];
        const raw = await fetchJson(
            ijppRouteLink + tripId + `?date=${dateString}`
        );
        const pointsResponse = await fetchJson(ijppRouteLink + tripId + "/geometry");
        const trip = {
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
        };
        return trip;
    } catch (error) {
        console.error("Error fetching IJPP trip:", error);
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
        return arrivals;
    } catch (error) {
        console.error("Error fetching LPP arrivals:", error);
        return [];
    }
};

/** Pretvori sekunde od polnoči v časovni format HH:MM:SS
 * @param {number} seconds - Sekunde od polnoči
 * @returns Čas v formatu HH:MM:SS
 */
function seconds2time(seconds) {
    let hour = `${Math.floor(seconds / 3600)}`.padStart(2, "0");
    let minute = `${Math.floor((seconds % 3600) / 60)}`.padStart(2, "0");
    let second = `${seconds % 60}`.padStart(2, "0");
    return `${hour}:${minute}:${second}`;
}

/**
 * Fetcha IJPP prihode za dano IJPP postajo (trenutno ne dela)
 * @param {string} ijppId - ID IJPP postaje
 * @returns Tabelo prihodov
 */
const fetchIjppArrivals = async (ijppId) => {
    if (!ijppId) return [];
    try {
        const raw = await fetchJson(
            ijppArrivalsLink + ijppId + "?current=true"
        );
        const list = Array.isArray(raw?.arrivals) ? raw.arrivals : [];
        console.log(list);
        const arrivals = list.map((arrival) => {
            const computeRelative = (rt) => {
                if (rt == null) return null;
                // if rt looks like epoch seconds (greater than seconds in a day), treat as epoch seconds
                if (typeof rt === "number" && rt > 86400) {
                    return Math.round((rt * 1000 - Date.now()) / 1000);
                }
                // otherwise treat rt as seconds-since-midnight
                const seconds = Number(rt);
                if (!Number.isFinite(seconds)) return null;
                const hh = Math.floor(seconds / 3600);
                const mm = Math.floor((seconds % 3600) / 60);
                const ss = Math.floor(seconds % 60);
                const now = new Date();
                const arrivalDate = new Date(now);
                arrivalDate.setHours(hh, mm, ss, 0);
                let diffSec = Math.round((arrivalDate - now) / 1000);
                return diffSec;
            };

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
                relativeArrival: (
                    computeRelative(arrival.arrival_realtime) / 60
                ).toFixed(0),
                relativeDeparture: (
                    computeRelative(arrival.departure_realtime) / 60
                ).toFixed(0),
            };
        });
        console.log("Fetched IJPP arrivals:", arrivals);
        return arrivals;
    } catch (error) {
        console.error("Error fetching IJPP arrivals:", error);
        return [];
    }
};

/**
 * Fetcha LPP routo za določen trip ID (preko proxyja za https://data.lpp.si/api/route/arrivals-on-route)
 * @param {string} tripId - ID tripa
 * @returns Postaje na poti in prihode na posamezne postaje
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
 * Fetcha pot SZ linije
 * @param {string} tripId - ID poti
 * @returns Podrobnosti o routi vlaka
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
 * Fetcha postaje vlakov
 * @returns Tabelo s postajami
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
 * Fetcha naslednjih 100 prihodov za izbrano železniško postajo
 * @returns Tabelo prihodov
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
export { fetchLppArrivals, fetchIjppArrivals, fetchLppRoute, fetchIJPPTrip };
export { fetchSzStops, fetchSzTrip, fetchSzArrivals };
export { fetchAllBusStops };
