const RouteTab = ({ selectedVehicle, lppRoute, szRoute, ijppTrip, setActiveStation }) => {
    const isLPP = selectedVehicle?.lineNumber != null;
    const isSZ = Boolean(selectedVehicle?.from && selectedVehicle?.to);
    const szTrip = isSZ && Array.isArray(szRoute) ? szRoute[0] : null;
    const szStops = Array.isArray(szTrip?.stops) ? szTrip.stops : [];

    const printTime = (timeStr) => {
        const date = new Date(timeStr);
        return date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    };

    return (
        <div className="route">
            <div className="data">
                <h3>
                    {isLPP ? selectedVehicle?.lineNumber + " | " : ""}
                    {selectedVehicle?.lineName}
                </h3>
                <p>
                    {isLPP
                        ? "Javno podjetje Ljubljanski potniški promet d.o.o."
                        : selectedVehicle?.operator}
                </p>
                {isSZ && (
                    <h3>
                        {szRoute[0]?.tripName} ({szRoute[0]?.shortName})
                    </h3>
                )}
                {isSZ && <p>Slovenske železnice d.o.o.</p>}
            </div>
            {!isSZ && (
                <div className="stops">
                    {isLPP ? (
                        <ul>
                            {lppRoute?.map((stop) => (
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
                        <div className="sz-stops stops">
                            <h3>Postaje na poti:</h3>
                            <ul>
                                <li key="start">
                                    <h4>{szTrip.from.name}</h4>
                                    <span
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                        }}
                                    >
                                        <p>
                                            Odhod:{" "}
                                            {printTime(szTrip.from.departure)}
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
                                <li key="end">
                                    <h4>{szTrip.to.name}</h4>
                                    <span
                                        style={{
                                            display: "flex",
                                            gap: "20px",
                                        }}
                                    >
                                        <p>
                                            Prihod:{" "}
                                            {printTime(szTrip.to.arrival)}
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
