import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, ArrowRightLeft } from "lucide-react";
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
    szRoutePoints,
    fetchIJPPTrip,
} from "./Api.jsx";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const RouteTab = lazy(() => import("./tabs/route.jsx"));

if (typeof window !== "undefined") {
    // Preload components to avoid lag on first navigation
    import("./tabs/map");
    import("./tabs/arrivals");
    import("./tabs/nearMe");
    import("./tabs/route.jsx");
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
    const [ijppTrip, setIjppTrip] = useState(null);

    // Redirecta na zemljevid, če ni izbrane postaje
    useEffect(() => {
        if (!activeStation || activeStation.length === 0) {
            document.location.href = "/#/map";
        }
    }, [activeStation]);

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

    // LPP route
    useEffect(() => {
        const load = async () => {
            try {
                const route = await fetchLppRoute(
                    selectedVehicle.tripId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.tripId,

                    selectedVehicle.routeId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.routeId ||
                        JSON.parse(localStorage.getItem("selectedBusRoute"))
                            ?.lineId
                );
                setLppRoute(route);
                console.log("Loaded LPP route:", route);
            } catch (error) {
                console.error("Error loading LPP route:", error);
            }
        };
        load();
    }, [selectedVehicle]);

    // Za fetchanje SZ tripov iz prihodov
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

    // Dobi LPP routo iz prihodov (na isto foro kot SZ)
    const setLppRouteArrival = async (arrival) => {
        try {
            const route = await fetchLppRoute(arrival.tripId);
            setLppRoute(route);
            setSelectedVehicle({
                tripId: arrival.tripId,
                lineNumber: arrival.routeName,
                lineName: arrival.tripName,
                routeId: arrival.routeId,
                routeName: arrival.routeName,
                operator: "Javno podjetje Ljubljanski potniški promet d.o.o.",
            });
            localStorage.setItem(
                "selectedBusRoute",
                JSON.stringify({
                    tripId: arrival.tripId,
                    tripName: arrival.tripName,
                    routeName: arrival.routeName,
                    routeId: arrival.routeId,
                    operator:
                        "Javno podjetje Ljubljanski potniški promet d.o.o.",
                })
            );
        } catch (error) {
            console.error("Error loading LPP route:", error);
        }
    };

    // Dobi IJPP trip iz prihodov
    const setIjppRouteFromArrival = (arrival) => {
        if (!arrival?.tripId) return;
        const vehicle = {
            tripId: arrival.tripId,
            lineName: arrival.tripName,
            operator: arrival.operatorName,
        };
        setSelectedVehicle(vehicle);
        localStorage.setItem("selectedBusRoute", JSON.stringify(vehicle));
    };

    // Fetcha SZ routo
    useEffect(() => {
        const load = async () => {
            if (!selectedVehicle) return;
            try {
                const route = await fetchSzTrip(selectedVehicle.tripId);
                setSzRoute(route ?? []);
            } catch (error) {
                console.error("Error loading SZ route:", error);
                setSzRoute([]);
            }
        };
        load();
    }, [selectedVehicle]);

    // Fetcha IJPP pot
    useEffect(() => {
        if (!selectedVehicle) return;
        const isLPP = selectedVehicle?.lineNumber != null;
        const isSZ = Boolean(selectedVehicle?.from && selectedVehicle?.to);
        if (isLPP || isSZ) {
            setIjppTrip(null);
            return;
        }
        const tripId = selectedVehicle?.tripId;
        if (!tripId) {
            setIjppTrip(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const trip = await fetchIJPPTrip(tripId);
                if (!cancelled) setIjppTrip(trip);
            } catch (err) {
                if (!cancelled) setIjppTrip(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedVehicle]);

    return (
        <Router>
            <div className="container">
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
                                        ijppTrip={ijppTrip}
                                        lppRoute={lppRoute}
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
                                        ijppTrip={ijppTrip}
                                        lppRoute={lppRoute}
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
                                        getSzTripFromId={getSzTripFromId}
                                        setLppRouteFromArrival={
                                            setLppRouteArrival
                                        }
                                        setIjppRouteFromArrival={
                                            setIjppRouteFromArrival
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
                                    />
                                }
                            />
                            <Route
                                path="/route"
                                element={
                                    <RouteTab
                                        selectedVehicle={selectedVehicle}
                                        lppRoute={lppRoute}
                                        szRoute={szRoute}
                                        ijppTrip={ijppTrip}
                                        setActiveStation={setActiveStation}
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
                    <NavLink to="/route">
                        <button>
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
