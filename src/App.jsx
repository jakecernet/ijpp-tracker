import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings, X, ArrowRightLeft } from "lucide-react";
import "./App.css";

import busStopsSource from "./unified_stops.json";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const SettingsTab = lazy(() => import("./tabs/settings"));
const BusRouteTab = lazy(() => import("./tabs/busRoute"));

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
    const [selectedVehicle, setSelectedVehicle] = useState(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = window.localStorage.getItem("selectedBusRoute");
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn("Neveljavni podatki o izbranem vozilu:", error);
            return null;
        }
    });

    const [busStops] = useState(
        Array.isArray(busStopsSource)
            ? busStopsSource.map((s) => ({
                  name: s.name,
                  refID: s.ref_id ? s.ref_id : null,
                  ijppID: s.ijpp_id ? s.ijpp_id : null,
                  gpsLocation: [s.latitude, s.longitude],
                  busLines: s.route_groups_on_station
                      ? s.route_groups_on_station
                      : [],
              }))
            : []
    );
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

    // Fetch GPS positions for LPP buses
    useEffect(() => {
        const fetchLPPPositions = async () => {
            try {
                const data = await fetchJson(lppLocationsLink);

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

    // Fetch GPS positions for other buses (Arriva, Nomago...)
    useEffect(() => {
        const fetchIJPPPositions = async () => {
            try {
                const data = await fetchJson(ijppLocationsLink);
                const ijppPositions = Array.isArray(data)
                    ? data.map((vehicle) => ({
                          gpsLocation: [
                              parseFloat(vehicle?.VehicleLocation?.Latitude) ||
                                  0,
                              parseFloat(vehicle?.VehicleLocation?.Longitude) ||
                                  0,
                          ],
                          operator:
                              vehicle?.OperatorData?.agency_name ||
                              vehicle?.OperatorRef ||
                              "",
                          lineName:
                              vehicle?.PublishedLineName ||
                              vehicle?.LineRef ||
                              "",
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
                setGpsPositions((prevPositions) => [
                    ...prevPositions,
                    ...ijppPositions,
                ]);
            } catch (error) {
                console.error("Error fetching ijpp positions:", error);
            }
        };
        fetchIJPPPositions();
        const intervalId = setInterval(fetchIJPPPositions, 30000);
        return () => clearInterval(intervalId);
    }, [activeOperators]);

    // Fetch positions of Slovenske železnice trains
    useEffect(() => {
        const fetchTrainPositions = async () => {
            try {
                const data = await fetchJson(
                    "https://api.modra.ninja/sz/lokacije_raw"
                );
                setTrainPositions(data);
            } catch (error) {
                console.error("Error fetching train positions:", error);
            }
        };

        fetchTrainPositions();
    }, []);

    // Fetch positions of Slovenske železnice train stops (ne dela api)
    /* useEffect(() => {
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
    }, []); */

    // Get user's location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation([latitude, longitude]);
                    localStorage.setItem(
                        "userLocation",
                        JSON.stringify([latitude, longitude])
                    );
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
            if (!lppCode) {
                setLppArrivals([]);
                return;
            }
            try {
                if (!activeOperators.includes("lpp")) {
                    setLppArrivals([]);
                    return;
                }

                const raw = await fetchJson(lppArrivalsLink + lppCode);

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
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        setCurrentUrl={setCurrentUrl}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                    />
                                }
                            />
                            <Route
                                path="/map"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        setCurrentUrl={setCurrentUrl}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                    />
                                }
                            />
                            <Route
                                path="/route"
                                element={
                                    <BusRouteTab
                                        selectedVehicle={selectedVehicle}
                                        positionsUrl={ijppLocationsLink}
                                        setCurentUrl={setCurrentUrl}
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
                    <NavLink to="/route">
                        <button
                            onClick={() => setCurrentUrl("/route")}
                            className={currentUrl === "/route" ? "active" : ""}
                        >
                            <ArrowRightLeft size={24} />
                            <span>Pot</span>
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
