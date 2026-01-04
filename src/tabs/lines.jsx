import { useState, useEffect, useMemo, useCallback } from "react";
import { Heart } from "lucide-react";
import { format } from "date-fns";
import { sl } from "date-fns/locale";

const LIKED_ROUTES_KEY = "likedRoutes";
const lppRoutesApiUrl = "https://tracker.cernetic.cc/api/lpp-all-routes";

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

const LinesTab = ({
    gpsPositions,
    activeStation,
    ijppArrivals,
    lppArrivals,
    szArrivals,
    getTripFromId,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState("arrivals"); // all, arrivals, liked
    const [likedRoutes, setLikedRoutes] = useState(() =>
        loadLikedItems(LIKED_ROUTES_KEY)
    );
    const [lppNumberedRoutes, setLppNumberedRoutes] = useState([]);

    // Fetch LPP routes
    useEffect(() => {
        const fetchLppRoutes = async () => {
            try {
                const response = await fetch(lppRoutesApiUrl);
                if (!response.ok)
                    throw new Error("Network response was not ok");
                const data = await response.json();
                setLppNumberedRoutes(data?.data || []);
            } catch {
                setLppNumberedRoutes([]);
            }
        };
        fetchLppRoutes();
    }, []);

    // All active routes from GPS positions
    const allActiveRoutes = useMemo(() => {
        const shouldInclude = (pos) =>
            !(
                pos?.operator === "Ljubljanski potniški promet d.o.o." &&
                !pos?.lineName
            );

        const uniqueRoutes = [];
        const seenNames = new Set();

        for (const vehicle of gpsPositions.filter(shouldInclude)) {
            const name = vehicle.lineName || vehicle.route_name;
            if (name && !seenNames.has(name)) {
                seenNames.add(name);
                uniqueRoutes.push(vehicle);
            }
        }

        return uniqueRoutes;
    }, [gpsPositions]);

    // Get unique route ID for liking
    const getRouteId = useCallback((route) => {
        return route?.lineName || route?.route_name;
    }, []);

    const isRouteLiked = useCallback(
        (route) => {
            const id = getRouteId(route);
            return likedRoutes.some((r) => r.id === id);
        },
        [likedRoutes, getRouteId]
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
                              lineNumber: route.lineNumber || route.routeName,
                              operator: route.operator || route.operatorName,
                              headsign: route.headsign || route.tripName,
                              tripId: route.tripId,
                              lineId: route.lineId,
                              routeId: route.routeId,
                          },
                      ];
                saveLikedItems(LIKED_ROUTES_KEY, newLiked);
                return newLiked;
            });
        },
        [getRouteId]
    );

    const bgColorMap = (item) => {
        const operator = item?.operator || item?.operatorName;
        const type = item?.type;

        if (type === "LPP" || operator?.includes("Ljubljanski potniški promet"))
            return "var(--lpp-color)";
        if (type === "SZ" || operator?.includes("Slovenske železnice"))
            return "var(--sz-color)";
        if (operator?.includes("Nomago")) return "var(--nomago-color)";
        if (operator?.includes("Marprom")) return "var(--marprom-color)";
        if (operator?.includes("Arriva")) return "var(--arriva-color)";
        if (operator?.includes("Murska")) return "var(--murska-color)";

        return "var(--default-color)";
    };

    const formatArrivalTime = (arrivalTime) => {
        if (!arrivalTime) return "N/A";
        return format(arrivalTime, "HH:mm", { locale: sl });
    };

    const formatDelay = (scheduledDeparture, actualDeparture) => {
        if (!scheduledDeparture || !actualDeparture) return "N/A";
        const scheduled = new Date(scheduledDeparture);
        const actual = new Date(actualDeparture);
        if (isNaN(scheduled) || isNaN(actual)) return "N/A";
        const diffMinutes = Math.round((actual - scheduled) / 60000);
        if (diffMinutes === 0) return " 0 min";
        return diffMinutes > 0 ? ` ${diffMinutes} min` : ` -${diffMinutes} min`;
    };

    // Combined arrivals for current station
    const allArrivals = useMemo(() => {
        const ijppFiltered = (ijppArrivals || [])
            .filter((arrival) =>
                arrival?.tripName
                    ?.toLowerCase()
                    .includes(searchTerm.toLowerCase())
            )
            .filter(
                (arrival) =>
                    arrival?.operatorName !== "Ljubljanski Potniški Promet"
            )
            .map((arrival) => ({ ...arrival, type: "IJPP" }));

        const lppFiltered = (lppArrivals || [])
            .filter(
                (arrival) =>
                    arrival.tripName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase()) ||
                    arrival.routeName
                        ?.toLowerCase()
                        .includes(searchTerm.toLowerCase())
            )
            .map((arrival) => ({ ...arrival, type: "LPP" }));

        const szFiltered = (szArrivals || [])
            .filter((arrival) =>
                arrival.headsign
                    ?.toLowerCase()
                    .includes(searchTerm.toLowerCase())
            )
            .map((arrival) => ({ ...arrival, type: "SZ" }));

        return [...ijppFiltered, ...lppFiltered, ...szFiltered];
    }, [ijppArrivals, lppArrivals, szArrivals, searchTerm]);

    // Filtered routes for "All" - combines LPP numbered routes and active routes
    const filteredAllRoutes = useMemo(() => {
        if (searchTerm.length < 1) return [];

        const term = searchTerm.toLowerCase();

        // Search in LPP numbered routes (works with short queries)
        const filteredLpp = lppNumberedRoutes
            .filter(
                (route) =>
                    route?.route_number
                        ?.toString()
                        .toLowerCase()
                        .includes(term) ||
                    route?.route_name?.toLowerCase().includes(term)
            )
            .map((route) => ({
                lineName: route.route_name,
                lineNumber: route.route_number,
                tripId: route.trip_id,
                routeId: route.route_id,
                lineId: route.route_id,
                operator: "Ljubljanski potniški promet d.o.o.",
            }));

        // For longer searches, also include active routes
        if (searchTerm.length >= 3) {
            const filteredActive = allActiveRoutes.filter((route) =>
                (route.lineName || route.route_name || route.lineNumber)
                    ?.toLowerCase()
                    .includes(term)
            );

            // Combine and deduplicate
            const combined = [...filteredLpp];
            const seenIds = new Set(combined.map((r) => getRouteId(r)));

            for (const route of filteredActive) {
                const id = getRouteId(route);
                if (!seenIds.has(id)) {
                    seenIds.add(id);
                    combined.push(route);
                }
            }

            return combined;
        }

        return filteredLpp;
    }, [searchTerm, lppNumberedRoutes, allActiveRoutes, getRouteId]);

    // Filtered liked routes
    const filteredLikedRoutes = useMemo(() => {
        return likedRoutes.filter((liked) =>
            (liked.name || liked.lineNumber || "")
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
        );
    }, [likedRoutes, searchTerm]);

    const handleRouteClick = async (item, type) => {
        // Don't try to fetch if there's no valid ID
        if (!item.tripId && !item.lineId && !item.routeId) {
            console.warn("No valid trip/line ID for route", item);
            return;
        }

        const operatorType =
            type ||
            (item.operator?.includes("Slovenske železnice")
                ? "SZ"
                : item.operator?.includes("Ljubljanski potniški promet")
                ? "LPP"
                : "IJPP");
        const route = await getTripFromId(item, operatorType);
        if (route) {
            try {
                sessionStorage.setItem("openRouteDrawer", "1");
            } catch {}
            window.location.hash = "/map";
        }
    };

    const RouteItem = ({ item, isLiked, onToggleLike, onClick }) => (
        <div className="route-item" onClick={onClick}>
            <div className="circle" style={{ background: bgColorMap(item) }}>
                {item.lineNumber ??
                    item.routeName ??
                    item.tripId?.slice(5) ??
                    "?"}
            </div>
            <h3>
                {item.lineName || item.headsign || item.name || item.tripName}
            </h3>
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

    const ArrivalItem = ({ arrival }) => (
        <div
            className="arrival-item"
            onClick={() => handleRouteClick(arrival, arrival.type)}
        >
            <div className="left">
                <div
                    className="circle"
                    style={{ background: bgColorMap(arrival) }}
                >
                    <h2
                        style={{
                            fontSize: arrival.type === "SZ" ? 16 : 20,
                            fontWeight: "bold",
                        }}
                    >
                        {arrival.type === "LPP"
                            ? arrival.routeName
                            : arrival.routeShortName || arrival.tripName}
                    </h2>
                </div>
                <h3>{arrival.tripName || arrival.headsign}</h3>
            </div>
            <p>
                {arrival.type === "SZ"
                    ? formatArrivalTime(
                          arrival?.actualDeparture || arrival.scheduledDeparture
                      )
                    : arrival.type === "LPP"
                    ? arrival.etaMinutes + " min"
                    : arrival?.realtimeDeparture?.slice(0, -3)}
            </p>
            {arrival.type === "SZ" && (
                <p>
                    {"Zamuda: " +
                        formatDelay(
                            arrival.scheduledDeparture,
                            arrival.actualDeparture
                        )}
                </p>
            )}
        </div>
    );

    return (
        <div className="insideDiv">
            <h2>Linije {"(" + activeStation?.name + ")"}</h2>
            <input
                type="text"
                placeholder={
                    page === "arrivals"
                        ? "Išči po številki linije..."
                        : "Išči linije..."
                }
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="top-nav">
                <button
                    className={page === "arrivals" ? "active" : ""}
                    onClick={() => setPage("arrivals")}
                >
                    Prihodi
                </button>
                <button
                    className={page === "all" ? "active" : ""}
                    onClick={() => setPage("all")}
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
            <div className="results">
                {page === "arrivals" && (
                    <div className="arrival-list">
                        {allArrivals.length === 0 && (
                            <p className="empty-message">
                                Ni prihodov na tej postaji.
                            </p>
                        )}
                        {allArrivals.map((arrival, index) => (
                            <ArrivalItem
                                key={`arrival-${index}`}
                                arrival={arrival}
                            />
                        ))}
                    </div>
                )}
                {page === "all" && (
                    <>
                        {searchTerm.length < 1 && (
                            <p className="empty-message">
                                Vnesite številko linije ali ime.
                            </p>
                        )}
                        {searchTerm.length >= 1 &&
                            filteredAllRoutes.length === 0 && (
                                <p className="empty-message">Ni rezultatov.</p>
                            )}
                        <ul className="route-list">
                            {filteredAllRoutes.map((route, index) => (
                                <RouteItem
                                    key={`route-${index}`}
                                    item={route}
                                    isLiked={isRouteLiked(route)}
                                    onToggleLike={(e) =>
                                        toggleLikeRoute(route, e)
                                    }
                                    onClick={() => handleRouteClick(route)}
                                />
                            ))}
                        </ul>
                    </>
                )}
                {page === "liked" && (
                    <>
                        {filteredLikedRoutes.length === 0 && (
                            <p className="empty-message">
                                Ni priljubljenih linij. Kliknite na ❤️ za
                                dodajanje.
                            </p>
                        )}
                        <ul className="route-list">
                            {filteredLikedRoutes.map((liked, index) => {
                                const activeRoute = allActiveRoutes.find(
                                    (r) => getRouteId(r) === liked.id
                                );
                                const routeData = activeRoute || {
                                    lineName: liked.name,
                                    lineNumber: liked.lineNumber,
                                    operator: liked.operator,
                                    headsign: liked.headsign,
                                    tripId: liked.tripId,
                                    lineId: liked.lineId,
                                    routeId: liked.routeId,
                                };
                                return (
                                    <RouteItem
                                        key={`liked-${index}`}
                                        item={routeData}
                                        isLiked={true}
                                        onToggleLike={(e) =>
                                            toggleLikeRoute(routeData, e)
                                        }
                                        onClick={() =>
                                            handleRouteClick(routeData)
                                        }
                                    />
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default LinesTab;
