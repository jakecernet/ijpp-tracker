import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { format, formatDistanceToNow, set, isBefore } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({ activeStation, stopArrivals }) => {
	const [arrivals, setArrivals] = useState([]);
	const [stationSelected, setStationSelected] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [useRelativeTime, setUseRelativeTime] = useState(true);

	useEffect(() => {
		if (stopArrivals.length === 0) return;
		const now = new Date();
		const formattedArrivals = stopArrivals
			.map((arrival) => {
				const [hours, minutes] = arrival.timeArrival
					.split(":")
					.map(Number);
				let arrivalDate = set(now, { hours, minutes, seconds: 0 });

				return {
					routeName: arrival.routeName || "N/A",
					timeArrival: arrivalDate,
					timeDeparture: set(arrivalDate, {
						hours: Number(arrival.timeDeparture.split(":")[0]),
						minutes: Number(arrival.timeDeparture.split(":")[1]),
					}),
					operator: arrival.operator || "N/A",
				};
			})
			.filter((arrival) => arrival.timeArrival > now)
			.sort((a, b) => a.timeArrival.getTime() - b.timeArrival.getTime());
		setArrivals(formattedArrivals);
	}, [stopArrivals]);

	useEffect(() => {
		const activeStationData = JSON.parse(
			localStorage.getItem("activeStation")
		);
		setStationSelected(
			activeStationData && activeStationData.id !== 123456789
		);
	}, [activeStation]);

	const filteredArrivals = useMemo(() => {
		return arrivals.filter((arrival) =>
			arrival.routeName.toLowerCase().includes(searchTerm.toLowerCase())
		);
	}, [arrivals, searchTerm]);

	const formatArrivalTime = (arrivalTime) => {
		const now = new Date();
		const minutesUntilArrival = Math.round(
			(arrivalTime.getTime() - now.getTime()) / (1000 * 60)
		);

		if (useRelativeTime && minutesUntilArrival <= 60) {
			return formatDistanceToNow(arrivalTime, {
				addSuffix: true,
				locale: sl,
			});
		} else {
			return format(arrivalTime, "HH:mm", { locale: sl });
		}
	};

	return (
		<div className="insideDiv">
			<h2>Prihodi na: {activeStation.name}</h2>
			<div className="search-container">
				<input
					type="text"
					placeholder="Išči po številki linije"
					className="search-input"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
				<Search className="search-icon" />
			</div>
			<div className="toggle-container">
				<label>
					<input
						type="checkbox"
						checked={useRelativeTime}
						onChange={() => setUseRelativeTime(!useRelativeTime)}
					/>
					Uporabi relativni čas za bližnje prihode
				</label>
			</div>
			{filteredArrivals.map((arrival, index) => (
				<div key={index} className="arrival-item">
					<h3>{arrival.routeName}</h3>
					<p>Prihod: {formatArrivalTime(arrival.timeArrival)}</p>
					<p>Odhod: {formatArrivalTime(arrival.timeDeparture)}</p>
					<p>Prevoznik: {arrival.operator}</p>
				</div>
			))}
			{!stationSelected && (
				<p className="no-station-selected">
					Ni izbrane postaje. Izberi postajo na zemljevidu.
				</p>
			)}
			{stationSelected && filteredArrivals.length === 0 && (
				<p className="no-arrivals">
					Ni prihajajočih prihodov za izbrano postajo.
				</p>
			)}
		</div>
	);
};

export default ArrivalsTab;
