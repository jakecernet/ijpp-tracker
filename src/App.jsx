import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings, X, ArrowRightLeft } from "lucide-react";
import "./App.css";

import busStopsSource from "./unified_stops_with_gtfs.json";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const BusRouteTab = lazy(() => import("./tabs/busRoute"));

import {
    fetchLPPPositions,
    fetchIJPPPositions,
    fetchTrainPositions,
    fetchLppArrivals,
    fetchIjppArrivals,
    fetchLppRoute,
    fetchSzStops,
    fetchSzTrip,
} from "./Api.jsx";

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

    const [lppRoute, setLppRoute] = useState([]);
    const [szRoute, setSzRoute] = useState([]);

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

    //Fetch train and bus positions periodically
    useEffect(() => {
        setInterval(() => {
            const fetchPositions = async () => {
                try {
                    const [lpp, ijpp, trains] = await Promise.all([
                        fetchLPPPositions(),
                        fetchIJPPPositions(),
                        fetchTrainPositions(),
                    ]);

                    const lppPositions = Array.isArray(lpp) ? lpp : [];
                    const ijppPositions = Array.isArray(ijpp) ? ijpp : [];
                    const trainPositions = Array.isArray(trains) ? trains : [];

                    setGpsPositions([...lppPositions, ...ijppPositions]);
                    setTrainPositions(trainPositions);
                } catch (error) {
                    console.error("Error fetching positions:", error);
                }
            };

            fetchPositions();
        }, 15000);
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

    // LPP arrivals
    useEffect(() => {
        const load = async () => {
            const lppCode = activeStation?.ref_id;
            if (!lppCode) {
                setLppArrivals([]);
                return;
            }
            try {
                const arrivals = await fetchLppArrivals(lppCode);
                setLppArrivals(arrivals);
            } catch (error) {
                console.error("Error loading LPP arrivals:", error);
                setLppArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // IJPP arrivals
    useEffect(() => {
        const load = async () => {
            const ijppId = activeStation?.ijpp_id;
            if (!ijppId) {
                setIjppArrivals([]);
                return;
            }
            try {
                const arrivals = await fetchIjppArrivals(ijppId);
                setIjppArrivals(arrivals);
            } catch (error) {
                console.error("Error loading IJPP arrivals:", error);
                setIjppArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // LPP route
    useEffect(() => {
        const load = async () => {
            if (!selectedVehicle) return;
            try {
                const route = await fetchLppRoute(selectedVehicle.tripId);
                setLppRoute(route);
            } catch (error) {
                console.error("Error loading LPP route:", error);
            }
        };
        load();
    }, [selectedVehicle]);

    // Fetch SZ stops
    useEffect(() => {
        const load = async () => {
            try {
                const stops = await fetchSzStops();
                setSzStops(stops);
                console.log("SZ stops loaded:", stops);
            } catch (error) {
                console.error("Error loading SZ stops:", error);
            }
        };
        load();
    }, []);

    // Fetch SZ trip info
    useEffect(() => {
        const load = async () => {
            try {
                const route = await fetchSzTrip("20251112_19%3A32_sz_434288");
                setSzRoute(route);
                console.log("SZ route loaded:", route);
            } catch (error) {
                console.error("Error loading SZ route:", error);
            }
        };
        load();
    }, [selectedVehicle]);

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
                                path="/route"
                                element={
                                    <BusRouteTab
                                        selectedVehicle={selectedVehicle}
                                        lppRoute={lppRoute}
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
            </div>
        </Router>
    );
}

export default App;
