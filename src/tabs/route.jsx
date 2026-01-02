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
        if (!timeStr) return "";
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
                                    <p>{stop.departure?.slice(0, -3)}</p>
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
                                                {stop.arrivals[0].eta_min} min
                                            </p>
                                        )}
                                        {stop.arrivals?.[1] && (
                                            <p>
                                                {stop.arrivals[1].eta_min} min
                                            </p>
                                        )}
                                        {stop.arrivals?.[2] && (
                                            <p>
                                                {stop.arrivals[2].eta_min} min
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
