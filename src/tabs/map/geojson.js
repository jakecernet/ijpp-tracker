// Čiste funkcije, ki pripravijo GeoJSON za posamezne vire zemljevida.
// Ločene od komponente, da jih je mogoče testirati brez WebGL-ja.
import { getInterpolatedPosition } from "../../Api";
import { isLppOperator, isSzOperator } from "../../utils/operators";
import { operatorToIcon } from "./config";
import { getStopCoord, parseTrainCoord, stopsToFeatures, toGeoJSONPoints } from "./utils";

/** Ali izbrana vožnja pripada vlaku (SŽ)? */
export function isTrainRoute(vehicle) {
	if (!vehicle) return false;
	return (
		vehicle.brand === "sz" ||
		isSzOperator(vehicle.operator) ||
		(vehicle.tripShort != null &&
			vehicle.lineNumber == null &&
			vehicle.lineId == null)
	);
}

/** Ali avtobus `pos` pripada izbrani vožnji? (Samo za avtobuse z znano linijo ali vožnjo.) */
function busMatchesRoute(pos, selected) {
	const hasLine = pos.lineNumber !== undefined || pos.lineId !== undefined;
	if (hasLine) {
		return Boolean(
			(selected.lineNumber && pos.lineNumber === selected.lineNumber) ||
			(selected.routeName && pos.lineNumber === selected.routeName) ||
			(selected.tripId && pos.tripId === selected.tripId),
		);
	}
	return !(
		pos.tripId !== undefined &&
		selected.tripId &&
		pos.tripId !== selected.tripId
	);
}

export function buildBusesGeoJSON(gpsPositions, busOperators, selectedRoute) {
	const filtered = (gpsPositions || []).filter((pos) => {
		const brandKey = operatorToIcon[pos?.operator] || "generic";
		if (!busOperators[brandKey]) return false;
		return !selectedRoute || busMatchesRoute(pos, selectedRoute);
	});

	return toGeoJSONPoints(
		filtered,
		(pos) => pos?.gpsLocation,
		(pos) => {
			const icon = operatorToIcon[pos?.operator] || "bus-stop";
			const isLpp =
				isLppOperator(pos?.operator) ||
				pos?.lineNumber !== undefined ||
				pos?.lineId !== undefined;
			return {
				...pos,
				gpsLocation: undefined,
				sourceType: isLpp ? "lpp" : "ijpp",
				icon,
				brand: operatorToIcon[pos?.operator] || "generic",
				operator: pos?.operator || "",
			};
		},
	);
}

export function buildBusStopsGeoJSON(busStops) {
	return toGeoJSONPoints(
		busStops,
		(stop) => stop?.gpsLocation,
		(stop) => ({
			id: stop?.ijppID ?? stop?.refID ?? stop?.ref_id ?? stop?.id ?? stop?.name,
			name: stop?.name,
			icon: "bus-stop",
			ref_id: stop?.ref_id ?? stop?.refID ?? null,
			gtfs_id: stop?.gtfs_id ?? null,
			ijpp_id: stop?.ijpp_id ?? null,
			vCenter: stop?.vCenter ?? false,
			routes_on_stop: JSON.stringify(stop?.routes_on_stop ?? []),
		}),
	);
}

export function buildTrainStopsGeoJSON(trainStops) {
	return toGeoJSONPoints(trainStops, getStopCoord, (stop, coord) => ({
		id: stop?.stopId ?? stop?.id ?? stop?.name,
		name: stop?.name ?? "",
		stopId: stop?.stopId ?? null,
		icon: "train-stop",
		lat: coord?.[0] ?? null,
		lon: coord?.[1] ?? null,
	}));
}

/**
 * Vlaki na trenutni čas: pozicijo interpoliramo po njihovi poti, zato je to
 * mogoče klicati vsako sekundo brez nalaganja novih podatkov.
 */
export function buildTrainsGeoJSON(trains, now = Date.now(), onlyTripId = null) {
	const list = onlyTripId
		? (trains || []).filter((train) => train.tripId === onlyTripId)
		: trains || [];

	const positioned = [];
	for (const train of list) {
		const live = getInterpolatedPosition(train.path, now);
		positioned.push({
			...train,
			gpsLocation: live?.coord ?? train.gpsLocation,
			bearing: live?.bearing ?? 0,
		});
	}

	return toGeoJSONPoints(
		positioned,
		(train) => parseTrainCoord(train?.gpsLocation),
		(train) => ({
			id: train?.tripId,
			relation: [train?.from?.name, train?.to?.name].filter(Boolean).join(" - "),
			fromStation: train?.from?.name,
			toStation: train?.to?.name,
			departure: train?.departure,
			arrival: train?.arrival,
			icon: "train",
			brand: "sz",
			tripId: train?.tripId ?? null,
			tripShort: train?.tripShort ?? null,
			realTime: train?.realtime ?? false,
			from: JSON.stringify(train?.from ?? null),
			to: JSON.stringify(train?.to ?? null),
			bearing: train?.bearing ?? 0,
			delay: train?.delay ?? 0,
		}),
	);
}

const isCoordPair = (coord) => Array.isArray(coord) && coord.length >= 2;

/**
 * Iz izbrane vožnje pripravi črto in postaje za prekrivni sloj ter seznam
 * vseh koordinat [lon, lat] za prilagoditev pogleda. Vrne null, če vožnje
 * (še) ni mogoče narisati.
 */
export function buildTripOverlay(vehicle) {
	if (!vehicle) return null;

	const geometry = vehicle.geometry || [];
	const hasLppPoints = geometry[0]?.points !== undefined;
	const isLpp = vehicle.lineId !== undefined || hasLppPoints;
	const isSz = vehicle.tripShort !== undefined && vehicle.lineNumber === undefined;
	const brand = operatorToIcon[vehicle.operator] || "generic";

	let prefix;
	let lineCoords;
	let stopsFeatures;
	let overlayBrand;

	if (isLpp) {
		prefix = "lpp";
		overlayBrand = "lpp";
		// LPP vrača točke kot [lat, lon]; zemljevid potrebuje [lon, lat].
		lineCoords = hasLppPoints
			? geometry[0].points.filter(isCoordPair).map((c) => [c[1], c[0]])
			: [];
		stopsFeatures = stopsToFeatures(vehicle.stops, "lpp");
	} else if (isSz) {
		prefix = "sz";
		overlayBrand = "sz";
		lineCoords = geometry.filter(isCoordPair);
		stopsFeatures = stopsToFeatures(vehicle.stops, "sz", vehicle.from, vehicle.to);
	} else if (vehicle.tripId !== undefined) {
		prefix = "ijpp";
		overlayBrand = brand;
		lineCoords = geometry.filter(isCoordPair);
		stopsFeatures = stopsToFeatures(vehicle.stops, brand);
	} else {
		return null;
	}

	const isMulti = Array.isArray(lineCoords[0]?.[0]);
	const allCoords = isMulti ? lineCoords.flat() : [...lineCoords];
	for (const feature of stopsFeatures) {
		if (feature?.geometry?.coordinates) allCoords.push(feature.geometry.coordinates);
	}

	return {
		prefix,
		lineCoords,
		stopsFeatures,
		brand: overlayBrand,
		// Brez točk pri "null islandu" - te bi približale pogled na Atlantik.
		fitCoords: allCoords.filter(
			(c) =>
				isCoordPair(c) &&
				Number.isFinite(c[0]) &&
				Number.isFinite(c[1]) &&
				(Math.abs(c[0]) > 0.001 || Math.abs(c[1]) > 0.001),
		),
	};
}
