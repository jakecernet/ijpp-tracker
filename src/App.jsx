import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, ArrowRightLeft } from "lucide-react";
import "./App.css";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const BusRouteTab = lazy(() => import("./tabs/busRoute"));

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

    const [busStops, setBusStops] = useState([]);
    const [szStops, setSzStops] = useState([]);

    const [ijppArrivals, setIjppArrivals] = useState([]);
    const [lppArrivals, setLppArrivals] = useState([]);
    const [szArrivals, setSzArrivals] = useState([]);

    const [lppRoute, setLppRoute] = useState([]);
    const [szRoute, setSzRoute] = useState([]);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const getSzTripFromId = async (tripId) => {
        try {
            const route = await fetchSzTrip(tripId);
            setSzRoute(route ?? []);
            localStorage.setItem(
                "selectedBusRoute",
                JSON.stringify({
                    tripId: tripId,
                    tripName: route[0]?.tripName,
                    shortName: route[0]?.shortName,
                })
            );
        } catch (error) {
            console.error("Error loading SZ trip from ID:", error);
        }
    };

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

    // Fetch all bus stops
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
                console.log("IJPP arrivals loaded:", arrivals);
            } catch (error) {
                console.error("Error loading IJPP arrivals:", error);
                setIjppArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // SZ arrivals
    useEffect(() => {
        const load = async () => {
            const szId = activeStation?.stopId;
            try {
                const arrivals = await fetchSzArrivals(szId);
                setSzArrivals(arrivals);
                console.log("SZ arrivals loaded:", arrivals);
            } catch (error) {
                console.error("Error loading SZ arrivals:", error);
                setSzArrivals([]);
            }
        };
        load();
    }, [activeStation]);

    // LPP route
    useEffect(() => {
        const load = async () => {
            try {
                const route = await fetchLppRoute(
                    selectedVehicle.tripId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.tripId
                );
                console.log("LPP route loaded:", route);
                setLppRoute(route);
            } catch (error) {
                console.error("Error loading LPP route:", error);
            }
        };
        load();
    }, [selectedVehicle]);

    const setLppRouteArrival = async (arrival) => {
        try {
            const route = await fetchLppRoute(arrival.tripId);
            setLppRoute(route);
            setSelectedVehicle({
                tripId: arrival.tripId,
                lineNumber: arrival.routeName,
                lineName: arrival.tripName,
                operator: "Javno podjetje Ljubljanski potniški promet d.o.o.",
            });
            localStorage.setItem(
                "selectedBusRoute",
                JSON.stringify({
                    tripId: arrival.tripId,
                    tripName: arrival.tripName,
                    routeName: arrival.routeName,
                })
            );
        } catch (error) {
            console.error("Error loading LPP route:", error);
        }
    };

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
            if (!selectedVehicle) return;
            try {
                const route = await fetchSzTrip(selectedVehicle.tripId);
                setSzRoute(route ?? []);
                console.log("SZ route loaded:", route);
            } catch (error) {
                console.error("Error loading SZ route:", error);
                setSzRoute([]);
            }
        };
        load();
    }, [selectedVehicle]);

    return (
        <Router>
            <div className="container">
                <div className="content">
                    <Suspense fallback={<div>Loading...</div>}>
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
                                        trainStops={szStops}
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
                                        szArrivals={szArrivals}
                                        getSzTripFromId={getSzTripFromId}
                                        setCurrentUrl={setCurrentUrl}
                                        setLppRouteFromArrival={
                                            setLppRouteArrival
                                        }
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
                                        szRoute={szRoute}
                                        setCurrentUrl={setCurrentUrl}
                                        setActiveStation={setActiveStation}
                                    />
                                }
                            />
                        </Routes>
                    </Suspense>
                </div>
                <nav>
                    <NavLink to="/map">
                        <button onClick={() => setCurrentUrl("/map")}>
                            <Map size={24} />
                            <h3>Zemljevid</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/arrivals">
                        <button onClick={() => setCurrentUrl("/arrivals")}>
                            <Clock size={24} />
                            <h3>Prihodi</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/stations">
                        <button onClick={() => setCurrentUrl("/stations")}>
                            <MapPin size={24} />
                            <h3>V bližini</h3>
                        </button>
                    </NavLink>
                    <NavLink to="/route">
                        <button onClick={() => setCurrentUrl("/route")}>
                            <ArrowRightLeft size={24} />
                            <h3>Pot</h3>
                        </button>
                    </NavLink>
                </nav>
            </div>
        </Router>
    );
}

export default App;
