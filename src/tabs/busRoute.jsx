const BusRouteTab = ({ selectedVehicle }) => {
    return (
        <div className="route">
            <div className="data">
                <h3>{selectedVehicle?.lineName}</h3>
                <p>{selectedVehicle?.operator}</p>
            </div>
            <div className="stops">
                <h2>Postaje na poti:</h2>
                <ul>
                    {selectedVehicle?.stops?.map((stop, index) => (
                        <li key={index}>
                            <h3>{stop.stop_name}</h3>
                            <p>{stop.arrival_time}</p>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default BusRouteTab;
