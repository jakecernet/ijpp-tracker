import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings, X } from "lucide-react";
import "./App.css";

import ijppStopsSource from "./ijpp_stops.json";
import lppStopsSource from "./lpp_stops.json";
import { use } from "react";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const SettingsTab = lazy(() => import("./tabs/settings"));

const ijppArrivalsLink = "https://ijpp.nikigre.si/getTripsByStop?stopID=";
const lppArrivalsLink =
    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=";

const lppLocationsLink =
    "https://mestnipromet.cyou/api/v1/resources/buses/info";
const ijppLocationsLink = "https://tracker.cernetic.cc/api/ijpp-positions";

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

function App() {
    const [currentUrl, setCurrentUrl] = useState(window.location.hash.slice(1));
    const [activeStation, setActiveStation] = useState(
        localStorage.getItem("activeStation")
            ? JSON.parse(localStorage.getItem("activeStation"))
            : { name: "Vrhnika", coordinates: [46.057, 14.295], id: 123456789 }
    );
    const [userLocation, setUserLocation] = useState(
        localStorage.getItem("userLocation")
            ? JSON.parse(localStorage.getItem("userLocation"))
            : [46.056, 14.5058]
    );
    const [activeOperators, setActiveOperators] = useState(
        localStorage.getItem("activeOperators")
            ? JSON.parse(localStorage.getItem("activeOperators"))
            : ["lpp", "arriva", "nomago", "murska"]
    );
    const [radius, setRadius] = useState(localStorage.getItem("radius") || 20);
    const [busRadius, setBusRadius] = useState(
        localStorage.getItem("busRadius") || 20
    );

    const [gpsPositions, setGpsPositions] = useState([]);
    const [trainPositions, setTrainPositions] = useState([]);

    const [ijppStops] = useState(
        Array.isArray(ijppStopsSource)
            ? ijppStopsSource.map((s) => ({
                  id: s.int_id,
                  ref_id: s.ref_id,
                  name: s.name,
                  gpsLocation: [s.latitude, s.longitude],
                  busLines: s.route_groups_on_station,
              }))
            : []
    );
    const [lppBusStops] = useState(
        Array.isArray(lppStopsSource)
            ? lppStopsSource.map((s) => ({
                  id: s.stop_id,
                  name: s.name,
                  gpsLocation: [s.latitude, s.longitude],
              }))
            : []
    );
    const [busStops, setBusStops] = useState([]);
    const [szStops, setSzStops] = useState([]);

    const [ijppArrivals, setIjppArrivals] = useState([]);
    const [lppArrivals, setLppArrivals] = useState([]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (!isSettingsOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") setIsSettingsOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isSettingsOpen]);

    useEffect(() => {
        if (!activeStation || activeStation.length === 0) {
            document.location.href = "/#/map";
            setCurrentUrl("/map");
        }
    }, [activeStation]);

    useEffect(() => {
        const fetchLPPPositions = async () => {
            try {
                const data = await fetchJson(lppLocationsLink)

                const lppPositions = data.data
                    .filter(() => activeOperators.includes("lpp"))
                    .map((bus) => ({
                        gpsLocation: [bus.latitude, bus.longitude],
                        operator:
                            "Javno podjetje Ljubljanski potniški promet d.o.o.",
                        lineNumber: bus.line_number,
                        lineId: bus.line_id,
                        lineName: bus.line_name,
                        lineDestination: bus.line_destination,
                        speed: bus.speed,
                        busName: bus.bus_name,
                        ignition: bus.ignition,
                    }));

                setGpsPositions(lppPositions);
            } catch (error) {
                console.error("Error fetching lpp positions:", error);
            }
        };

        fetchLPPPositions();
        const intervalId = setInterval(fetchLPPPositions, 30000);
        return () => clearInterval(intervalId);
    }, [activeOperators]);

    useEffect(() => {
        const fetchIJPPPositions = async () => {
            try {
                const data = await fetchJson(ijppLocationsLink);
                const ijppPositions = data
                    .filter((vehicle) =>
                        activeOperators.includes(
                            vehicle.OperatorData.agency_name.toLowerCase()
                        )
                    )
                    .map((vehicle) => ({
                        gpsLocation: [
                            vehicle.VehicleLocations.Latitude,
                            vehicle.VehicleLocation.Longitude,
                        ],
                        operator: vehicle.OperatorData.agency_name,
                        lineName: vehicle.PublishedLineName,
                        journeyPatternId: vehicle.JourneyPatternRef,
                        tripId: vehicle.LineData.tripId,
                        routeId: vehicle.LineData.trip.route_id,
                        stops: vehicle.LineData.stops
                        }));

                setGpsPositions((prevPositions) => [
                    ...prevPositions,
                    ...ijppPositions,
                ]);
                console.log("IJPP positions fetched:", ijppPositions);
            } catch (error) {
                console.error("Error fetching ijpp positions:", error);
            }
        };
        fetchIJPPPositions();
        const intervalId = setInterval(fetchIJPPPositions, 30000);
        return () => clearInterval(intervalId);
    }, [activeOperators]);

    const computeDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    useEffect(() => {
        const fetchszStops = async () => {
            try {
                const data = await fetchJson(
                    "https://tracker.cernetic.cc/api/sz-stops"
                );
                setSzStops(data);
                console.log("Train stops fetched:", data);
            } catch (error) {
                console.error("Error fetching train stops:", error);
            }
        };

        fetchszStops();
    }, []);

    useEffect(() => {
        const fetchAndJoinBusStops = async () => {
            try {
                const normalizeName = (n) =>
                    (n || "").toString().trim().toLowerCase();

                const COORD_THRESHOLD_KM = 0.3;

                const ojpp = stopLocations.features.map((feature) => ({
                    name: feature.properties.name,
                    gpsLocation: feature.geometry.coordinates.slice().reverse(),
                    id: feature.properties.id,
                }));

                const lppNormalized = lppBusStops;

                const ojppRemaining = [];
                const lppEnriched = lppNormalized.map((s) => ({ ...s }));

                for (const stop of ojpp) {
                    const [ojppLat, ojppLon] = stop.gpsLocation;
                    const ojppNameNorm = normalizeName(stop.name);

                    const idx = lppEnriched.findIndex((s) => {
                        const lppNameNorm = normalizeName(s.name);
                        if (!lppNameNorm || lppNameNorm !== ojppNameNorm)
                            return false;
                        const [lppLat, lppLon] = s.gpsLocation;
                        const d = computeDistance(
                            ojppLat,
                            ojppLon,
                            lppLat,
                            lppLon
                        );
                        return d <= COORD_THRESHOLD_KM;
                    });

                    if (idx >= 0) {
                        lppEnriched[idx].ojppId = stop.id;
                    } else {
                        ojppRemaining.push(stop);
                    }
                }

                const combined = [
                    ...lppEnriched,
                    ...ojppRemaining.map((s) => ({ ...s, ref_id: null })),
                ];

                const filtered = combined.filter((stop) => {
                    const [lat, lon] = stop.gpsLocation;
                    return (
                        computeDistance(
                            userLocation[0],
                            userLocation[1],
                            lat,
                            lon
                        ) <= +radius
                    );
                });

                setBusStops(filtered);
            } catch (err) {
                console.error("Error fetching/joining bus stops:", err);
            }
        };

        fetchAndJoinBusStops();
    }, [radius, userLocation, lppBusStops]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation([latitude, longitude]);
                },
                (error) => {
                    console.error("Error getting user's location:", error);
                }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
        }
    }, []);

    useEffect(() => {
        const fetchLppArrivals = async () => {
            const lppCode = activeStation?.ref_id;

            try {
                if (!activeOperators.includes("lpp")) {
                    setLppArrivals([]);
                    return;
                }

                const raw = await fetchJson(
                    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=" +
                        lppCode
                );

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

                setLppArrivals(arrivals);
                console.log("LPP arrivals fetched:", raw);
            } catch (error) {
                console.error("Error fetching LPP arrivals:", error);
            }
        };
        fetchLppArrivals();
    }, [activeStation, activeOperators]);

    useEffect(() => {
        const fetchijppArrivals = async () => {
            try {
                const data = await fetchJson(
                    `https://ojpp.si/api/stop_locations/${activeStation.id}/arrivals`
                );

                const arrivals = data
                    .filter(
                        (arrival) =>
                            arrival?.operator?.name !==
                            "Javno podjetje Ljubljanski potniški promet d.o.o."
                    )
                    .map((arrival) => ({
                        tripId: arrival.trip_id,
                        routeId: arrival.route_id,
                        routeName: arrival.route_name,
                        timeArrival: arrival.time_arrival,
                        timeDeparture: arrival.time_departure,
                        operator: arrival.operator.name,
                    }));

                setIjppArrivals(arrivals);
            } catch (error) {
                console.error("Error fetching bus stop arrivals:", error);
            }
        };

        if (activeStation && activeStation.id) {
            fetchijppArrivals();
        }
    }, [activeStation]);

    useEffect(() => {
        const fetchTrainPositions = async () => {
            try {
                const data = await fetchJson(
                    "https://api.modra.ninja/sz/lokacije_raw"
                );
                setTrainPositions(data);
                console.log("Train positions fetched:", data);
            } catch (error) {
                console.error("Error fetching train positions:", error);
            }
        };

        fetchTrainPositions();
    }, []);

    return (
        <Router>
            <div className="mobile-container">
                <div className="content">
                    <Suspense fallback={<div>Loading...</div>}>
                        <Routes>
                            <Route
                                path="/*"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        szStops={szStops}
                                        lppBusStops={lppBusStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        setCurentUrl={setCurrentUrl}
                                        trainPositions={trainPositions}
                                    />
                                }
                            />
                            <Route
                                path="/map"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        lppBusStops={lppBusStops}
                                        szStops={szStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        setCurentUrl={setCurrentUrl}
                                        trainPositions={trainPositions}
                                    />
                                }
                            />
                            <Route
                                path="/arrivals"
                                element={
                                    <ArrivalsTab
                                        activeStation={activeStation}
                                        stopArrivals={ijppArrivals}
                                        lppArrivals={lppArrivals}
                                    />
                                }
                            />
                            <Route
                                path="/stations"
                                element={
                                    <NearMeTab
                                        setActiveStation={setActiveStation}
                                        busStops={busStops}
                                        userLocation={userLocation}
                                        setCurentUrl={setCurrentUrl}
                                    />
                                }
                            />
                            <Route
                                path="/settings"
                                element={
                                    <SettingsTab
                                        setActiveOperators={setActiveOperators}
                                        activeOperators={activeOperators}
                                        radius={radius}
                                        setRadius={setRadius}
                                        busRadius={busRadius}
                                        setBusRadius={setBusRadius}
                                    />
                                }
                            />
                        </Routes>
                    </Suspense>
                </div>
                <nav className="bottom-nav">
                    <NavLink to="/map">
                        <button
                            onClick={() => setCurrentUrl("/map")}
                            className={
                                currentUrl === "/map" || currentUrl === "/"
                                    ? "active"
                                    : ""
                            }
                        >
                            <Map size={24} />
                            <span>Zemljevid</span>
                        </button>
                    </NavLink>
                    <NavLink to="/arrivals">
                        <button
                            onClick={() => setCurrentUrl("/arrivals")}
                            className={
                                currentUrl === "/arrivals" ? "active" : ""
                            }
                        >
                            <Clock size={24} />
                            <span>Prihodi</span>
                        </button>
                    </NavLink>
                    <NavLink to="/stations">
                        <button
                            onClick={() => setCurrentUrl("/stations")}
                            className={
                                currentUrl === "/stations" ? "active" : ""
                            }
                        >
                            <MapPin size={24} />
                            <span>V bližini</span>
                        </button>
                    </NavLink>
                </nav>
                <button
                    className="fab"
                    aria-label="Nastavitve"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <Settings size={50} />
                </button>
                {isSettingsOpen && (
                    <div
                        className="modal-overlay"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => {
                            if (e.currentTarget === e.target)
                                setIsSettingsOpen(false);
                        }}
                    >
                        <div className="modal">
                            <div className="modal-header">
                                <h3>Nastavitve</h3>
                                <button
                                    className="icon-button"
                                    onClick={() => setIsSettingsOpen(false)}
                                    aria-label="Zapri"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <Suspense fallback={<div>Loading…</div>}>
                                <SettingsTab
                                    setActiveOperators={setActiveOperators}
                                    activeOperators={activeOperators}
                                    radius={radius}
                                    setRadius={setRadius}
                                    busRadius={busRadius}
                                    setBusRadius={setBusRadius}
                                    onClose={() => setIsSettingsOpen(false)}
                                />
                            </Suspense>
                        </div>
                    </div>
                )}
            </div>
        </Router>
    );
}

export default App;
