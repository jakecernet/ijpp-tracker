import { useState, useEffect, useMemo } from "react";
import { Bus } from "lucide-react";

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

    useEffect(() => {
        console.log(allRoutes);
        if (searchTerm.length < 3) {
            setFiltered([]);
            return;
        }

        const filteredStations = allStations.filter((station) =>
            station?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredRoutes = allRoutes.filter((route) =>
            (route.lineName || route.route_name || route.lineNumber)
                ?.toLowerCase()
                .includes(searchTerm.toLowerCase())
        );
        setFiltered([...filteredStations, ...filteredRoutes]);
    }, [searchTerm, allStations, allRoutes]);

    const StationItem = ({ busStop, onSelect }) => (
        <div className="station-item-search" onClick={onSelect}>
            <div>
                <Bus size={24} />
                <h3>{busStop?.name}</h3>
                <ul>
                    {busStop?.routes_on_stop?.map((route, index) => (
                        <li key={index}>
                            <p>{route}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    const RouteItem = ({ item }) => (
        <div
            className="route-item"
            onClick={() => {
                getTripFromId(item, item.type);
                try {
                    sessionStorage.setItem("openRouteDrawer", "1");
                } catch {}
                window.location.hash = "/map";
            }}
        >
            <div
                className="circle"
                style={{
                    background: bgColorMap(item),
                }}
            >
                {item.lineNumber ?? item.tripId.slice(5)}
            </div>
            <h3>{item.lineName || item.headsign}</h3>
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
            {page === "liked" && <div className="liked"></div>}
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
                                            key={index}
                                            item={item}
                                            onSelect={() => {
                                                getTripFromId(
                                                    item,
                                                    item.operator.includes(
                                                        "Slovenske železnice"
                                                    )
                                                        ? "SZ"
                                                        : item.operator.includes(
                                                              "Ljubljanski potniški promet"
                                                          )
                                                        ? "LPP"
                                                        : "IJPP"
                                                );
                                                try {
                                                    sessionStorage.setItem(
                                                        "openRouteDrawer",
                                                        "1"
                                                    );
                                                } catch {}
                                                window.location.hash = "/map";
                                            }}
                                        />
                                    );
                                } else if (item.name && stations) {
                                    return (
                                        <StationItem
                                            key={index}
                                            busStop={item}
                                            onSelect={() => {
                                                setActiveStation(item);
                                                window.location.hash =
                                                    "/arrivals";
                                            }}
                                        />
                                    );
                                }
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchTab;
