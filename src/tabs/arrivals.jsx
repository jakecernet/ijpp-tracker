import { useState, useEffect } from "react";
import { Search } from "lucide-react";

const ArrivalsTab = ({ activeStation, stopArrivals }) => {
	const [arrivals, setArrivals] = useState([]);
	const [stationSelected, setStationSelected] = useState(false);

	useEffect(() => {
		if (stopArrivals.length === 0) return;
		const formattedArrivals = stopArrivals.map((arrival) => ({
			routeName: arrival.routeName ? arrival.routeName : "N/A",
			timeArrival: arrival.timeArrival ? arrival.timeArrival : "N/A",
			timeDeparture: arrival.timeDeparture
				? arrival.timeDeparture
				: "N/A",
			operator: arrival.operator ? arrival.operator : "N/A",
		}));
		setArrivals(formattedArrivals);
	}, [stopArrivals]);

	useEffect(() => {
		if (JSON.parse(localStorage.getItem("activeStation")).id == 123456789) {
			setStationSelected(true);
		}
	}, [activeStation]);

	return (
		<div className="insideDiv">
			<h2>Prihodi na: {activeStation.name}</h2>
			<div className="search-container">
				<input
					type="text"
					placeholder="Išči po številki linije"
					className="search-input"
				/>
				<Search className="search-icon" />
			</div>
			{arrivals.map((arrival, index) =>
				Date.parse(arrival.timeArrival) <= Date.now() ? null : (
					<div key={index} className="arrival-item">
						<h3>{arrival.routeName}</h3>
						<p>Prihod: {arrival.timeArrival}</p>
						<p>Odhod: {arrival.timeDeparture}</p>
						<p>Prevoznik: {arrival.operator}</p>
					</div>
				)
			)}
			{stationSelected ? null : (
				<p className="no-station-selected">
					Ni izbrane postaje. Izberi postajo na zemljevidu.
				</p>
			)}
		</div>
	);
};

export default ArrivalsTab;
