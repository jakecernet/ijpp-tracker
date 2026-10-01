import Camera from "../../img/camera.svg";
import Center from "../../img/center.svg";
import { operatorDisplayName } from "../../utils/operators";
import { findKranjbusInfo } from "./prikazovalnikApi";
import { escapeHTML } from "./utils";

const ACCESSIBLE_ICON = `<svg class="popup-accessible" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="15" height="15" aria-label="Nizkopodni" role="img"><g fill="#60a5fa" transform="translate(85,55) scale(0.8)"><path d="M161.988 98.124c24.9629-2.30469 44.3574-23.811 44.3574-48.9658C206.346 22.083 184.263 0 157.188 0s-49.1572 22.083-49.1572 49.1582c0 8.25684 2.30371 16.7056 6.14453 23.8105l17.5156 246.467 180.396.0488 73.9912 173.365 97.1445-38.0977-15.043-35.8203-54.3662 19.625-71.5908-165.28-167.729 1.12695-2.30273-31.2129 121.423.0483v-46.1831l-126.055-.0493L161.988 98.124Z"/><path d="M343.42 451.591c-30.4473 60.1875-94.1748 99.8398-162.15 99.8398C81.4297 551.431 0 470.001 0 370.161c0-70.1006 42.4854-135.244 105.882-164.121l4.10254 53.5376c-37.4971 23.6284-60.6123 66.2622-60.6123 110.951 0 72.4268 59.0713 131.497 131.497 131.497 66.2617 0 122.765-50.8516 130.47-116.087L343.42 451.591Z"/></g></svg>`;

const IJPP_IMAGES = "https://jakecernet.github.io/prikazovalnik-slike/";
const LPP_IMAGES = "https://mestnipromet.cyou/tracker/img/avtobusi/";
const LPP_IMAGES_INDEX =
	"https://mestnipromet.cyou/tracker/js/json/images.json";

// ---------------------------------------------------------------------------
// Gradniki
// ---------------------------------------------------------------------------

const isEmpty = (value) =>
	value === null || value === undefined || value === "";

function row(label, valueHtml) {
	return `<div class="popup-row"><span class="popup-row__label">${escapeHTML(label)}</span><span class="popup-row__value">${valueHtml}</span></div>`;
}

const textRow = (label, value) =>
	isEmpty(value) ? "" : row(label, escapeHTML(value));

// Model vozila z ikono dostopnosti (rampa) - skupno za LPP in ostale prevoznike.
const modelRow = (label, model, hasRamp) =>
	model
		? row(label, escapeHTML(model) + (hasRamp ? ACCESSIBLE_ICON : ""))
		: "";

function imageBlock(src, caption) {
	if (!src) return "";
	return `<div class="popup-image-wrapper"><img loading="lazy" src="${escapeHTML(src)}" alt="Fotografija vozila" />${caption ? `<p>${caption}</p>` : ""}</div>`;
}

const authorCaption = (author) =>
	`<img src="${Camera}" alt="" /> ${escapeHTML(author || "Neznan avtor")}`;

const actionButton = (role, label) =>
	`<button type="button" class="popup-button popup-button--block" data-role="${role}">${label}</button>`;

const formatSpeed = (speed) =>
	Number.isFinite(speed) ? `${Math.round(speed)} km/h` : null;

const isUrbanRegistration = (registration) =>
	Boolean(registration?.includes("U1") || registration?.includes("U2"));

function getLppBusNumber(busName) {
	if (!busName) return null;
	return isUrbanRegistration(busName) ? "-U1" : busName.slice(7);
}

let lppImagesPromise = null;
function loadLppImagesIndex() {
	lppImagesPromise ??= fetch(LPP_IMAGES_INDEX)
		.then((response) => (response.ok ? response.json() : []))
		.catch(() => {
			lppImagesPromise = null;
			return [];
		});
	return lppImagesPromise;
}

async function fetchLppBusInfo(busNumber) {
	if (!busNumber) return null;
	const data = await loadLppImagesIndex();
	const bus = Array.isArray(data)
		? data.find((b) => b.no === busNumber)
		: null;
	if (!bus) return null;
	return {
		model: bus.model ?? null,
		author: bus.author || "Neznan avtor",
		hasRamp: Boolean(bus.ramp),
	};
}

function buildLppPopupHtml(properties, info) {
	const title = [properties.lineNumber, properties.lineName]
		.filter(Boolean)
		.map((value) => escapeHTML(value))
		.join(" | ");
	const isUrban = isUrbanRegistration(properties.registrska);
	const busNumber = getLppBusNumber(properties.registrska);

	return (
		`<div class="popup">` +
		imageBlock(
			busNumber ? `${LPP_IMAGES}${busNumber}.jpg` : "",
			authorCaption(info?.author),
		) +
		(title ? `<div class="popup-title">${title}</div>` : "") +
		textRow("Prevoznik", "Ljubljanski potniški promet") +
		textRow("Registrska", properties.registrska) +
		(isUrban
			? modelRow("Model", "Turistični vlakec Urban", info?.hasRamp)
			: modelRow("Model", info?.model, info?.hasRamp)) +
		textRow("Smer", properties.lineDestination) +
		textRow("Hitrost", formatSpeed(properties.speed)) +
		(isUrban
			? ""
			: textRow("Vžig", properties.ignition ? "Vključen" : "Izključen")) +
		actionButton("view-lpp-route", "Prikaži linijo") +
		`</div>`
	);
}

