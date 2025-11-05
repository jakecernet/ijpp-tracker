import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings, X } from "lucide-react";
import "./App.css";
import { set } from "lodash";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const SettingsTab = lazy(() => import("./tabs/settings"));

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

function App() {
    const [activeStation, setActiveStation] = useState(
        localStorage.getItem("activeStation")
            ? JSON.parse(localStorage.getItem("activeStation"))
            : ["Vrhnika", [46.057, 14.295], 123456789]
    );
    const [gpsPositions, setGpsPositions] = useState([]);
    const [busStops, setBusStops] = useState([]);
    const [lppBusStops, setLppBusStops] = useState([]);
    const [trainStops, setTrainStops] = useState([]);
    const [trainPositions, setTrainPositions] = useState([]);
    const [currentUrl, setCurrentUrl] = useState(window.location.hash.slice(1));
    const [userLocation, setUserLocation] = useState(
        localStorage.getItem("userLocation")
            ? JSON.parse(localStorage.getItem("userLocation"))
            : [46.056, 14.5058]
    );
    const [busStopArrivals, setBusStopArrivals] = useState([]);
    const [lppArrivals, setLppArrivals] = useState([]);
    const [activeOperators, setActiveOperators] = useState(
        localStorage.getItem("activeOperators")
            ? JSON.parse(localStorage.getItem("activeOperators"))
            : ["lpp", "arriva", "nomago", "murska"]
    );
    const [radius, setRadius] = useState(localStorage.getItem("radius") || 20);
    const [busRadius, setBusRadius] = useState(
        localStorage.getItem("busRadius") || 20
    );
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (!isSettingsOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") setIsSettingsOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isSettingsOpen]);

    function activeOperatorsNormal(activeOperators) {
        return activeOperators.map((operator) => {
            switch (operator) {
                case "lpp":
                    return "Javno podjetje Ljubljanski potniški promet d.o.o.";
                case "arriva":
                    return "Arriva d.o.o.";
                case "nomago":
                    return "Nomago d.o.o.";
                case "murska":
                    return "Avtobusni promet Murska Sobota d.d.";
                default:
                    return "Javno podjetje Ljubljanski potniški promet d.o.o.";
            }
        });
    }

    function calculateDistance(userLoc, targetLoc) {
        const R = 6371;
        const dLat = ((targetLoc[0] - userLoc[0]) * Math.PI) / 180;
        const dLon = ((targetLoc[1] - userLoc[1]) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((userLoc[0] * Math.PI) / 180) *
                Math.cos((targetLoc[0] * Math.PI) / 180) *
                Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    useEffect(() => {
        if (!activeStation || activeStation.length === 0) {
            document.location.href = "/#/stations";
            setCurrentUrl("/stations");
        }
    }, [activeStation]);

    useEffect(() => {
        const fetchVehiclePositions = async () => {
            try {
                const [vehicleData, lppData] = await Promise.all([
                    fetchJson("https://ojpp.si/api/vehicle_locations"),
                    fetchJson(
                        "https://mestnipromet.cyou/api/v1/resources/buses/info"
                    ),
                ]);
                const allowedOperators = activeOperatorsNormal(activeOperators);

                const filteredGps = vehicleData.features
                    .filter((feature) => {
                        const operator = feature.properties.operator_name;
                        return (
                            allowedOperators.includes(operator) &&
                            operator !==
                                "Javno podjetje Ljubljanski potniški promet d.o.o."
                        );
                    })
                    .filter((feature) => {
                        const [lon, lat] = feature.geometry.coordinates;
                        return (
                            calculateDistance(userLocation, [lat, lon]) <=
                            busRadius
                        );
                    })
                    .map((feature) => ({
                        gpsLocation: feature.geometry.coordinates.reverse(),
                        operator: feature.properties.operator_name,
                        route:
                            feature.properties.route_name || "Neznana linija",
                    }));

                const lppPositions = lppData.data
                    .filter(() => activeOperators.includes("lpp"))
                    .filter(
                        (bus) =>
                            calculateDistance(userLocation, [
                                bus.latitude,
                                bus.longitude,
                            ]) <= busRadius
                    )
                    .map((bus) => ({
                        gpsLocation: [bus.latitude, bus.longitude],
                        operator:
                            "Javno podjetje Ljubljanski potniški promet d.o.o.",
                        route: `${bus.line_number} - ${
                            bus.line_destination ||
                            bus.line_name.split("-").pop()
                        }`,
                        lineId: bus.line_id,
                        speed: bus.speed,
                        lineNumber: bus.line_number,
                        lineName: bus.line_name,
                        lineDestination: bus.line_destination,
                        busName: bus.bus_name,
                        ignition: bus.ignition,
                        direction: bus.direction,
                    }));

                setGpsPositions([...filteredGps, ...lppPositions]);
            } catch (error) {
                console.error("Error fetching vehicle positions:", error);
            }
        };

        fetchVehiclePositions();
        const intervalId = setInterval(fetchVehiclePositions, 30000);
        return () => clearInterval(intervalId);
    }, [userLocation, busRadius, activeOperators]);

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
        const fetchLppBusStops = async () => {
            try {
                const response = await fetch(
                    "https://tracker.cernetic.cc/api/lpp-stops?latitude=46.043904&longitude=14.503119&radius=300000"
                );
                const data = await response.json();
                setLppBusStops(data);
                console.log("LPP bus stops fetched:", data);
            } catch (error) {
                console.error("Error fetching LPP bus stops:", error);
            }
        };
        fetchLppBusStops();
    }, []);

    useEffect(() => {
        const fetchTrainStops = async () => {
            try {
                const data = await fetchJson(
                    "https://tracker.cernetic.cc/api/sz-stops"
                );
                setTrainStops(data);
                console.log("Train stops fetched:", data);
            } catch (error) {
                console.error("Error fetching train stops:", error);
            }
        };

        fetchTrainStops();
    }, []);

   /*  useEffect(() => {
        const fetchBusStops = async () => {
            try {
                const normalizeName = (n) =>
                    (n || "").toString().trim().toLowerCase();
                const getLppName = (s) =>
                    s?.name ??
                    s?.title ??
                    s?.stationName ??
                    s?.display_name ??
                    s?.stop_name ??
                    "";
                const getLppCoords = (s) => {
                    if (
                        Array.isArray(s?.gpsLocation) &&
                        s.gpsLocation.length === 2
                    )
                        return s.gpsLocation;
                    if (s?.latitude != null && s?.longitude != null)
                        return [s.latitude, s.longitude];
                    if (s?.lat != null && s?.lon != null) return [s.lat, s.lon];
                    if (
                        s?.location &&
                        s.location.latitude != null &&
                        s.location.longitude != null
                    )
                        return [s.location.latitude, s.location.longitude];
                    return null;
                };
                const COORD_THRESHOLD_KM = 0.3; // ~300m

                // Load raw OJPP stops (cached separately from deduped busStops)
                let stops = JSON.parse(localStorage.getItem("ojppStops"));
                if (!stops) {
                    const data = await fetchJson(
                        "https://ojpp.si/api/stop_locations"
                    );
                    stops = data.features.map((feature) => ({
                        name: feature.properties.name,
                        gpsLocation: feature.geometry.coordinates.reverse(),
                        id: feature.properties.id,
                    }));
                    localStorage.setItem("ojppStops", JSON.stringify(stops));
                }

                // Prepare LPP array copy for safe mutation
                const lppsArray = Array.isArray(lppBusStops)
                    ? lppBusStops.map((s) => ({ ...s }))
                    : [];

                // Build deduped OJPP list and enrich LPP with ojpp-id
                const ojppOnly = [];
                let lppModified = false;

                for (const stop of stops) {
                    const [ojppLat, ojppLon] = stop.gpsLocation;
                    const ojppNameNorm = normalizeName(stop.name);

                    // Find LPP match by same name and nearby coordinates
                    const idx = lppsArray.findIndex((s) => {
                        const lppNameNorm = normalizeName(getLppName(s));
                        if (!lppNameNorm || lppNameNorm !== ojppNameNorm)
                            return false;
                        const coords = getLppCoords(s);
                        if (!coords) return false;
                        const [lppLat, lppLon] = coords;
                        const d = computeDistance(
                            ojppLat,
                            ojppLon,
                            lppLat,
                            lppLon
                        );
                        return d <= COORD_THRESHOLD_KM;
                    });

                    if (idx >= 0) {
                        // Attach OJPP id to the matched LPP station if not present
                        if (!("ojpp-id" in lppsArray[idx])) {
                            lppsArray[idx]["ojpp-id"] = stop.id;
                            lppModified = true;
                        }
                        // Do not include this OJPP stop in busStops
                    } else {
                        ojppOnly.push(stop);
                    }
                }

                // Update LPP stations only if we enriched any item
                if (lppModified) {
                    setLppBusStops(lppsArray);
                }

                // Radius filter for display
                const filteredStops = ojppOnly.filter((stop) => {
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
                setBusStops(filteredStops);
            } catch (err) {
                console.error("Error fetching bus stops:", err);
            }
        };

        fetchBusStops();
    }, [radius, userLocation, lppBusStops]); */

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
                const raw = await fetchJson(
                    "https://tracker.cernetic.cc/api/lpp-arrivals?station-code=" + lppCode
                );

                const arrivals = raw.arrivals
                    .filter((arrival) =>
                        activeOperatorsNormal(activeOperators).includes(
                            arrival?.operator?.name
                        )
                    )
                    .map((arrival) => ({
                        etaMinutes: arrival.eta_min,
                        routeName: arrival.route_name,
                        tripName: arrival.trip_name,
                    }));

                setLppArrivals(arrivals);
                console.log("LPP arrivals fetched:", arrivals);
            } catch (error) {
                console.error("Error fetching LPP arrivals:", error);
            }
        };
        fetchLppArrivals();
    }, [activeStation]);

    useEffect(() => {
        const fetchBusStopArrivals = async () => {
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

                setBusStopArrivals(arrivals);
            } catch (error) {
                console.error("Error fetching bus stop arrivals:", error);
            }
        };

        if (activeStation && activeStation.id) {
            fetchBusStopArrivals();
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
                                        trainStops={trainStops}
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
                                        trainStops={trainStops}
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
                                        stopArrivals={busStopArrivals}
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
