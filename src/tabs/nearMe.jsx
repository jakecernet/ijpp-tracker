import React, { useEffect, useMemo } from "react";
import { MapPin } from "lucide-react";

const calculateDistance = (userLocation, busStops) => {
	const earthRadius = 6371; // Radius of the Earth in kilometers
	busStops.forEach((busStop) => {
		const lat1 = userLocation[0];
		const lon1 = userLocation[1];
		const lat2 = busStop.gpsLocation[0];
		const lon2 = busStop.gpsLocation[1];
		const dLat = toRadians(lat2 - lat1);
		const dLon = toRadians(lon2 - lon1);

		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(toRadians(lat1)) *
				Math.cos(toRadians(lat2)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = earthRadius * c;

		busStop.distance = distance.toFixed(1);
	});
};

const toRadians = (degrees) => {
	return degrees * (Math.PI / 180);
};

const StationItem = React.memo(({ busStop, onSelect }) => (
	<div className="station-item" onClick={onSelect}>
		<MapPin size={24} />
		<div>
			<h3>{busStop.name}</h3>
			<p>{busStop.distance} km</p>
		</div>
	</div>
));

const NearMe = ({ userLocation, setActiveStation, busStops, setCurentUrl }) => {
	useEffect(() => {
		calculateDistance(userLocation, busStops);
	}, [userLocation, busStops]);

	const sortedBusStops = useMemo(() => {
		return busStops
			.filter((busStop) => busStop.distance <= 10 && busStop.distance > 0)
			.sort((a, b) => a.distance - b.distance);
	}, [busStops]);

	return (
		<div className="insideDiv">
			<h2>Postaje v bližini</h2>
			<p>Prosimo izberite postajo iz seznama ali na zemljevidu.</p>
			{sortedBusStops.map((busStop, index) => (
				<StationItem
					key={index}
					busStop={busStop}
					onSelect={() => {
						setActiveStation(busStop);
						window.location.href = "/#/arrivals";
						localStorage.setItem(
							"activeStation",
							JSON.stringify(busStop)
						);
						setCurentUrl("/arrivals");
					}}
				/>
			))}
		</div>
	);
};

export default React.memo(NearMe);
