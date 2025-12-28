import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin } from "lucide-react";
import "./App.css";

import {
    fetchAllBusStops,
    fetchLPPPositions,
    fetchIJPPPositions,
    fetchTrainPositions,
    fetchLppArrivals,
    fetchIjppArrivals,
    fetchLppRoute,
    fetchSzStops,
    fetchSzTrip,
    fetchSzArrivals,
    fetchIJPPTrip,
} from "./Api.jsx";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));

if (typeof window !== "undefined") {
    // Preload components to avoid lag on first navigation
    import("./tabs/map");
    import("./tabs/arrivals");
    import("./tabs/nearMe");
}

function App() {
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

    const [theme, setTheme] = useState(
        localStorage.getItem("theme") || "light"
    );

    useEffect(() => {
        localStorage.getItem("theme")
            ? setTheme(localStorage.getItem("theme"))
            : localStorage.setItem("theme", "light");
    }, [theme]);

    const [gpsPositions, setGpsPositions] = useState([]);
    const [trainPositions, setTrainPositions] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    const [busStops, setBusStops] = useState([]);
    const [szStops, setSzStops] = useState([]);

    const [ijppArrivals, setIjppArrivals] = useState([]);
    const [lppArrivals, setLppArrivals] = useState([]);
    const [szArrivals, setSzArrivals] = useState([]);

    const [lppRoute, setLppRoute] = useState([]);
    const [szRoute, setSzRoute] = useState([]);
    const [ijppTrip, setIjppTrip] = useState(null);
    const [route, setRoute] = useState(null);

    // Fetcha busne postaje ob zagonu
    useEffect(() => {
        const loadBusStops = async () => {
            try {
                const stops = await fetchAllBusStops();
                setBusStops(stops);
            } catch (error) {
                console.error("Error loading bus stops:", error);
                setBusStops([]);
            }
        };
        loadBusStops();
    }, []);

    // Fetcha SZ postaje ob zagonu
    useEffect(() => {
        const load = async () => {
            try {
                const stops = await fetchSzStops();
                setSzStops(stops);
            } catch (error) {
                console.error("Error loading SZ stops:", error);
            }
        };
        load();
    }, []);

    // Na 15 sekund fetcha pozicije vlakov + busov
    useEffect(() => {
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

        //začetn fetch
        fetchPositions();

        // fetchanje vsakih 5 sekund
        const intervalId = setInterval(fetchPositions, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // Dobi userjevo lokacijo
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

    // LPP prihodi
    useEffect(() => {
        const load = async () => {
            const lppCode = activeStation?.ref_id || activeStation.station_code;
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

    // IJPP prihodi
    useEffect(() => {
        const load = async () => {
            const ijppId = activeStation?.gtfs_id;
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

    // SZ prihodi
    useEffect(() => {
        const load = async () => {
            const szId = activeStation?.stopId;
            try {
                const arrivals = await fetchSzArrivals(szId);
                setSzArrivals(arrivals);
            } catch (error) {
                console.error("Error loading SZ arrivals:", error);
                setSzArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // Za fetchanje tripa iz ID-ja
    const getTripFromId = async (tripId, type) => {
        console.log(tripId + " " + type);
        try {
            if (type === "LPP") {
                const route = await fetchLppRoute(tripId);
                setSelectedVehicle(route);
            }
            if (type === "IJPP") {
                const route = await fetchIJPPTrip(tripId);
                setSelectedVehicle(route);
            }
            if (type === "SZ") {
                const route = await fetchSzTrip(tripId);
                setSelectedVehicle(route);
            }
            console.log(route);
            return;
        } catch (error) {
            console.error("Error loading SZ trip from ID:", error);
        }
    };

    return (
        <Router>
            <div className={`container ${theme}`}>
                <div className="content">
                    <Suspense
                        fallback={
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    fontSize: "14px",
                                    color: "#94a3b8",
                                }}
                            >
                                Nalaganje...
                            </div>
                        }
                    >
                        <Routes>
                            <Route
                                path="/*"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        trainStops={szStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                        selectedVehicle={selectedVehicle}
                                        theme={theme}
                                        setTheme={setTheme}
                                    />
                                }
                            />
                            <Route
                                path="/map"
                                element={
                                    <MapTab
                                        gpsPositions={gpsPositions}
                                        busStops={busStops}
                                        trainStops={szStops}
                                        activeStation={activeStation}
                                        setActiveStation={setActiveStation}
                                        userLocation={userLocation}
                                        trainPositions={trainPositions}
                                        setSelectedVehicle={setSelectedVehicle}
                                        selectedVehicle={selectedVehicle}
                                        theme={theme}
                                        setTheme={setTheme}
                                    />
                                }
                            />
                            <Route
                                path="/arrivals"
                                element={
                                    <ArrivalsTab
                                        activeStation={activeStation}
                                        ijppArrivals={ijppArrivals}
                                        lppArrivals={lppArrivals}
                                        szArrivals={szArrivals}
                                        getTripFromId={getTripFromId}
                                    />
                                }
                            />
                            <Route
                                path="/stations"
                                element={
                                    <NearMeTab
                                        setActiveStation={setActiveStation}
                                        busStops={busStops}
                                        szStops={szStops}
                                        userLocation={userLocation}
                                    />
                                }
                            />
                        </Routes>
                    </Suspense>
                </div>
                <nav>
                    <NavLink to="/map">
                        <button>
                            <Map size={24} />
                            <h3>Zemljevid</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/arrivals">
                        <button>
                            <Clock size={24} />
                            <h3>Prihodi</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/stations">
                        <button>
                            <MapPin size={24} />
                            <h3>V bližini</h3>
                        </button>
                    </NavLink>
                </nav>
            </div>
        </Router>
    );
}

export default App;
