import React, { useEffect, useMemo } from "react";
import { Bus, Train } from "lucide-react";

const calculateDistance = (userLocation, busStops, szStops) => {
    const earthRadius = 6371; // Radius of the Earth in kilometers
    busStops.forEach((busStop) => {
        const lat1 = userLocation[0];
        const lon1 = userLocation[1];
        const lat2 = busStop.gpsLocation[0];
        const lon2 = busStop.gpsLocation[1];
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) *
                Math.cos(toRadians(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;

        busStop.distance = distance;
    });

    szStops.forEach((szStop) => {
        const lat1 = userLocation[0];
        const lon1 = userLocation[1];
        const lat2 = szStop.lat;
        const lon2 = szStop.lon;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;

        szStop.distance = distance;
    });
};

const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
};

const StationItem = React.memo(({ busStop, onSelect }) => (
    <div className="station-item" onClick={onSelect}>
        <Bus size={24} />
        <div>
            <h3>{busStop.name}</h3>
            <p>{busStop.distance?.toFixed(1)} km</p>
        </div>
    </div>
));

const SzStationItem = React.memo(({ szStop, onSelect }) => (
    <div className="station-item" onClick={onSelect}>
        <Train size={24} />
        <div>
            <h3>{szStop.name}</h3>
            <p>{szStop.distance?.toFixed(1)} km</p>
        </div>
    </div>
));

const NearMe = ({
    userLocation,
    setActiveStation,
    busStops,
    szStops,
    setCurentUrl,
}) => {
    useEffect(() => {
        calculateDistance(userLocation, busStops, szStops);
    }, [userLocation, busStops, szStops]);

    const sortedBusStops = useMemo(() => {
        return busStops
            .filter((busStop) => busStop.distance <= 10 && busStop.distance > 0)
            .sort((a, b) => a.distance - b.distance);
    }, [busStops]);

    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredBusStops = useMemo(() => {
        return sortedBusStops.filter((busStop) =>
            busStop.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sortedBusStops, searchTerm]);

    const sortedSzStops = useMemo(() => {
        return szStops
            .filter((szStop) => szStop.distance <= 30 && szStop.distance > 0)
            .sort((a, b) => a.distance - b.distance);
    }, [szStops]);

    const filteredSzStops = useMemo(() => {
        return sortedSzStops.filter((szStop) =>
            szStop.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sortedSzStops, searchTerm]);

    return (
        <div className="insideDiv">
            <h2>Postaje v bližini</h2>
            <input
                className="search-input"
                type="text"
                placeholder="Vnesite ime postaje"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="station-list">
                {filteredBusStops.map((busStop, index) => (
                    <StationItem
                        key={index}
                        busStop={busStop}
                        onSelect={() => {
                            setActiveStation(busStop);
                            window.location.href = "/#/arrivals";
                            localStorage.setItem(
                                "activeStation",
                                JSON.stringify(busStop)
                            );
                            setCurentUrl("/arrivals");
                        }}
                    />
                ))}
                {filteredSzStops.map((szStop, index) => (
                    <SzStationItem
                        key={index}
                        szStop={szStop}
                        onSelect={() => {
                            setActiveStation(szStop);
                            window.location.href = "/#/arrivals";
                            localStorage.setItem(
                                "activeStation",
                                JSON.stringify(szStop)
                            );
                            setCurentUrl("/arrivals");
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default React.memo(NearMe);
