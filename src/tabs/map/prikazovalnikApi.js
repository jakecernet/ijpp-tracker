// Iskanje podatkov o vozilih iz skupnostne Kranjbus baze (Arriva, Nomago,
// AP Murska Sobota, ...).
//
// LPP ima svojo lastno bazo slik (glej fetchLppBusInfo v popups.js), ostali
// prevozniki pa nimajo te informacije v IJPP API-ju. Baza spodaj posnema
// "prikazovalnik.js" (Kranjbus tracker): gre za javno berljivo Firestore
// bazo "avtobusi", ki jo skupnost dopolnjuje s fotografijami in podatki
// (model, registrska oznaka, trenutna linija, dostopnost ...) za vozila
// različnih prevoznikov, ki jih opazijo na svojih relacijah.
//
// Ujemanje je poenostavljeno na `lastTripId` - vsak zapis v bazi hrani ID
// zadnje znane vožnje vozila, ki ga lahko neposredno primerjamo s `tripId`
// kliknjenega vozila iz IJPP API-ja, brez potrebe po čiščenju/primerjanju
// registrskih oznak ali ID-jev vozil.
//
// Do baze dostopamo prek javnega Firestore REST API-ja (brez firebase SDK-ja),
// da v bundle ne dodajamo celotne knjižnice samo za eno periodično branje.

const KRANJBUS_BUSES_URL = `https://firestore.googleapis.com/v1/projects/kranjbus/databases/(default)/documents/avtobusi`;

// Baza se ne spreminja prepogosto - osvežimo jo enkrat na uro, da po
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

	if (inFlight) return inFlight;

	inFlight = (async () => {
		try {
			const data = await fetchKranjbusDatabase();
			cache = { data, time: Date.now() };
			return data;
		} catch (error) {
			console.error("Napaka pri nalaganju Kranjbus baze:", error);
			return cache?.data || [];
		} finally {
			inFlight = null;
		}
	})();

	return inFlight;
}

/**
 * Poišče vozilo v skupnostni Kranjbus bazi glede na `tripId` trenutne
 * vožnje (npr. "IJPP:471631") in vrne vsa razpoložljiva polja zanj.
 *
 * Primarno ujemanje: lastTripId == tripId (neposredna primerjava, brez čiščenja).
 * Rezervno ujemanje: stVozila ali registrska se ujema s plate ali vehicleId
 * (kot prej), za primere kjer lastTripId v bazi še ni osvežen.
 *
 * @param {string} tripId    - tripId vozila iz IJPP API-ja (npr. "IJPP:471631")
 * @param {string} [plate]   - registrska oznaka (rezervno ujemanje)
 * @param {string} [vehicleId] - id vozila iz IJPP API-ja (rezervno ujemanje)
 * @returns {Promise<{
 *   image: string|null,
 *   model: string|null,
 *   hasRamp: boolean,
 *   registration: string|null,
 *   operator: string|null,
 *   currentLine: string|null,
 *   lastSeen: string|null,
 * }|null>}
 */
export async function findKranjbusInfo(tripId, plate, vehicleId) {
	if (!tripId && !plate && !vehicleId) return null;

	try {
		const database = await getBusDatabase();
		if (!database?.length) return null;

		// Primarno: ujemi po lastTripId
		let match = tripId
			? database.find((bus) => bus.lastTripId === tripId)
			: null;

		// Rezervno: ujemi po registrski / stVozila (kot prej)
		if (!match && (plate || vehicleId)) {
			const apiPlate = clean(plate);
			const apiId = clean(
				typeof vehicleId === "string"
					? vehicleId.split(":").pop()
					: vehicleId,
			);
			match = database.find((bus) => {
				const dbSt = clean(bus.stVozila);
				const dbReg = clean(bus.registrska);
				return (
					(dbSt && (dbSt === apiPlate || dbSt === apiId)) ||
					(dbReg && (dbReg === apiPlate || dbReg === apiId))
				);
			});
		}

		if (!match) return null;

		return {
			image: match.slikaPath || null,
			model:
				[match.proizvajalec, match.model].filter(Boolean).join(" ") ||
				null,
			hasRamp: Boolean(match.imaRampo),
			registration: match.registrska || null,
			operator: match.tip || null,
			currentLine: match.trenutnaLinija || null,
			lastSeen: match.lastSeen || null,
		};
	} catch (error) {
		console.error("Napaka pri iskanju podatkov o avtobusu:", error);
		return null;
	}
}
