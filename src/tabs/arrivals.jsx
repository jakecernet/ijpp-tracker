import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, set } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({
    activeStation,
    ijppArrivals,
    lppArrivals,
    szArrivals,
    getSzTripFromId,
    setLppRouteFromArrival,
    setIjppRouteFromArrival,
}) => {
    const [stationSelected, setStationSelected] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [error, setError] = useState(null);

    useEffect(() => {
        const activeStationData = JSON.parse(
            localStorage.getItem("activeStation")
        );
        setStationSelected(
            activeStationData && activeStationData.id !== 123456789
        );
    }, [activeStation]);

    // Filtriranje ijpp prihodov
    const filteredArrivals = useMemo(() => {
        return ijppArrivals
            .filter((arrival) =>
                arrival?.tripName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
            )
            .filter(
                (arrival) =>
                    arrival?.operatorName !==
                    "Ljubljanski Potniški Promet"
            );
    }, [ijppArrivals, searchTerm]);

    // Filtriranje sz prihodov
    const filteredSzArrivals = useMemo(() => {
        return szArrivals?.stopTimes?.filter((arrival) =>
            arrival.headsign.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [szArrivals, searchTerm]);

    // Filtriranje lpp prihodov
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

    // Formatiranje zamude za sz prihode
    const formatDelay = (scheduledDeparture, actualDeparture) => {
        if (!scheduledDeparture || !actualDeparture) return "N/A";

        const scheduled = new Date(scheduledDeparture);
        const actual = new Date(actualDeparture);

        if (isNaN(scheduled) || isNaN(actual)) return "N/A";

        const diffMinutes = Math.round((actual - scheduled) / 60000);

        if (diffMinutes === 0) return " 0 min";
        return diffMinutes > 0 ? ` ${diffMinutes} min` : ` -${diffMinutes} min`;
    };

    // Uradna imena --> normalna imena
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
                        <div
                            key={index}
                            className="arrival-item"
                            style={{
                                gridTemplateColumns: "1fr 1fr 1fr",
                                padding: "10px 0",
                            }}
                            onClick={() => {
                                setIjppRouteFromArrival(arrival);
                                window.location.hash = "/route";
                            }}
                        >
                            <h3>{arrival.tripName}</h3>
                            <p>Prihod: {(arrival.realtimeArrival).slice(0, -3)}</p>
                            <p>
                                Prevoznik:{" "}
                                {shortenOperatorName(arrival.operatorName)}
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
                {filteredSzArrivals?.map((arrival, index) => (
                    <div
                        key={index}
                        className="sz-arrival-item arrival-item"
                        onClick={() => {
                            getSzTripFromId(arrival.tripId);
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
