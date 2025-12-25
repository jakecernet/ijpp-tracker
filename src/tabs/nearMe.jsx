import React, { useEffect, useMemo, useState } from "react";
import { Bus, Train } from "lucide-react";

const NearMe = ({ userLocation, setActiveStation, busStops, szStops }) => {
    const toRadians = (degrees) => {
        return degrees * (Math.PI / 180);
    };

    const [distancesCalculated, setDistancesCalculated] = useState(false);
    useEffect(() => {
        setDistancesCalculated(false);

        const calculateDistance = (userLocation, busStops, szStops) => {
            const earthRadius = 6371; // Radius of the Earth in kilometers

            const calculate = (stops) => {
                stops.forEach((stop) => {
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
                    const distance = earthRadius * c;

                    stop.distance = distance;
                });
            };

            calculate(busStops);
            calculate(szStops);

            setDistancesCalculated(true);
        };

        calculateDistance(userLocation, busStops, szStops);
    }, [userLocation, busStops, szStops]);

    const [searchTerm, setSearchTerm] = React.useState("");
    const joinedStops = useMemo(() => {
        return [
            ...busStops.map((stop) => ({ ...stop, type: "bus" })),
            ...szStops.map((stop) => ({ ...stop, type: "sz" })),
        ];
    }, [busStops, szStops]);

    const filteredStops = useMemo(() => {
        if (!distancesCalculated) return [];
        return joinedStops
            .filter((stop) => {
                const maxDistance = stop.type === "bus" ? 30 : 50;
                return stop.distance <= maxDistance && stop.distance > 0;
            })
            .filter((stop) =>
                stop.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.distance - b.distance);
    }, [joinedStops, searchTerm, distancesCalculated]);

    const StationItem = React.memo(({ busStop, onSelect }) => (
        <div className="station-item" onClick={onSelect}>
            <div>
                <Bus size={24} />
                <h3>{busStop.name}</h3>
                <ul>
                    {busStop.routes_on_stop.map((route, index) => (
                        <li key={index}>
                            <p>{route}</p>
                        </li>
                    ))}
                </ul>
            </div>
            <p>{busStop.distance?.toFixed(1)} km</p>
        </div>
    ));

    const SzStationItem = React.memo(({ szStop, onSelect }) => (
        <div className="station-item" onClick={onSelect}>
            <div>
                <Train size={24} />
                <h3>{szStop.name}</h3>
            </div>
            <p>{szStop.distance?.toFixed(1)} km</p>
        </div>
    ));

    return (
        <div className="insideDiv">
            <h2>Postaje v bližini</h2>
            <input
                type="text"
                placeholder="Vnesite ime postaje"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="station-list">
                {filteredStops.map((stop, index) =>
                    stop.type === "bus" ? (
                        <StationItem
                            key={index}
                            busStop={stop}
                            onSelect={() => {
                                setActiveStation(stop);
                                window.location.href = "/#/arrivals";
                                localStorage.setItem(
                                    "activeStation",
                                    JSON.stringify(stop)
                                );
                            }}
                        />
                    ) : (
                        <SzStationItem
                            key={index}
                            szStop={stop}
                            onSelect={() => {
                                setActiveStation(stop);
                                window.location.href = "/#/arrivals";
                                localStorage.setItem(
                                    "activeStation",
                                    JSON.stringify(stop)
                                );
                            }}
                        />
                    )
                )}
            </div>
        </div>
    );
};

export default React.memo(NearMe);
