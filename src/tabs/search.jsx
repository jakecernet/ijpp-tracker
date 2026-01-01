import { useState, useEffect, useMemo } from "react";
import { Bus } from "lucide-react";

const SearchTab = ({
    gpsPositions,
    busStops,
    trainStops,
    setActiveStation,
    trainPositions,
    setSelectedVehicle,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [stations, setStations] = useState(true);
    const [lines, setLines] = useState(true);
    const [page, setPage] = useState("search");

    const allStations = useMemo(
        () => [...busStops, ...trainStops],
        [busStops, trainStops]
    );
    const allRoutes = useMemo(
        () => [
            ...new Set(gpsPositions.map((pos) => pos.line)),
            ...new Set(trainPositions.map((pos) => pos.line)),
        ],
        [gpsPositions, trainPositions]
    );
    const [filtered, setFiltered] = useState([]);

    useEffect(() => {
        if (searchTerm.length < 3) {
            setFiltered([]);
            return;
        }

        const filteredStations = allStations.filter((station) =>
            station?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredRoutes = allRoutes.filter((route) =>
            route?.toLowerCase().includes(searchTerm.toLowerCase())
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
                                if (typeof item === "string" && lines) {
                                    return (
                                        <li
                                            key={index}
                                            className="element"
                                            onClick={() => {
                                                setSelectedVehicle(item);
                                            }}
                                        >
                                            <strong>Linija:</strong> {item}
                                        </li>
                                    );
                                } else if (item.name && stations) {
                                    return (
                                        <StationItem
                                            key={index}
                                            busStop={item}
                                            onSelect={() => {
                                                setActiveStation(item);
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
