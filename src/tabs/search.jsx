import React, { useState, useEffect } from "react";

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

    const allStations = [...busStops, ...trainStops];
    const allRoutes = [
        ...new Set(gpsPositions.map((pos) => pos.line)),
        ...new Set(trainPositions.map((pos) => pos.line)),
    ];
    let filtered = [];

    useEffect(() => {
        if (searchTerm.length < 3) {
            filtered = [];
            return;
        }

        const filteredStations = allStations.filter((station) =>
            station?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const filteredRoutes = allRoutes.filter((route) =>
            route?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        filtered = [...filteredStations, ...filteredRoutes];
    }, [searchTerm, allStations, allRoutes]);

    return (
        <div className="insideDiv">
            <h2>Iskanje</h2>
            <div className="top-nav">
                <button>Vse</button>
                <button>Priljubljene</button>
            </div>
            <div className="liked"></div>
            <div className="searching">
                <input
                    type="text"
                    placeholder="Vnesite ime postaje ali aktivne linije..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="config">
                    <div className="element">
                        <input
                            type="checkbox"
                            id="stations"
                            name="stations"
                            checked={stations}
                            onChange={() => setStations(!stations)}
                        />
                        <label htmlFor="stations">Postaje</label>
                    </div>
                    <div className="element">
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
                                    <li
                                        key={index}
                                        className="element"
                                        onClick={() => {
                                            setActiveStation(item);
                                        }}
                                    >
                                        <strong>Postaja:</strong> {item.name}
                                    </li>
                                );
                            }
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default SearchTab;
