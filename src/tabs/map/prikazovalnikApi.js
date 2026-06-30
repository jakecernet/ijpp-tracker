// Iskanje slik vozil za NE-LPP avtobuse (Arriva, Nomago, AP Murska Sobota, ...).
//
// LPP ima svojo lastno bazo slik (glej createImage v popups.js), ostali
// prevozniki pa nimajo te informacije v IJPP API-ju. Logika spodaj posnema
// "prikazovalnik.js" (Kranjbus tracker): gre za javno berljivo Firestore
// bazo "avtobusi", ki jo skupnost dopolnjuje s fotografijami in podatki
// (model, registrska oznaka, dostopnost ...) za vozila različnih prevoznikov,
// ki jih opazijo na svojih relacijah - med njimi precej Arrivinih vozil.
//
// Do baze dostopamo prek javnega Firestore REST API-ja (brez firebase SDK-ja),
// da v bundle ne dodajamo celotne knjižnice samo za eno periodično branje.

const KRANJBUS_BUSES_URL = `https://firestore.googleapis.com/v1/projects/kranjbus/databases/(default)/documents/avtobusi`;

// Baza fotografij se ne spreminja pogosto - osvežimo jo enkrat na uro, da po
// nepotrebnem ne obremenjujemo tuje (skupnostne) Firestore baze z branji.
const CACHE_TTL_MS = 60 * 60 * 1000;

let cache = null; // { data, time }
let inFlight = null;

const clean = (value) =>
	value ? String(value).replace(/[\s-]/g, "").toUpperCase() : "";

function parseFirestoreValue(value) {
	if (!value) return undefined;
	if ("stringValue" in value) return value.stringValue;
	if ("integerValue" in value) return Number(value.integerValue);
	if ("doubleValue" in value) return value.doubleValue;
	if ("booleanValue" in value) return value.booleanValue;
	return undefined;
}

function parseFirestoreDocument(doc) {
	const fields = doc?.fields || {};
	const out = {};
	for (const key of Object.keys(fields)) {
		out[key] = parseFirestoreValue(fields[key]);
	}
	return out;
}

async function fetchKranjbusDatabase() {
	const documents = [];
	let pageToken;

	// Firestore REST list endpoint vrača največ ene strani naenkrat -
	// listamo, dokler API vrača nextPageToken.
	do {
		const url = new URL(KRANJBUS_BUSES_URL);
		url.searchParams.set("pageSize", "300");
		if (pageToken) url.searchParams.set("pageToken", pageToken);

		const response = await fetch(url.toString());
		if (!response.ok) break;

		const data = await response.json();
		(data.documents || []).forEach((doc) =>
			documents.push(parseFirestoreDocument(doc)),
		);
		pageToken = data.nextPageToken;
	} while (pageToken);

	return documents;
}

async function getBusDatabase() {
	if (cache && Date.now() - cache.time < CACHE_TTL_MS) return cache.data;

	// Dedupliranje hkratnih klicev - če več avtobusov hkrati zahteva
	// podatke, naj se baza prenese samo enkrat.
	if (inFlight) return inFlight;

	inFlight = (async () => {
		try {
			const data = await fetchKranjbusDatabase();
			cache = { data, time: Date.now() };
			return data;
		} catch (error) {
			console.error("Napaka pri nalaganju baze slik avtobusov:", error);
			return cache?.data || [];
		} finally {
			inFlight = null;
		}
	})();

	return inFlight;
}

/**
 * Poišče sliko in podatke o vozilu za ne-LPP avtobus (Arriva, Nomago,
 * AP Murska Sobota ...) glede na registrsko oznako in/ali ID vozila iz
 * IJPP API-ja.
 *
 * @param {string} plate - registrska oznaka vozila (vehicle.plate iz IJPP API-ja)
 * @param {string} vehicleId - id vozila iz IJPP API-ja (npr. "IJPP:12345")
 * @returns {Promise<{image: string|null, model: string|null, hasRamp: boolean, registration: string|null}|null>}
 */
export async function findNonLppBusInfo(plate, vehicleId) {
	if (!plate && !vehicleId) return null;

	try {
		const database = await getBusDatabase();
		if (!database?.length) return null;

		const apiPlate = clean(plate);
		const apiId = clean(
			typeof vehicleId === "string"
				? vehicleId.split(":").pop()
				: vehicleId,
		);

		if (!apiPlate && !apiId) return null;

		const match = database.find((bus) => {
			const dbStevilka = clean(bus.stVozila);
			const dbRegistrska = clean(bus.registrska);

			return (
				(dbStevilka &&
					(dbStevilka === apiPlate || dbStevilka === apiId)) ||
				(dbRegistrska &&
					(dbRegistrska === apiPlate || dbRegistrska === apiId))
			);
		});

		if (!match) return null;

		return {
			image: match.slikaPath || null,
			model:
				[match.proizvajalec, match.model].filter(Boolean).join(" ") ||
				null,
			hasRamp: Boolean(match.imaRampo),
			registration: match.registrska || null,
		};
	} catch (error) {
		console.error("Napaka pri iskanju slike avtobusa:", error);
		return null;
	}
}
