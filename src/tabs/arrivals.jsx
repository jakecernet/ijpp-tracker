import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, set } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({ activeStation, stopArrivals, lppArrivals }) => {
    const [arrivals, setArrivals] = useState([]);
    const [stationSelected, setStationSelected] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        if (stopArrivals.length === 0) return;
        const now = new Date();
        try {
            const formattedArrivals = stopArrivals
                .map((arrival) => {
                    let arrivalDate = null;
                    let departureDate = null;

                    if (arrival.timeArrival == null) {
                        arrival.timeArrival = arrival.timeDeparture;
                    }

                    if (arrival.timeDeparture == null) {
                        arrival.timeDeparture = arrival.timeArrival;
                    }

                    if (arrival.timeArrival) {
                        const [hours, minutes] = arrival.timeArrival
                            .split(":")
                            .map(Number);
                        arrivalDate = set(now, { hours, minutes, seconds: 0 });
                    }

                    if (arrival.timeDeparture) {
                        const [depHours, depMinutes] = arrival.timeDeparture
                            .split(":")
                            .map(Number);
                        departureDate = set(arrivalDate || now, {
                            hours: depHours,
                            minutes: depMinutes,
                            seconds: 0,
                        });
                    }

                    return {
                        routeName: arrival.routeName || "N/A",
                        timeArrival: arrivalDate,
                        timeDeparture: departureDate,
                        operator: arrival.operator || "N/A",
                    };
                })
                .filter((item) => !item.timeArrival || item.timeArrival > now)
                .sort((a, b) => {
                    if (!a.timeArrival && !b.timeArrival) return 0;
                    if (!a.timeArrival) return 1;
                    if (!b.timeArrival) return -1;
                    return a.timeArrival.getTime() - b.timeArrival.getTime();
                });
            setArrivals(formattedArrivals);
            setError(null);
        } catch (err) {
            console.error("Error processing arrivals:", err);
            setError("Napaka pri obdelavi podatkov o prihodih.");
        }
    }, [stopArrivals]);

    useEffect(() => {
        const activeStationData = JSON.parse(
            localStorage.getItem("activeStation")
        );
        setStationSelected(
            activeStationData && activeStationData.id !== 123456789
        );
    }, [activeStation]);

    const filteredArrivals = useMemo(() => {
        return arrivals.filter((arrival) =>
            arrival.routeName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [arrivals, searchTerm]);

    const formatArrivalTime = (arrivalTime) => {
        if (!arrivalTime) return "N/A";
        return format(arrivalTime, "HH:mm", { locale: sl });
    };

    const formatRelativeTime = (arrivalTime) => {
        if (!arrivalTime) return "N/A";
        return formatDistanceToNow(arrivalTime, {
            addSuffix: false,
            locale: sl,
        });
    };

    const shortenOperatorName = (operator) => {
        switch (operator) {
            case "Javno podjetje Ljubljanski potniški promet d.o.o.":
                return "LPP";
            case "Arriva d.o.o.":
                return "Arriva";
            case "Nomago d.o.o.":
                return "Nomago";
            case "Avtobusni promet Murska Sobota d.d.":
                return "AP Murska Sobota";
            default:
                return operator;
        }
    };

    return (
        <div className="insideDiv">
            <h2>Prihodi na: {activeStation.name}</h2>
            <div>
                <input
                    type="text"
                    placeholder="Išči po številki linije"
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {error && <p>{error}</p>}
            <div className="arrival-list">
                {!error &&
                    filteredArrivals.map((arrival, index) => (
                        <div key={index} className="arrival-item">
                            <h3>{arrival.routeName}</h3>
                            <>
                                Prihod: {formatArrivalTime(arrival.timeArrival)}{" "}
                                ({formatRelativeTime(arrival.timeArrival)})
                            </>
                            <p>
                                Prevoznik:{" "}
                                {shortenOperatorName(arrival.operator)}
                            </p>
                        </div>
                    ))}
                {!stationSelected && (
                    <p>Ni izbrane postaje. Izberi postajo na zemljevidu.</p>
                )}
                {stationSelected && !error && filteredArrivals.length === 0 && (
                    <p>Ni prihajajočih prihodov za izbrano postajo.</p>
                )}
            </div>
            <div className="lpp-arrivals-list">
                {!error &&
                    lppArrivals.map((arrival, index) => (
                        <div key={index} className="arrival-item">
                            <h3>{arrival.routeName}</h3>
                            <>Prihod: {formatArrivalTime(arrival.timeArrival)} ({formatRelativeTime(arrival.timeArrival)})</>
                            <p>
                                Prevoznik: LPP
                            </p>
                        </div>
                    ))}
                {!stationSelected && (
                    <p>Ni prihajajočih prihodov za izbrano postajo.</p>
                )}
            </div>
        </div>
    );
};

export default ArrivalsTab;
