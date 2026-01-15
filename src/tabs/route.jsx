const RouteTab = ({
    selectedVehicle,
    setActiveStation,
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerUpOrCancel,
}) => {
    const isLPP = selectedVehicle?.isLPP;
    const isSZ = selectedVehicle?.isSZ;

    const stops = selectedVehicle?.stops || [];

    const printTime = (timeStr) => {
        if (!timeStr) return "N/A";
        try {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return "N/A";
            return date.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        } catch {
            return "N/A";
        }
    };

    const formatArrivalTime = (arrival) => {
        if (!arrival) return "";

        let etaMin = arrival.eta_min;
        let actualTime = arrival.estimated_arrival_time || arrival.arrival_time || arrival;

        let actualDate = null;
        if (actualTime) {
            actualDate = new Date(actualTime);
            // If parsing failed or if it looks like a time-only string, try prepending today's date
            if (
                isNaN(actualDate.getTime()) &&
                typeof actualTime === "string" &&
                actualTime.match(/^\d{2}:\d{2}(:\d{2})?$/)
            ) {
                const today = new Date().toISOString().split("T")[0];
                actualDate = new Date(`${today}T${actualTime}`);
            }
        }

        if (actualDate && isNaN(actualDate.getTime())) {
            actualDate = null;
        }

        // Generate ETA if missing
        if (etaMin === undefined && actualDate) {
            const now = new Date();
            etaMin = Math.max(
                0,
                Math.round((actualDate.getTime() - now.getTime()) / 60000)
            );
        }

        // Generate actual time if missing
        if (!actualDate && etaMin !== undefined) {
            actualDate = new Date(new Date().getTime() + etaMin * 60000);
        }

        const timeStr = actualDate ? printTime(actualDate) : "N/A";
        return `${etaMin ?? "?"} min (${timeStr})`;
    };

    const dataText = {
        lineName:
            (isLPP ? selectedVehicle?.lineNumber + " | " : "") +
            selectedVehicle?.tripName,
        operator: isLPP
            ? "Ljubljanski potniški promet"
            : isSZ
            ? "Slovenske železnice"
            : selectedVehicle?.operator,
    };

    return (
        <div className="route">
            <div
                className="data"
                onPointerDown={onDragPointerDown}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerUpOrCancel}
                onPointerCancel={onDragPointerUpOrCancel}
            >
                <h3>{dataText.lineName || "Neznana linija"}</h3>
                <p>{dataText.operator}</p>
            </div>
            <div className="stops">
                <ul>
                    {stops.length > 0 ? (
                        stops.map((stop, key) => (
                            <li
                                key={stop.gtfsId || key}
                                onClick={() => {
                                    const payload = {
                                        name: stop.name,
                                        coordinates: stop.gpsLocation,
                                        id: stop.gtfsId || stop.name,
                                        gtfs_id: stop.gtfsId,
                                        gtfsId: stop.gtfsId,
                                    };
                                    setActiveStation(payload);
                                    localStorage.setItem(
                                        "activeStation",
                                        JSON.stringify(payload)
                                    );
                                    window.location.hash = "/lines";
                                }}
                            >
                                <h3>{stop.name}</h3>
                                {!isLPP && !isSZ && (
                                    <p>{formatArrivalTime(stop?.departure)}</p>
                                )}
                                {isLPP && (
                                    <span
                                        style={{
                                            display: "flex",
                                            flexDirection: "row",
                                            gap: "20px",
                                        }}
                                    >
                                        {stop.arrivals?.[0] && (
                                            <p>
                                                {formatArrivalTime(
                                                    stop.arrivals[0]
                                                )}
                                            </p>
                                        )}
                                        {stop.arrivals?.[1] && (
                                            <p>
                                                {formatArrivalTime(
                                                    stop.arrivals[1]
                                                )}
                                            </p>
                                        )}
                                        {stop.arrivals?.[2] && (
                                            <p>
                                                {formatArrivalTime(
                                                    stop.arrivals[2]
                                                )}
                                            </p>
                                        )}
                                    </span>
                                )}
                                {isSZ && (
                                    <span
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                        }}
                                    >
                                        {stop.arrival && (
                                            <p>
                                                Prihod:{" "}
                                                {printTime(stop.arrival)}
                                            </p>
                                        )}
                                        {stop.departure && (
                                            <p>
                                                Odhod:{" "}
                                                {printTime(stop.departure)}
                                            </p>
                                        )}
                                    </span>
                                )}
                            </li>
                        ))
                    ) : (
                        <p>Ni podatkov o postajah.</p>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default RouteTab;
