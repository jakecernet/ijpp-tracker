import { useState, useEffect } from "react";
import { Search } from "lucide-react";

const ArrivalsTab = ({ activeStation, stopArrivals }) => {
	const [arrivals, setArrivals] = useState([]);

	useEffect(() => {
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

	return (
		<div className="insideDiv">
			<h2>Prihodi na: {activeStation.name}</h2>
			<div className="search-container">
				<Search className="search-icon" />
				<input
					type="text"
					placeholder="Išči po številki linije"
					className="search-input"
				/>
			</div>
			{arrivals.map((arrival, index) => (
				Date.parse(arrival.timeArrival) <= Date.now() ? null : (
				<div key={index} className="arrival-item">
					<h3>{arrival.routeName}</h3>
					<p>Prihod: {arrival.timeArrival}</p>
					<p>Odhod: {arrival.timeDeparture}</p>
					<p>Prevoznik: {arrival.operator}</p>
				</div>
				)
			))}
		</div>
	);
};

export default ArrivalsTab;
