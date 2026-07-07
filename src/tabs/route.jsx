import { formatTime } from "../Api.jsx";

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

	// Formats arrival for LPP { eta_min } objects or IJPP "HH:MM:SS" strings
	const formatArrivalTime = (arrival) => {
		if (!arrival) return "";
		let etaMin, date;

		if (typeof arrival === "object" && arrival.eta_min !== undefined) {
			etaMin = arrival.eta_min;
			date = new Date(Date.now() + etaMin * 60000);
		} else if (
			typeof arrival === "string" &&
			arrival.match(/^\d{2}:\d{2}(:\d{2})?$/)
		) {
			const today = new Date().toISOString().split("T")[0];
			date = new Date(`${today}T${arrival}`);
			if (!isNaN(date))
				etaMin = Math.max(0, Math.round((date - Date.now()) / 60000));
		}

		if (etaMin === undefined) return "";
		const timeStr = date && !isNaN(date) ? formatTime(date) : "N/A";
		return etaMin >= 60
			? `${Math.floor(etaMin / 60)}h ${etaMin % 60}m (${timeStr})`
			: `${etaMin} min (${timeStr})`;
	};

	const lineName =
		(isLPP ? selectedVehicle?.lineNumber + " | " : "") +
		selectedVehicle?.tripName;
	const operator = isLPP
		? "Ljubljanski potniški promet"
		: isSZ
			? "Slovenske železnice"
			: selectedVehicle?.operator == "MP_Kranj"
				? "Mestni promet Kranj"
				: selectedVehicle?.operator;

	return (
		<div className="route">
			<div
				className="data"
				onPointerDown={onDragPointerDown}
				onPointerMove={onDragPointerMove}
				onPointerUp={onDragPointerUpOrCancel}
				onPointerCancel={onDragPointerUpOrCancel}>
				<h3>{lineName || "Neznana linija"}</h3>
				<p>{operator}</p>
			</div>
			<div className="stops">
				<ul>
					{stops.length > 0 ? (
						stops.map((stop, key) => (
							<li
								key={stop.gtfsId || stop.stopId || key}
								onClick={() => {
									const payload = {
										name: stop.name,
										coordinates: stop.gpsLocation,
										id:
											stop.gtfsId ||
											stop.stopId ||
											stop.name,
										gtfs_id: stop.gtfsId,
										gtfsId: stop.gtfsId,
										stopId: stop.stopId,
										station_code: stop.stopId,
										type: isSZ ? "train-stop" : "bus-stop",
									};
									setActiveStation(payload);
									localStorage.setItem(
										"activeStation",
										JSON.stringify(payload),
									);
									window.location.hash = "/lines";
								}}>
								<h3>{stop.name}</h3>
								{!isLPP && !isSZ && (
									<p>{formatArrivalTime(stop?.departure)}</p>
								)}
								{isLPP && (
									<span
										style={{
											display: "flex",
											flexDirection: "row",
											gap: "20px",
										}}>
										{stop.arrivals?.[0] && (
											<p>
												{formatArrivalTime(
													stop.arrivals[0],
												)}
											</p>
										)}
										{stop.arrivals?.[1] && (
											<p>
												{formatArrivalTime(
													stop.arrivals[1],
												)}
											</p>
										)}
										{stop.arrivals?.[2] && (
											<p>
												{formatArrivalTime(
													stop.arrivals[2],
												)}
											</p>
										)}
									</span>
								)}
								{isSZ && (
									<span
										style={{
											display: "flex",
											gap: "20px",
										}}>
										{stop.arrival && (
											<p>
												Prihod:{" "}
												{formatTime(stop.arrival)}
											</p>
										)}
										{stop.departure && (
											<p>
												Odhod:{" "}
												{formatTime(stop.departure)}
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
