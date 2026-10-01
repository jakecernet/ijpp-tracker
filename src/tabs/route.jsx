import { memo, useMemo } from "react";
import { distanceMeters } from "../utils/geo";
import {
	clockToDate,
	formatEta,
	formatHHmm,
	minutesUntil,
} from "../utils/time";

const SNAP_DISTANCE_LPP_M = 700;
const SNAP_DISTANCE_OTHER_M = 1500;

const normalizeStr = (value) =>
	typeof value === "string" ? value.trim().toLowerCase() : value;

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Izbere avtobuse, ki vozijo isto linijo (v isto smer) kot izbrana vožnja. */
function findSameLineBuses(gpsPositions, vehicle, isLPP, isSZ) {
	if (isLPP) {
		// lineId je specifičen za smer/varianto linije, zato z njim izločimo
		// avtobuse v nasprotni smeri. Brez njega uporabimo širši lineNumber.
		if (vehicle.lineId != null) {
			return gpsPositions.filter((pos) =>
				sameId(pos.lineId, vehicle.lineId),
			);
		}
		if (vehicle.lineNumber != null) {
			return gpsPositions.filter((pos) =>
				sameId(pos.lineNumber, vehicle.lineNumber),
			);
		}
		return [];
	}
	if (!isSZ && vehicle.tripName) {
		// IJPP nima ID-ja linije; isto smer prepoznamo po istem "headsign".
		const headsign = normalizeStr(vehicle.tripName);
		return gpsPositions.filter(
			(pos) =>
				pos.vehicleId != null &&
				normalizeStr(pos.lineName) === headsign,
		);
	}
	return [];
}

/**
 * LPP podaja prihode kot "čez N minut" OD TRENUTKA PRENOSA. Zato čas računamo
 * od `fetchedAt`, sicer bi se ura prihoda ob vsakem ponovnem izrisu pomikala.
 */
function lppArrivalLabel(arrival, fetchedAt, now) {
	if (arrival?.eta_min === undefined) return "";
	const date = new Date((fetchedAt ?? now) + arrival.eta_min * 60000);
	return formatEta(minutesUntil(date, now), formatHHmm(date));
}

/** Za IJPP ("HH:MM:SS", ure so lahko ≥ 24) in SŽ (ISO niz). */
function timeLabel(value, now) {
	if (!value) return "";
	const date = /^\d{1,3}:\d{2}/.test(value)
		? clockToDate(value, new Date(now))
		: new Date(value);
	if (!date || Number.isNaN(date.getTime())) return "";
	return formatEta(minutesUntil(date, now), formatHHmm(date));
}

function ArrivalTimes({ children }) {
	return <span className="stop__times">{children}</span>;
}