export function renderLppPopup(properties, onUpdate) {
	const busNumber = getLppBusNumber(properties.registrska);
	fetchLppBusInfo(busNumber)
		.then((info) => {
			if (info) onUpdate?.(buildLppPopupHtml(properties, info));
		})
		.catch(() => {});
	return buildLppPopupHtml(properties, null);
}

function formatLastSeen(iso) {
	if (!iso) return null;
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return String(iso);
	return date.toLocaleString("sl-SI", {
		dateStyle: "short",
		timeStyle: "short",
	});
}

function isSameLine(heading, currentLine) {
	if (!currentLine) return false;
	const [h1, h2] = String(heading).split(" - ");
	const [c1, c2] = String(currentLine).split(" - ");
	return (h1 === c1 && h2 === c2) || (h1 === c2 && h2 === c1);
}

function buildIjppPopupHtml(properties, busInfo) {
	const heading =
		properties.lineName ||
		properties.title ||
		properties.routeId ||
		"Vozilo";
	const operatorName =
		busInfo?.operator || operatorDisplayName(properties.operator) || null;

	return (
		`<div class="popup">` +
		imageBlock(
			busInfo?.hasImage && busInfo.image
				? `${IJPP_IMAGES}${busInfo.image}`
				: "",
			authorCaption("prikazovalnik.gt.tc"),
		) +
		`<div class="popup-title popup-title--bold">${escapeHTML(heading)}</div>` +
		textRow("Prevoznik", operatorName) +
		modelRow("Model", busInfo?.model, busInfo?.hasRamp) +
		textRow("Registrska", busInfo?.registration || properties.plate) +
		(busInfo?.currentLine && !isSameLine(heading, busInfo.currentLine)
			? textRow("Linija (stara)", busInfo.currentLine)
			: "") +
		textRow(
			properties.stopStatus === "STOPPED_AT"
				? "Na postaji"
				: "Naslednja postaja",
			properties.stop,
		) +
		textRow("Zadnji stik", formatLastSeen(busInfo?.lastSeen)) +
		actionButton("view-route", "Prikaži linijo") +
		`</div>`
	);
}

export function renderIjppPopup(properties, onUpdate) {
	findKranjbusInfo(properties.tripId, properties.plate, properties.vehicleId)
		.then((busInfo) => {
			if (busInfo) onUpdate?.(buildIjppPopupHtml(properties, busInfo));
		})
		.catch(() => {
			// Popup ostane prikazan z osnovnimi podatki.
		});
	return buildIjppPopupHtml(properties, null);
}

// ---------------------------------------------------------------------------
// Vlaki in postaje
// ---------------------------------------------------------------------------

const trainRow = (label, value, strong) =>
	isEmpty(value)
		? ""
		: `<div class="popup-row popup-row--train"><span class="popup-row__label">${escapeHTML(label)}</span><span class="${strong ? "popup-row__value" : "popup-row__plain"}">${escapeHTML(value)}</span></div>`;

export function renderTrainPopup(properties) {
	const number = properties.tripShort || properties.id || "";
	return (
		`<div class="popup popup--train">` +
		(number ? `<div class="popup-title">${escapeHTML(number)}</div>` : "") +
		trainRow("Odhod iz prejšnje postaje:", properties.departure, true) +
		trainRow("Prihod na naslednjo postajo:", properties.arrival, true) +
		trainRow("Prejšnja postaja:", properties.fromStation, false) +
		trainRow("Naslednja postaja:", properties.toStation, false) +
		actionButton("view-sz-route", "Prikaži linijo") +
		`</div>`
	);
}

function parseRoutes(value) {
	if (Array.isArray(value)) return value;
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

const MAX_ROUTE_BADGES = 5;

export function renderBusStopPopup({ name, vCenter, routes_on_stop }) {
	const routes = parseRoutes(routes_on_stop);
	const badges = routes
		.slice(0, MAX_ROUTE_BADGES)
		.map((route) => `<span class="popup-badge">${escapeHTML(route)}</span>`)
		.join("");
	const more =
		routes.length > MAX_ROUTE_BADGES
			? `<span class="popup-badge popup-badge--muted">+${routes.length - MAX_ROUTE_BADGES}</span>`
			: "";

	return (
		`<div class="popup popup--stop">` +
		`<h3>${escapeHTML(name || "")}${vCenter ? `<img src="${Center}" alt="Proti centru" />` : ""}</h3>` +
		(badges ? `<div class="popup-badges">${badges}${more}</div>` : "") +
		`<button type="button" class="popup-button" data-role="select-stop">Tukaj sem</button>` +
		`</div>`
	);
}

export function renderTrainStopPopup({ name, stopId }) {
	return (
		`<div class="popup popup--stop">` +
		`<h3>${escapeHTML(name || "")}</h3>` +
		(stopId ? `<p class="popup-stop-code">${escapeHTML(stopId)}</p>` : "") +
		`<button type="button" class="popup-button" data-role="select-stop">Izberi postajo</button>` +
		`</div>`
	);
}

export const renderTripStopPopup = (name) =>
	`<div class="popup"><div class="popup-title popup-title--bold">${escapeHTML(name || "Postaja")}</div></div>`;
