const now = new Date();
const later = new Date(now.getTime() + 60000); // 1 minute window

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

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

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

export { fetchLPPPositions, fetchIJPPPositions, fetchTrainPositions };
export { fetchLppArrivals, fetchIjppArrivals, fetchLppRoute };
