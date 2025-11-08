const BusRouteTab = ({ selectedVehicle, lppRoute }) => {
    const isLPP = selectedVehicle?.lineNumber != null;

    return (
        <div className="route">
            <div className="data">
                <h3>
                    {selectedVehicle?.lineNumber} &#32;|&#32;
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
                    {selectedVehicle?.stops?.map((stop, index) => (
                        <li key={index}>
                            <h3>
                                {stop.lineNumber} -{stop.stop_name}
                            </h3>
                            <p>{stop.arrival_time}</p>
                        </li>
                    ))}
                    {isLPP && (
                        <ul>
                            {lppRoute?.map((stop, index) => (
                                <li key={index}>
                                    <h3>
                                        {stop.lineNumber} - {stop.stop_name}
                                    </h3>
                                    <p>{stop.arrival_time}</p>
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
