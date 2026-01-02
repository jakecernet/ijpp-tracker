import { useState, useEffect, useMemo, useCallback } from "react";
import { Bus, Train, Heart } from "lucide-react";

const LIKED_STATIONS_KEY = "likedStations";
const LIKED_ROUTES_KEY = "likedRoutes";

const loadLikedItems = (key) => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveLikedItems = (key, items) => {
    try {
        localStorage.setItem(key, JSON.stringify(items));
    } catch {}
};

const SearchTab = ({
    gpsPositions,
    busStops,
    trainStops,
    setActiveStation,
    trainPositions,
    getTripFromId,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [stations, setStations] = useState(true);
    const [lines, setLines] = useState(true);
    const [page, setPage] = useState("search");
    const [likedStations, setLikedStations] = useState(() =>
        loadLikedItems(LIKED_STATIONS_KEY)
    );
    const [likedRoutes, setLikedRoutes] = useState(() =>
        loadLikedItems(LIKED_ROUTES_KEY)
    );

    const allStations = useMemo(
        () => [...busStops, ...trainStops],
        [busStops, trainStops]
    );

    const allRoutes = useMemo(() => {
        const shouldInclude = (pos) =>
            !(
                pos?.operator === "Ljubljanski potniški promet d.o.o." &&
                !pos?.lineName
            );

        const allVehicles = [
            ...gpsPositions.filter(shouldInclude),
            ...trainPositions.filter(shouldInclude),
        ];

        const uniqueRoutes = [];
        const seenNames = new Set();

        for (const vehicle of allVehicles) {
            const name = vehicle.lineName || vehicle.route_name;
            if (name && !seenNames.has(name)) {
                seenNames.add(name);
                uniqueRoutes.push(vehicle);
            }
        }

        return uniqueRoutes;
    }, [gpsPositions, trainPositions]);

    const [filtered, setFiltered] = useState([]);

    // Get unique station ID for liking
    const getStationId = useCallback((station) => {
        return station?.ref_id || station?.id || station?.name;
    }, []);

    // Get unique route ID for liking
    const getRouteId = useCallback((route) => {
        return route?.lineName || route?.route_name || route?.lineNumber;
    }, []);

    const isStationLiked = useCallback(
        (station) => {
            const id = getStationId(station);
            return likedStations.some((s) => s.id === id);
        },
        [likedStations, getStationId]
    );

    const isRouteLiked = useCallback(
        (route) => {
            const id = getRouteId(route);
            return likedRoutes.some((r) => r.id === id);
        },
        [likedRoutes, getRouteId]
    );

    const toggleLikeStation = useCallback(
        (station, e) => {
            e?.stopPropagation();
            const id = getStationId(station);
            setLikedStations((prev) => {
                const exists = prev.some((s) => s.id === id);
                const newLiked = exists
                    ? prev.filter((s) => s.id !== id)
                    : [...prev, { id, name: station.name, data: station }];
                saveLikedItems(LIKED_STATIONS_KEY, newLiked);
                return newLiked;
            });
        },
        [getStationId]
    );

    const toggleLikeRoute = useCallback(
        (route, e) => {
            e?.stopPropagation();
            const id = getRouteId(route);
            setLikedRoutes((prev) => {
                const exists = prev.some((r) => r.id === id);
                const newLiked = exists
                    ? prev.filter((r) => r.id !== id)
                    : [
                          ...prev,
                          {
                              id,
                              name: route.lineName || route.route_name,
                              lineNumber: route.lineNumber,
                              operator: route.operator,
                              headsign: route.headsign,
                          },
                      ];
                saveLikedItems(LIKED_ROUTES_KEY, newLiked);
                return newLiked;
            });
        },
        [getRouteId]
    );

    useEffect(() => {
        if (searchTerm.length < 3) {
            setFiltered([]);
            return;
        }

        const term = searchTerm.toLowerCase();
        const filteredStations = stations
            ? allStations.filter((station) =>
                  station?.name?.toLowerCase().includes(term)
              )
            : [];
        const filteredRoutes = lines
            ? allRoutes.filter((route) =>
                  (route.lineName || route.route_name || route.lineNumber)
                      ?.toLowerCase()
                      .includes(term)
              )
            : [];
        setFiltered([...filteredStations, ...filteredRoutes]);
    }, [searchTerm, allStations, allRoutes, stations, lines]);

    const StationItem = ({ busStop, onSelect, isLiked, onToggleLike }) => (
        <div className="station-item-search" onClick={onSelect}>
            <div className="station-content">
                <div className="name">
                    {busStop?.type === "train" ? (
                        <Train size={24} />
                    ) : (
                        <Bus size={24} />
                    )}
                    <h3>{busStop?.name}</h3>
                </div>
                <ul className="station-info">
                    {busStop?.routes_on_stop
                        ?.slice(0, 4)
                        .map((route, index) => (
                            <li key={index}>
                                <p>{route}</p>
                            </li>
                        ))}
                    {busStop?.routes_on_stop?.length > 4 && (
                        <li>
                            <p>+ {busStop.routes_on_stop.length - 4}</p>
                        </li>
                    )}
                </ul>
            </div>
            <button
                className={`like-btn ${isLiked ? "liked" : ""}`}
                onClick={onToggleLike}
                aria-label={
                    isLiked
                        ? "Odstrani iz priljubljenih"
                        : "Dodaj med priljubljene"
                }
            >
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
        </div>
    );

    const RouteItem = ({ item, isLiked, onToggleLike }) => (
        <div
            className="route-item"
            onClick={async () => {
                const operatorType = item.operator?.includes(
                    "Slovenske železnice"
                )
                    ? "SZ"
                    : item.operator?.includes("Ljubljanski potniški promet")
                    ? "LPP"
                    : "IJPP";
                const route = await getTripFromId(item, operatorType);
                if (route) {
                    try {
                        sessionStorage.setItem("openRouteDrawer", "1");
                    } catch {}
                    window.location.hash = "/map";
                }
            }}
        >
            <div
                className="circle"
                style={{
                    background: bgColorMap(item),
                }}
            >
                {item.lineNumber ?? item.tripId?.slice(5) ?? "?"}
            </div>
            <h3>{item.lineName || item.headsign || item.name}</h3>
            <button
                className={`like-btn ${isLiked ? "liked" : ""}`}
                onClick={onToggleLike}
                aria-label={
                    isLiked
                        ? "Odstrani iz priljubljenih"
                        : "Dodaj med priljubljene"
                }
            >
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
            </button>
        </div>
    );

    const bgColorMap = (arrival) => {
        const operator = arrival?.operator || arrival?.operatorName;
        if (operator?.includes("Ljubljanski potniški promet"))
            return "var(--lpp-color)";
        if (operator?.includes("Slovenske železnice")) return "var(--sz-color)";
        if (operator?.includes("Nomago")) return "var(--nomago-color)";
        if (operator?.includes("Marprom")) return "var(--marprom-color)";
        if (operator?.includes("Arriva")) return "var(--arriva-color)";
        if (operator?.includes("Murska")) return "var(--murska-color)";

        return "var(--default-color)";
    };

    return (
        <div className="insideDiv">
            <h2>Iskanje</h2>
            <input
                type="text"
                placeholder="Vnesite ime postaje ali aktivne linije..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="top-nav">
                <button
                    className={page === "search" ? "active" : ""}
                    onClick={() => setPage("search")}
                >
                    Vse
                </button>
                <button
                    className={page === "liked" ? "active" : ""}
                    onClick={() => setPage("liked")}
                >
                    Priljubljene
                </button>
            </div>
            {page === "liked" && (
                <div className="liked">
                    {likedStations.length === 0 && likedRoutes.length === 0 ? (
                        <p className="empty-message">
                            Ni priljubljenih postaj ali linij. Kliknite na ❤️ za
                            dodajanje.
                        </p>
                    ) : (
                        <>
                            {likedStations.length > 0 && (
                                <div className="liked-section">
                                    <h3>Priljubljene postaje</h3>
                                    <ul>
                                        {likedStations.map((liked, index) => (
                                            <StationItem
                                                key={`liked-station-${index}`}
                                                busStop={liked.data}
                                                isLiked={true}
                                                onToggleLike={(e) =>
                                                    toggleLikeStation(
                                                        liked.data,
                                                        e
                                                    )
                                                }
                                                onSelect={() => {
                                                    setActiveStation(
                                                        liked.data
                                                    );
                                                    window.location.hash =
                                                        "/arrivals";
                                                }}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {likedRoutes.length > 0 && (
                                <div className="liked-section">
                                    <h3>Priljubljene linije</h3>
                                    <ul>
                                        {likedRoutes.map((liked, index) => {
                                            // Try to find active route data
                                            const activeRoute = allRoutes.find(
                                                (r) =>
                                                    getRouteId(r) === liked.id
                                            );
                                            const routeData = activeRoute || {
                                                lineName: liked.name,
                                                lineNumber: liked.lineNumber,
                                                operator: liked.operator,
                                                headsign: liked.headsign,
                                            };
                                            return (
                                                <RouteItem
                                                    key={`liked-route-${index}`}
                                                    item={routeData}
                                                    isLiked={true}
                                                    onToggleLike={(e) =>
                                                        toggleLikeRoute(
                                                            routeData,
                                                            e
                                                        )
                                                    }
                                                />
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            {page === "search" && (
                <div className="searching">
                    <div className="config">
                        <div>
                            <input
                                type="checkbox"
                                id="stations"
                                name="stations"
                                checked={stations}
                                onChange={() => setStations(!stations)}
                            />
                            <label htmlFor="stations">Postaje</label>
                        </div>
                        <div>
                            <input
                                type="checkbox"
                                id="lines"
                                name="lines"
                                checked={lines}
                                onChange={() => setLines(!lines)}
                            />
                            <label htmlFor="lines">Linije</label>
                        </div>
                    </div>
                    <div className="results">
                        {searchTerm.length < 3 && <p>Vnesite vsaj 3 znake.</p>}
                        {filtered.length === 0 && searchTerm.length >= 3 && (
                            <p>Ni rezultatov.</p>
                        )}
                        <ul>
                            {filtered.map((item, index) => {
                                const routeName =
                                    item.lineName || item.route_name;
                                if (routeName && lines) {
                                    return (
                                        <RouteItem
                                            key={`route-${index}`}
                                            item={item}
                                            isLiked={isRouteLiked(item)}
                                            onToggleLike={(e) =>
                                                toggleLikeRoute(item, e)
                                            }
                                        />
                                    );
                                } else if (
                                    item.name &&
                                    stations &&
                                    !routeName
                                ) {
                                    return (
                                        <StationItem
                                            key={`station-${index}`}
                                            busStop={item}
                                            isLiked={isStationLiked(item)}
                                            onToggleLike={(e) =>
                                                toggleLikeStation(item, e)
                                            }
                                            onSelect={() => {
                                                setActiveStation(item);
                                                window.location.hash =
                                                    "/arrivals";
                                            }}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchTab;
