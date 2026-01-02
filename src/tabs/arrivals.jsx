import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({
    activeStation,
    ijppArrivals,
    lppArrivals,
    szArrivals,
    getTripFromId,
}) => {
    const [searchTerm, setSearchTerm] = useState("");

    // Filtriranje ijpp prihodov
    const filteredArrivals = useMemo(() => {
        console.log("IJPP Arrivals:", ijppArrivals);
        return ijppArrivals
            .filter((arrival) =>
                arrival?.tripName
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
            )
            .filter(
                (arrival) =>
                    arrival?.operatorName !== "Ljubljanski Potniški Promet"
            );
    }, [ijppArrivals, searchTerm]);

    // Filtriranje sz prihodov
    const filteredSzArrivals = useMemo(() => {
        return szArrivals?.filter((arrival) =>
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

    const allArrivals = [
        ...filteredArrivals.map((arrival) => ({ ...arrival, type: "IJPP" })),
        ...filteredLPPArrivals.map((arrival) => ({
            ...arrival,
            type: "LPP",
        })),
        ...(filteredSzArrivals?.map((arrival) => ({
            ...arrival,
            type: "SZ",
        })) ?? []),
    ];

    const bgColorMap = (arrival) => {
        const operator = arrival?.operator || arrival?.operatorName;
        if (arrival.type === "LPP") return "var(--lpp-color)";
        if (arrival.type === "SZ") return "var(--sz-color)";

        if (operator?.includes("Nomago")) return "var(--nomago-color)";
        if (operator?.includes("Marprom")) return "var(--marprom-color)";
        if (operator?.includes("Arriva")) return "var(--arriva-color)";
        if (operator?.includes("Murska")) return "var(--murska-color)";

        return "var(--default-color)";
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
            <div className="arrival-list">
                    {allArrivals.map((arrival, index) => (
                        <div
                            key={index}
                            className="arrival-item"
                            onClick={async () => {
                                const route = await getTripFromId(
                                    arrival,
                                    arrival.type
                                );
                                if (route) {
                                    try {
                                        sessionStorage.setItem(
                                            "openRouteDrawer",
                                            "1"
                                        );
                                    } catch {}
                                    window.location.hash = "/map";
                                }
                            }}
                        >
                            <div className="left">
                                <div
                                    className="circle"
                                    style={{
                                        background: bgColorMap(arrival),
                                    }}
                                >
                                    <h2
                                        style={{
                                            fontSize:
                                                arrival.type === "SZ" ? 16 : 20,
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {arrival.type === "LPP"
                                            ? arrival.routeName
                                            : arrival.routeShortName ||
                                              arrival.tripName}
                                    </h2>
                                </div>
                                <h3>{arrival.tripName || arrival.headsign}</h3>
                            </div>
                            <p>
                                {arrival.type === "SZ"
                                    ? formatArrivalTime(
                                          arrival?.actualDeparture ||
                                              arrival.scheduledDeparture
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
                    ))}
            </div>
        </div>
    );
};

export default ArrivalsTab;