const RouteTab = ({
	selectedVehicle,
	gpsPositions,
	onSelectStation,
	dragHandlers,
}) => {
	const isLPP = selectedVehicle?.isLPP;
	const isSZ = selectedVehicle?.isSZ;

	const stops = useMemo(
		() => selectedVehicle?.stops || [],
		[selectedVehicle?.stops],
	);

	// Sorodne avtobuse pripnemo na najbližjo postajo poti (za časovnico s pikami).
	const busesByStopIndex = useMemo(() => {
		const result = {};
		if (!gpsPositions?.length || !stops.length) return result;

		const candidates = findSameLineBuses(
			gpsPositions,
			selectedVehicle,
			isLPP,
			isSZ,
		);
		const snapDistance = isLPP
			? SNAP_DISTANCE_LPP_M
			: SNAP_DISTANCE_OTHER_M;

		candidates.forEach((bus, idx) => {
			let bestIndex = -1;
			let bestDist = Infinity;
			stops.forEach((stop, stopIndex) => {
				const d = distanceMeters(bus.gpsLocation, stop.gpsLocation);
				if (d < bestDist) {
					bestDist = d;
					bestIndex = stopIndex;
				}
			});
			if (bestIndex === -1 || bestDist > snapDistance) return;

			(result[bestIndex] ??= []).push({
				key: bus.tripId || bus.vehicleId || bus.registrska || idx,
				isSelf:
					!!selectedVehicle?.tripId &&
					bus.tripId === selectedVehicle.tripId,
				label:
					bus.registrska ||
					bus.lineDestination ||
					bus.lineName ||
					"Bus",
			});
		});

		return result;
	}, [gpsPositions, stops, isLPP, isSZ, selectedVehicle]);

	// Postaja, pri kateri je trenutno IZBRANI avtobus (če imamo njegovo živo lokacijo).
	const selfStopIndex = useMemo(() => {
		for (const [idx, buses] of Object.entries(busesByStopIndex)) {
			if (buses.some((bus) => bus.isSelf)) return Number(idx);
		}
		return null;
	}, [busesByStopIndex]);

	// Ali imamo podatek "passed" (samo IJPP)?
	const hasPassedData = useMemo(
		() => stops.some((stop) => stop.passed !== undefined),
		[stops],
	);

	// Pri SŽ ni podatka "passed": trenutna postaja je prva, katere čas še ni potekel.
	const szCurrentIndex = useMemo(() => {
		if (!isSZ) return null;
		const now = Date.now();
		const index = stops.findIndex((stop) => {
			const time = new Date(stop?.departure || stop?.arrival).getTime();
			return Number.isFinite(time) && time > now;
		});
		return index === -1 ? null : index;
	}, [isSZ, stops]);

	const now = Date.now();
	const lineName =
		(isLPP ? `${selectedVehicle?.lineNumber} | ` : "") +
		(selectedVehicle?.tripName ?? "");
	const operator = isLPP
		? "Ljubljanski potniški promet"
		: isSZ
			? "Slovenske železnice"
			: selectedVehicle?.operator === "MP_Kranj"
				? "Mestni promet Kranj"
				: selectedVehicle?.operator;

	const selectStop = (stop) =>
		onSelectStation({
			name: stop.name,
			coordinates: stop.gpsLocation,
			id: stop.gtfsId || stop.stopId || stop.name,
			gtfs_id: stop.gtfsId,
			gtfsId: stop.gtfsId,
			stopId: stop.stopId,
			station_code: stop.stopId,
			type: isSZ ? "train-stop" : "bus-stop",
		});

	return (
		<div className="route">
			<div className="data" {...dragHandlers}>
				<h3>{lineName || "Neznana linija"}</h3>
				<p>{operator}</p>
			</div>
			<div className="stops">
				{stops.length === 0 ? (
					<p className="stops__empty">Ni podatkov o postajah.</p>
				) : (
					<ul>
						{stops.map((stop, index) => {
							const isFirst = index === 0;
							const isLast = index === stops.length - 1;
							const isPassed =
								stop.passed === true ||
								(isSZ &&
									szCurrentIndex !== null &&
									index < szCurrentIndex);
							let isCurrent = false;
							if (selfStopIndex !== null)
								isCurrent = index === selfStopIndex;
							else if (isSZ) isCurrent = index === szCurrentIndex;
							else if (hasPassedData) {
								isCurrent =
									!isPassed &&
									(isFirst ||
										stops[index - 1]?.passed === true);
							}
							const busesHere = (
								busesByStopIndex[index] || []
							).filter((bus) => !bus.isSelf);

							const className = [
								"stop",
								isFirst && "stop--first",
								isLast && "stop--last",
								isPassed && "stop--passed",
								isCurrent && "stop--current",
							]
								.filter(Boolean)
								.join(" ");

							return (
								<li
									key={`${stop.gtfsId || stop.stopId || "stop"}-${index}`}
									className={className}>
									<button
										type="button"
										className="stop__button"
										onClick={() => selectStop(stop)}>
										<span
											className="stop__track"
											aria-hidden="true">
											<span className="stop__dot" />
											{busesHere.length > 0 && (
												<span className="stop__buses">
													{busesHere.map((bus) => (
														<span
															key={bus.key}
															className="stop__bus"
															title={bus.label}
														/>
													))}
												</span>
											)}
										</span>
										<h3>{stop.name}</h3>
										{!isLPP && !isSZ && (
											<ArrivalTimes>
												<p>
													{timeLabel(
														stop.departure,
														now,
													)}
												</p>
											</ArrivalTimes>
										)}
										{isLPP && (
											<ArrivalTimes>
												{[0, 1].map(
													(i) =>
														stop.arrivals?.[i] && (
															<p key={i}>
																{lppArrivalLabel(
																	stop
																		.arrivals[
																		i
																	],
																	selectedVehicle.fetchedAt,
																	now,
																)}
															</p>
														),
												)}
											</ArrivalTimes>
										)}
										{isSZ && (
											<ArrivalTimes>
												<p>
													{timeLabel(
														stop.departure ||
															stop.arrival,
														now,
													)}
												</p>
											</ArrivalTimes>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
};

export default memo(RouteTab);
