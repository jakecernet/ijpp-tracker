import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { format, formatDistanceToNow, parseISO, set, isBefore } from "date-fns";
import { sl } from "date-fns/locale";

const ArrivalsTab = ({ activeStation, stopArrivals }) => {
	const [arrivals, setArrivals] = useState([]);
	const [stationSelected, setStationSelected] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [useRelativeTime, setUseRelativeTime] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		if (stopArrivals.length === 0) return;
		const now = new Date();
		try {
			const formattedArrivals = stopArrivals
				.map((arrival) => {
					let arrivalDate = null;
					let departureDate = null;

					if (arrival.timeArrival) {
						const [hours, minutes] = arrival.timeArrival.split(":").map(Number);
						arrivalDate = set(now, { hours, minutes, seconds: 0 });
					}

					if (arrival.timeDeparture) {
						const [depHours, depMinutes] = arrival.timeDeparture.split(":").map(Number);
						departureDate = set(arrivalDate || now, {
							hours: depHours,
							minutes: depMinutes,
							seconds: 0,
						});
					}

					return {
						routeName: arrival.routeName || "N/A",
						timeArrival: arrivalDate,
						timeDeparture: departureDate,
						operator: arrival.operator || "N/A",
					};
				})
				.filter((item) => !item.timeArrival || item.timeArrival > now)
				.sort((a, b) => {
					if (!a.timeArrival && !b.timeArrival) return 0;
					if (!a.timeArrival) return 1;
					if (!b.timeArrival) return -1;
					return a.timeArrival.getTime() - b.timeArrival.getTime();
				});
			setArrivals(formattedArrivals);
			setError(null);
		} catch (err) {
			console.error("Error processing arrivals:", err);
			setError("Napaka pri obdelavi podatkov o prihodih.");
		}
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
		if (!arrivalTime) return "N/A";

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
			{error && <p className="error-message">{error}</p>}
			{!error &&
				filteredArrivals.map((arrival, index) => (
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
			{stationSelected && !error && filteredArrivals.length === 0 && (
				<p className="no-arrivals">
					Ni prihajajočih prihodov za izbrano postajo.
				</p>
			)}
		</div>
	);
};

export default ArrivalsTab;
