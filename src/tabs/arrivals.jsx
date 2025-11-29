import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, set } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({
    activeStation,
    stopArrivals,
    lppArrivals,
    szArrivals,
    getSzTripFromId,
    setCurrentUrl,
    setLppRouteFromArrival,
}) => {
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

    const filteredSzArrivals = useMemo(() => {
        return szArrivals?.stopTimes?.filter((arrival) =>
            arrival.headsign.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [szArrivals, searchTerm]);

    const filteredLPPArrivals = useMemo(() => {
        return lppArrivals.filter(
            (arrival) =>
                arrival.tripName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                arrival.routeName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
        );
    }, [lppArrivals, searchTerm]);

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

    const formatDelay = (scheduledDeparture, actualDeparture) => {
        if (!scheduledDeparture || !actualDeparture) return "N/A";

        const scheduled = new Date(scheduledDeparture);
        const actual = new Date(actualDeparture);

        if (isNaN(scheduled) || isNaN(actual)) return "N/A";

        const diffMinutes = Math.round((actual - scheduled) / 60000);

        if (diffMinutes === 0) return " 0 min";
        return diffMinutes > 0 ? ` ${diffMinutes} min` : ` -${diffMinutes} min`;
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
            <input
                type="text"
                placeholder="Išči po številki linije"
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                {!error &&
                    filteredLPPArrivals.map((arrival, index) => (
                        <div
                            key={index}
                            className="lpp-arrival-item arrival-item"
                            onClick={() => {
                                setLppRouteFromArrival(arrival);
                                setCurrentUrl("/route");
                                window.location.hash = "/route";
                            }}
                        >
                            <div className="left">
                                <div className="circle">
                                    {arrival.routeName}
                                </div>
                                <h3>{arrival.tripName}</h3>
                            </div>
                            <h3>{arrival.etaMinutes} min</h3>
                            <p>LPP</p>
                        </div>
                    ))}
                {!stationSelected && (
                    <p>Ni prihajajočih prihodov za izbrano postajo.</p>
                )}
                {filteredSzArrivals?.map((arrival, index) => (
                    <div
                        key={index}
                        className="sz-arrival-item arrival-item"
                        onClick={() => {
                            getSzTripFromId(arrival.tripId);
                            setCurrentUrl("/route");
                            window.location.hash = "/route";
                        }}
                    >
                        <h2>{arrival.headsign}</h2>
                        <h2>
                            {formatArrivalTime(arrival.place.departure)} (
                            {formatRelativeTime(arrival.place.departure)})
                        </h2>
                        <p>
                            Zamuda:
                            {formatDelay(
                                arrival.place.scheduledDeparture,
                                arrival.place.departure
                            )}
                        </p>
                        <p>SŽ - Potniški promet d.o.o.</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ArrivalsTab;
