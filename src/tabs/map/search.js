// Iskanje po trenutno aktivnih vozilih na zemljevidu (čiste funkcije, brez WebGL-ja).
import { getInterpolatedPosition } from "../../Api";
import { isLppOperator, operatorDisplayName } from "../../utils/operators";
import { operatorToIcon } from "./config";
import { parseTrainCoord } from "./utils";

const MAX_RESULTS = 30;

/** Mala črka brez šumnikov/diakritike (č -> c), da "crnuce" najde "Črnuče". */
export const normalize = (value) =>
	String(value ?? "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/đ/g, "d")
		.toLowerCase()
		.trim();

const isLppBus = (pos) =>
	isLppOperator(pos?.operator) ||
	pos?.lineNumber !== undefined ||
	pos?.lineId !== undefined;

/** Isti objekt, kot ga ob kliku na označbo posreduje `registerMapInteractions`. */
function busSelection(pos) {
	if (isLppBus(pos)) {
		return {
			lineId: pos.lineId ?? null,
			tripId: pos.tripId ?? null,
			lineNumber: pos.lineNumber ?? null,
			lineName: pos.lineName ?? null,
		};
	}
	return {
		lineName: pos.lineName || null,
		operator: pos.operator || null,
		tripId: pos.tripId || null,
		vehicleId: pos.vehicleId || null,
		stop: pos.stop || null,
		stopStatus: pos.stopStatus || null,
	};
}

function trainSelection(train) {
	return {
		tripId: train.tripId || null,
		tripShort: train.tripShort || null,
		departure: train.departure || null,
		arrival: train.arrival || null,
		realTime: train.realtime === true,
		from: train.from ?? null,
		to: train.to ?? null,
	};
}

/** [lng, lat] ali null. */
function busCenter(pos) {
	const [lat, lon] = pos?.gpsLocation ?? [];
	return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
}

function trainCenter(train, now) {
	const live = getInterpolatedPosition(train.path, now);
	const coord = parseTrainCoord(live?.coord ?? train.gpsLocation);
	return coord ? [coord[1], coord[0]] : null;
}

/**
 * Seznam iskalnih zapisov za vse vozila, ki so zdaj narisana na zemljevidu
 * (upošteva izbrane prevoznike in vidnost slojev).
 *
 * Zapis: { id, kind: "line" | "bus" | "train", brand, title, subtitle, count?,
 *          haystack, selection, center }
 */
export function buildSearchIndex({
	gpsPositions,
	trains,
	busOperators,
	visibility,
	now = Date.now(),
}) {
	const items = [];

	if (visibility?.buses !== false) {
		const lines = new Map();

		for (const pos of gpsPositions || []) {
			const brand = operatorToIcon[pos?.operator] || "generic";
			if (busOperators && !busOperators[brand]) continue;
			const center = busCenter(pos);
			if (!center) continue;

			const lpp = isLppBus(pos);
			const operatorName = lpp
				? "Ljubljanski potniški promet"
				: operatorDisplayName(pos.operator);
			const lineTitle = lpp ? pos.lineNumber : pos.lineName;
			const lineSubtitle = lpp ? pos.lineName : operatorName;

			// Linije: LPP po številki, ostali po imenu relacije + prevozniku.
			if (lineTitle) {
				const key = `line:${lpp ? "lpp" : pos.operator}:${lineTitle}`;
				let line = lines.get(key);
				if (!line) {
					line = {
						id: key,
						kind: "line",
						brand,
						title: String(lineTitle),
						subtitle: lineSubtitle || "",
						count: 0,
						haystack: normalize(
							[lineTitle, pos.lineName, pos.lineDestination, operatorName].join(" "),
						),
						selection: busSelection(pos),
						center,
					};
					lines.set(key, line);
				}
				line.count += 1;
				// Raje vozilo, ki ima znano vožnjo (potrebna za nalaganje poti).
				if (!line.selection.tripId && pos.tripId) {
					line.selection = busSelection(pos);
					line.center = center;
				}
			}

			// Vozila: registrska (LPP) / oznaka vozila (ostali).
			const plate = lpp ? pos.registrska : pos.vehicleId;
			if (plate) {
				items.push({
					id: `bus:${pos.operator}:${plate}`,
					kind: "bus",
					brand,
					title: String(plate),
					subtitle: [lineTitle, lpp ? pos.lineDestination || pos.lineName : operatorName]
						.filter(Boolean)
						.join(" · "),
					haystack: normalize(
						[plate, lineTitle, pos.lineName, pos.lineDestination, operatorName].join(" "),
					),
					selection: busSelection(pos),
					center,
				});
			}
		}
		items.push(...lines.values());
	}

	if (visibility?.trainPositions !== false) {
		for (const train of trains || []) {
			if (!train?.tripId) continue;
			const center = trainCenter(train, now);
			if (!center) continue;
			const from = train.from?.name;
			const to = train.to?.name;
			items.push({
				id: `train:${train.tripId}`,
				kind: "train",
				brand: "sz",
				title: String(train.tripShort ?? "Vlak"),
				subtitle: [from, to].filter(Boolean).join(" - "),
				haystack: normalize(
					["vlak", "sz", train.tripShort, from, to].join(" "),
				),
				selection: trainSelection(train),
				center,
			});
		}
	}

	return items;
}

const KIND_ORDER = { line: 0, train: 1, bus: 2 };

/** Vsi iskani nizi (ločeni s presledki) morajo nastopati v zapisu. */
export function searchItems(items, query) {
	const tokens = normalize(query).split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return [];

	const scored = [];
	for (const item of items) {
		if (!tokens.every((token) => item.haystack.includes(token))) continue;
		const title = normalize(item.title);
		let score = 3;
		if (title === tokens.join(" ")) score = 0;
		else if (title.startsWith(tokens[0])) score = 1;
		else if (item.haystack.startsWith(tokens[0])) score = 2;
		scored.push({ item, score });
	}

	scored.sort(
		(a, b) =>
			a.score - b.score ||
			KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] ||
			a.item.title.localeCompare(b.item.title, "sl", { numeric: true }),
	);
	return scored.slice(0, MAX_RESULTS).map(({ item }) => item);
}
