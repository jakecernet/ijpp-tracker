import { useState, useEffect, lazy, Suspense } from "react";
import { HashRouter as Router, NavLink, Routes, Route } from "react-router-dom";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import "./App.css";

const MapTab = lazy(() => import("./tabs/map"));
const ArrivalsTab = lazy(() => import("./tabs/arrivals"));
const NearMeTab = lazy(() => import("./tabs/nearMe"));
const SettingsTab = lazy(() => import("./tabs/settings"));

// Custom hook for LocalStorage state
function useLocalStorageState(key, initialValue) {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : initialValue;
    });
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
    return [value, setValue];
}

// Helper function to fetch JSON data with error handling and caching if needed.
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
    const [currentUrl, setCurrentUrl] = useState(window.location.hash.slice(1));
    const [userLocation, setUserLocation] = useState(
        localStorage.getItem("userLocation")
            ? JSON.parse(localStorage.getItem("userLocation"))
            : [46.056, 14.5058]
    );
    const [busStopArrivals, setBusStopArrivals] = useState([]);
    const [activeOperators, setActiveOperators] = useState(
        localStorage.getItem("activeOperators")
            ? JSON.parse(localStorage.getItem("activeOperators"))
            : ["lpp", "arriva", "nomago", "murska"]
    );
    const [radius, setRadius] = useState(localStorage.getItem("radius") || 20);
    const [busRadius, setBusRadius] = useState(
        localStorage.getItem("busRadius") || 20
    );

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

    useEffect(() => {
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

        const fetchBusStops = async () => {
            try {
                let stops = JSON.parse(localStorage.getItem("busStops"));
                if (!stops) {
                    const data = await fetchJson(
                        "https://ojpp.si/api/stop_locations"
                    );
                    stops = data.features.map((feature) => ({
                        name: feature.properties.name,
                        gpsLocation: feature.geometry.coordinates.reverse(),
                        id: feature.properties.id,
                    }));
                    localStorage.setItem("busStops", JSON.stringify(stops));
                }
                const filteredStops = stops.filter((stop) => {
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
    }, [radius, userLocation]);

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
        const fetchBusStopArrivals = async () => {
            try {
                const data = await fetchJson(
                    `https://ojpp.si/api/stop_locations/${activeStation.id}/arrivals`
                );
                const arrivals = data.map((arrival) => ({
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
                                        setCurentUrl={setCurrentUrl}
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
                                        setCurentUrl={setCurrentUrl}
                                    />
                                }
                            />
                            <Route
                                path="/arrivals"
                                element={
                                    <ArrivalsTab
                                        activeStation={activeStation}
                                        stopArrivals={busStopArrivals}
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
                    <NavLink to="/settings">
                        <button
                            onClick={() => setCurrentUrl("/settings")}
                            className={
                                currentUrl === "/settings" ? "active" : ""
                            }
                        >
                            <Settings size={24} />
                            <span>Nastavitve</span>
                        </button>
                    </NavLink>
                </nav>
            </div>
        </Router>
    );
}

export default App;
