const RouteTab = ({
    selectedVehicle,
    lppRoute,
    szRoute,
    ijppTrip,
    setActiveStation,
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerUpOrCancel,
}) => {
    const isLPP = selectedVehicle?.lineNumber != null;
    const isSZ = Boolean(szRoute?.from && szRoute?.to);
    const szStops = Array.isArray(szRoute?.stops) ? szRoute.stops : [];

    const printTime = (timeStr) => {
        const date = new Date(timeStr);
        return date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    const dataText = {
        lineName:
            (isLPP ? selectedVehicle?.lineNumber + " | " : "") +
                selectedVehicle?.lineName || (isSZ ? szRoute?.tripName : ""),
        operator: isLPP
            ? "Javno podjetje Ljubljanski potniški promet d.o.o."
            : selectedVehicle?.operator == null
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
            {!isSZ && (
                <div className="stops">
                    {isLPP ? (
                        <ul>
                            {lppRoute?.stops?.map((stop) => (
                                <li
                                    key={stop.stop_id}
                                    onClick={() => {
                                        console.log("Clicked stop:", stop);
                                        setActiveStation(stop);
                                        localStorage.setItem(
                                            "activeStation",
                                            JSON.stringify(stop)
                                        );
                                        window.location.hash = "/arrivals";
                                    }}
                                >
                                    <h3>{stop.name}</h3>
                                    <span
                                        style={{
                                            display: "flex",
                                            flexDirection: "row",
                                            gap: "20px",
                                        }}
                                    >
                                        {stop.arrivals[0] && (
                                            <p>
                                                {stop.arrivals[0].eta_min} min
                                            </p>
                                        )}
                                        {stop.arrivals[1] && (
                                            <p>
                                                {stop.arrivals[1].eta_min} min
                                            </p>
                                        )}
                                        {stop.arrivals[2] && (
                                            <p>
                                                {stop.arrivals[2].eta_min} min
                                            </p>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul>
                            {(ijppTrip?.stops || []).map((stop, key) => (
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
                                        window.location.hash = "/arrivals";
                                    }}
                                >
                                    <h3>{stop.name}</h3>
                                    <p>{stop.departure.slice(0, -3)}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {isSZ && (
                <div>
                    {szStops.length > 0 && (
                        <div className="stops">
                            <ul>
                                <li
                                    key="start"
                                    onClick={() => {
                                        const stop = szRoute.from;
                                        const coords = Array.isArray(
                                            stop?.gpsLocation
                                        )
                                            ? stop.gpsLocation
                                            : [stop?.lat, stop?.lon];
                                        const payload = {
                                            name: stop?.name,
                                            coordinates: coords,
                                            gpsLocation: coords,
                                            stopId: stop?.stopId ?? null,
                                            id: stop?.stopId || stop?.name,
                                            lat: coords?.[0],
                                            lon: coords?.[1],
                                            type: "train-stop",
                                        };
                                        setActiveStation(payload);
                                        window.location.hash = "/arrivals";
                                    }}
                                >
                                    <h4>{szRoute.from.name}</h4>
                                    <span
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                        }}
                                    >
                                        <p>
                                            Odhod:{" "}
                                            {printTime(szRoute.from.departure)}
                                        </p>
                                    </span>
                                </li>
                                {szStops.map((stop) => (
                                    <li
                                        key={stop.stopId || stop.name}
                                        onClick={() => {
                                            console.log("Clicked stop:", stop);
                                            setActiveStation(stop);
                                            window.location.hash = "/arrivals";
                                        }}
                                    >
                                        <h4>{stop.name}</h4>
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
                                    </li>
                                ))}
                                <li
                                    key="end"
                                    onClick={() => {
                                        const stop = szRoute.to;
                                        const coords = Array.isArray(
                                            stop?.gpsLocation
                                        )
                                            ? stop.gpsLocation
                                            : [stop?.lat, stop?.lon];
                                        const payload = {
                                            name: stop?.name,
                                            coordinates: coords,
                                            gpsLocation: coords,
                                            stopId: stop?.stopId ?? null,
                                            id: stop?.stopId || stop?.name,
                                            lat: coords?.[0],
                                            lon: coords?.[1],
                                            type: "train-stop",
                                        };
                                        setActiveStation(payload);
                                        window.location.hash = "/arrivals";
                                    }}
                                >
                                    <h4>{szRoute.to.name}</h4>
                                    <span
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                        }}
                                    >
                                        <p>
                                            Prihod:{" "}
                                            {printTime(szRoute.to.arrival)}
                                        </p>
                                    </span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RouteTab;
