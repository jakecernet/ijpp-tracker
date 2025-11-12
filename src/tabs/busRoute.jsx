const BusRouteTab = ({ selectedVehicle, lppRoute }) => {
    const isLPP = selectedVehicle?.lineNumber != null;

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
            </div>
            <div className="stops">
                <h2>Postaje na poti:</h2>
                <ul>
                    {selectedVehicle?.stops?.map((stop, key) => (
                        <li key={key}>
                            <h3>
                                {stop.stop_name}
                            </h3>
                            <p>{stop.arrival_time.slice(0, -3)}</p>
                        </li>
                    ))}
                    {isLPP && (
                        <ul>
                            {lppRoute?.map((stop) => (
                                <li>
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
                    )}
                </ul>
            </div>
        </div>
    );
};

export default BusRouteTab;
