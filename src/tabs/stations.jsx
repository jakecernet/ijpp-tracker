import { useState, useMemo, useCallback, memo } from "react";
import { Bus, Train, Heart } from "lucide-react";

const LIKED_STATIONS_KEY = "likedStations";

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

const StationsTab = ({ userLocation, setActiveStation, busStops, szStops }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState("nearMe"); // nearMe, all, liked
    const [likedStations, setLikedStations] = useState(() =>
        loadLikedItems(LIKED_STATIONS_KEY)
    );
    const [radius] = useState(() => {
        const stored = localStorage.getItem("stationRadius");
        return stored ? JSON.parse(stored) : { busRadius: 5, szRadius: 20 };
    });

    // Calculate distances and create allStations in one memo
    const allStations = useMemo(() => {
        const toRadians = (degrees) => degrees * (Math.PI / 180);
        const earthRadius = 6371;

        const calculateDistance = (stop) => {
            const lat1 = userLocation[0];
            const lon1 = userLocation[1];
            const lat2 = stop.gpsLocation?.[0] ?? stop.lat;
            const lon2 = stop.gpsLocation?.[1] ?? stop.lon;
            const dLat = toRadians(lat2 - lat1);
            const dLon = toRadians(lon2 - lon1);

            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRadians(lat1)) *
                    Math.cos(toRadians(lat2)) *
                    Math.sin(dLon / 2) *
                    Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return earthRadius * c;
        };

        return [
            ...busStops.map((stop) => ({
                ...stop,
                type: "bus",
                distance: calculateDistance(stop),
            })),
            ...szStops.map((stop) => ({
                ...stop,
                type: "sz",
                distance: calculateDistance(stop),
            })),
        ];
    }, [busStops, szStops, userLocation]);

    // Get unique station ID for liking
    const getStationId = useCallback((station) => {
        return station?.ref_id || station?.id || station?.name;
    }, []);

    const isStationLiked = useCallback(
        (station) => {
            const id = getStationId(station);
            return likedStations.some((s) => s.id === id);
        },
        [likedStations, getStationId]
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

    // Filtered stations for "Near Me"
    const nearMeStations = useMemo(() => {
        return allStations
            .filter((stop) => {
                const maxDistance =
                    stop.type === "bus" ? radius?.busRadius : radius?.szRadius;
                return stop.distance <= maxDistance && stop.distance > 0;
            })
            .filter((stop) =>
                stop.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.distance - b.distance);
    }, [allStations, searchTerm, radius]);

    // Filtered stations for "All"
    const filteredAllStations = useMemo(() => {
        if (searchTerm.length < 3) return [];
        return allStations
            .filter((stop) =>
                stop.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allStations, searchTerm]);

    // Filtered stations for "Liked"
    const filteredLikedStations = useMemo(() => {
        return likedStations.filter((liked) =>
            liked.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [likedStations, searchTerm]);

    const handleStationSelect = (station) => {
        setActiveStation(station);
        window.location.hash = "/lines";
        localStorage.setItem("activeStation", JSON.stringify(station));
    };

    const StationItem = memo(
        ({ station, onSelect, isLiked, onToggleLike, showDistance }) => (
            <div className="station-item-search" onClick={onSelect}>
                <div className="station-content">
                    <div className="name">
                        {station?.type === "sz" ? (
                            <Train size={24} />
                        ) : (
                            <Bus size={24} />
                        )}
                        <h3>{station?.name}</h3>
                        {station?.vCenter !== null &&
                            station?.type !== "sz" && (
                                <span
                                    style={{
                                        fontSize: "11px",
                                        backgroundColor:
                                            station?.vCenter === true
                                                ? "darkgreen"
                                                : "#BA8E23",
                                        color: "var(--text-color)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        height: "fit-content",
                                        marginTop: "auto",
                                        marginBottom: "auto",
                                        textWrap: "nowrap",
                                    }}
                                >
                                    {station?.vCenter === true
                                        ? "V center"
                                        : "Iz centra"}
                                </span>
                            )}
                    </div>
                    <ul className="station-info">
                        {station?.routes_on_stop
                            ?.slice(0, 6)
                            .map((route, index) => (
                                <li key={index}>
                                    <p>{route}</p>
                                </li>
                            ))}
                        {station?.routes_on_stop?.length > 6 && (
                            <li>
                                <p>+ {station.routes_on_stop.length - 6}</p>
                            </li>
                        )}
                    </ul>
                </div>
                {showDistance && station?.distance && (
                    <span className="distance">
                        {station.distance.toFixed(1)} km
                    </span>
                )}
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
        )
    );

    return (
        <div className="insideDiv">
            <h2>Postaje</h2>
            <input
                type="text"
                placeholder={
                    page === "all"
                        ? "Vnesite vsaj 3 znake..."
                        : "Išči postaje..."
                }
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="top-nav">
                <button
                    className={page === "nearMe" ? "active" : ""}
                    onClick={() => setPage("nearMe")}
                >
                    V bližini
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

            <div className="results station-list">
                {page === "nearMe" && (
                    <>
                        {nearMeStations.length === 0 && (
                            <p className="empty-message">
                                Ni postaj v bližini.
                            </p>
                        )}
                        <ul>
                            {nearMeStations.map((station, index) => (
                                <StationItem
                                    key={`near-${index}`}
                                    station={station}
                                    isLiked={isStationLiked(station)}
                                    onToggleLike={(e) =>
                                        toggleLikeStation(station, e)
                                    }
                                    onSelect={() =>
                                        handleStationSelect(station)
                                    }
                                    showDistance={true}
                                />
                            ))}
                        </ul>
                    </>
                )}

                {page === "all" && (
                    <>
                        {searchTerm.length < 3 && (
                            <p className="empty-message">
                                Vnesite vsaj 3 znake za iskanje.
                            </p>
                        )}
                        {searchTerm.length >= 3 &&
                            filteredAllStations.length === 0 && (
                                <p className="empty-message">Ni rezultatov.</p>
                            )}
                        <ul>
                            {filteredAllStations.map((station, index) => (
                                <StationItem
                                    key={`all-${index}`}
                                    station={station}
                                    isLiked={isStationLiked(station)}
                                    onToggleLike={(e) =>
                                        toggleLikeStation(station, e)
                                    }
                                    onSelect={() =>
                                        handleStationSelect(station)
                                    }
                                    showDistance={false}
                                />
                            ))}
                        </ul>
                    </>
                )}

                {page === "liked" && (
                    <>
                        {filteredLikedStations.length === 0 && (
                            <p className="empty-message">
                                Ni priljubljenih postaj. Kliknite na ❤️ za
                                dodajanje.
                            </p>
                        )}
                        <ul>
                            {filteredLikedStations.map((liked, index) => (
                                <StationItem
                                    key={`liked-${index}`}
                                    station={liked.data}
                                    isLiked={true}
                                    onToggleLike={(e) =>
                                        toggleLikeStation(liked.data, e)
                                    }
                                    onSelect={() =>
                                        handleStationSelect(liked.data)
                                    }
                                    showDistance={false}
                                />
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default StationsTab;
