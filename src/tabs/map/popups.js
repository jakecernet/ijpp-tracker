import { escapeHTML } from "./utils";
import { findKranjbusInfo } from "./prikazovalnikApi";
import Camera from "../../img/camera.svg";
import Center from "../../img/center.svg";

const ACCESSIBLE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="15" height="15" style="vertical-align:-2px; margin-left:6px">
	<g fill="#60a5fa" transform="translate(85,55) scale(0.8)">
		<path d="M161.988 98.124c24.9629-2.30469 44.3574-23.811 44.3574-48.9658C206.346 22.083 184.263 0 157.188 0s-49.1572 22.083-49.1572 49.1582c0 8.25684 2.30371 16.7056 6.14453 23.8105l17.5156 246.467 180.396.0488 73.9912 173.365 97.1445-38.0977-15.043-35.8203-54.3662 19.625-71.5908-165.28-167.729 1.12695-2.30273-31.2129 121.423.0483v-46.1831l-126.055-.0493L161.988 98.124Z"/>
		<path d="M343.42 451.591c-30.4473 60.1875-94.1748 99.8398-162.15 99.8398C81.4297 551.431 0 470.001 0 370.161c0-70.1006 42.4854-135.244 105.882-164.121l4.10254 53.5376c-37.4971 23.6284-60.6123 66.2622-60.6123 110.951 0 72.4268 59.0713 131.497 131.497 131.497 66.2617 0 122.765-50.8516 130.47-116.087L343.42 451.591Z"/>
	</g>
</svg>`;

const ijppImages = "https://jakecernet.github.io/prikazovalnik-slike/";

function getLppBusNumber(busName) {
	if (!busName) return null;
	return busName.includes("U1") || busName.includes("U2")
		? "-U1"
		: busName.slice(7);
}

async function fetchLppBusInfo(busNumber) {
	if (!busNumber) return null;
	try {
		const response = await fetch(
			"https://mestnipromet.cyou/tracker/js/json/images.json",
		);
		const data = await response.json();
		const bus = data.find((b) => b.no === busNumber);
		if (!bus) return null;
		return {
			model: bus.model ?? null,
			author: bus.author || "Neznan avtor",
			hasRamp: Boolean(bus.ramp),
		};
	} catch {
		return null;
	}
}

// Splošen ovojnik za slike v popupih - `caption` je poljubna HTML vsebina
// (npr. ikona + ime avtorja), ki se izriše čez sliko v spodnjem desnem kotu.
function imageWrapper(src, caption) {
	if (!src) return "";
	return `<div class="popup-image-wrapper">
              <img loading="lazy" src="${src}" alt="Slika" />
              ${caption ? `<p>${caption}</p>` : ""}
            </div>`;
}

function authorCaption(author) {
	return `<img src="${Camera}" alt="Author" /> ${escapeHTML(
		author || "Neznan avtor",
	)}`;
}

export function createRow(label, value) {
	if (value === null || value === undefined || value === "") return "";
	return (
		`<div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px">` +
		`<span style="opacity:0.7">${escapeHTML(label)}</span>` +
		`<span style="font-weight:600; text-align:right">${escapeHTML(
			String(value),
		)}</span>` +
		`</div>`
	);
}

// Vrstica za model vozila z opcijsko ikono dostopnosti (rampa/nizka
// stopnica) - skupna za LPP in ne-LPP (IJPP) popupe, da je prikaz
// modela in dostopnosti enak ne glede na prevoznika.
function createModelRow(model, hasRamp) {
	if (!model) return "";
	return (
		`<div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px">` +
		`<span style="opacity:0.7">Model</span>` +
		`<span style="font-weight:600; text-align:right">${escapeHTML(
			model,
		)}${hasRamp ? ACCESSIBLE_ICON : ""}</span>` +
		`</div>`
	);
}

function formatSpeed(speed) {
	if (!Number.isFinite(speed)) return null;
	return `${Math.round(speed)} km/h`;
}

export async function renderLppPopup(properties) {
	const title = [properties.lineNumber, properties.lineName]
		.filter(Boolean)
		.map((value) => escapeHTML(String(value)))
		.join(" | ");
	const isUrban =
		properties.busName?.includes("U1") ||
		properties.busName?.includes("U2");

	const busNumber = getLppBusNumber(properties.busName);
	const info = await fetchLppBusInfo(busNumber);

	const imageHTML = imageWrapper(
		busNumber
			? `https://mestnipromet.cyou/tracker/img/avtobusi/${busNumber}.jpg`
			: "",
		authorCaption(info?.author),
	);

	const rows =
		createRow("Prevoznik", "Ljubljanski potniški promet") +
		createRow("Registrska", properties.busName) +
		(isUrban
			? createModelRow("Turistični vlakec Urban", info?.hasRamp)
			: createModelRow(info?.model, info?.hasRamp)) +
		createRow("Smer", properties.lineDestination) +
		createRow("Hitrost", formatSpeed(properties.speed)) +
		(isUrban
			? ""
			: createRow(
					"Vžig",
					properties.ignition ? "Vključen" : "Izključen",
				));

	return (
		`<div style="min-width:240px">` +
		imageHTML +
		(title
			? `<div style="font-weight:500; font-size:16px; margin-bottom:8px">${title}</div>`
			: "") +
		rows +
		`<button type="button" class="popup-button" style="margin-top:12px; width:100%" data-role="view-lpp-route">Prikaži linijo</button>` +
		`</div>`
	);
}

export async function renderIjppPopup(properties) {
	const heading =
		properties.lineName ||
		properties.title ||
		properties.routeId ||
		"Vozilo";

	// Primarno ujemanje po tripId, rezervno po registrski/vehicleId.
	const busInfo = await findKranjbusInfo(
		properties.tripId,
		properties.plate,
		properties.vehicleId,
	);

    const imageHTML = imageWrapper(
        busInfo?.hasImage ? `${ijppImages}${busInfo.image}` : "",
        authorCaption("prikazovalnik.gt.tc"),
    );

	// Prevoznik: Kranjbus baza ima zanesljivejše ime kot IJPP API.
	const operatorName =
		busInfo?.operator ||
		(properties.operator === "MP_Kranj"
			? "Mestni promet Kranj"
			: properties.operator) ||
		null;

	const stop = createRow(
		properties.stopStatus === "STOPPED_AT"
			? "Na postaji"
			: "Naslednja postaja",
		properties.stop,
	);

	// Datum zadnjega stika - pretvori ISO niz v berljiv format.
	let lastSeenFormatted = null;
	if (busInfo?.lastSeen) {
		try {
			lastSeenFormatted = new Date(busInfo.lastSeen).toLocaleString(
				"sl-SI",
				{ dateStyle: "short", timeStyle: "short" },
			);
		} catch {
			lastSeenFormatted = busInfo.lastSeen;
		}
	}

	const headingParts = String(heading).split(" - ");
	const linePart = String(busInfo?.currentLine).split(" - ");
	const isSame =
		(headingParts[0] === linePart[0] && headingParts[1] === linePart[1]) ||
		(headingParts[0] === linePart[1] && headingParts[1] === linePart[0]) ||
		(headingParts[0] === linePart[1] && headingParts[1] === linePart[0]);

	const rows =
		createRow("Prevoznik", operatorName) +
		createModelRow(busInfo?.model, busInfo?.hasRamp) +
		createRow("Registrska", busInfo?.registration || properties.plate) +
		(busInfo?.currentLine && !isSame
			? createRow("Linija (stara)", busInfo.currentLine)
			: "") +
		stop +
		createRow("Zadnji stik", lastSeenFormatted);

	return (
		`<div style="min-width:240px">` +
		imageHTML +
		`<div style="font-weight:700; font-size:16px; margin-bottom:8px">${escapeHTML(
			String(heading),
		)}</div>` +
		rows +
		'<button type="button" class="popup-button" data-role="view-route" style="margin-top:12px; width:100%">Prikaži linijo</button>' +
		`</div>`
	);
}

export function renderTrainPopup(properties) {
	const number = properties.tripShort || properties.id || "";
	const { fromStation, toStation, departure, arrival } = properties;

	return (
		`<div style="min-width:220px">` +
		(number
			? `<div style="font-weight:600; font-size:16px; margin-bottom:4px">${escapeHTML(
					number,
				)}</div>`
			: "") +
		(departure
			? `<div style="display:flex; justify-content:space-between; margin-top:6px">
          <p style="color:gray">Odhod iz prejšnje postaje:</p>
          <h4 style="font-weight:700">${escapeHTML(departure)}</h4>
        </div>`
			: "") +
		(arrival !== null
			? `<div style="display:flex; justify-content:space-between; margin-top:6px">
          <p style="color:gray">Prihod na naslednjo postajo:</p>
          <h4 style="font-weight:700">${escapeHTML(arrival)}</h4>
        </div>`
			: "") +
		(fromStation
			? `<div style="display:flex; justify-content:space-between; margin-top:6px">
          <p style="color:gray">Prejšnja postaja: </p>
          <p>${escapeHTML(fromStation)}</p> 
        </div>`
			: "") +
		(toStation
			? `<div style="display:flex; justify-content:space-between; margin-top:6px">
          <p style="color:gray">Naslednja postaja: </p>
          <p>${escapeHTML(toStation)}</p>
        </div>`
			: "") +
		`<button type="button" class="popup-button" data-role="view-sz-route" style="margin-top:12px; width:100%">Prikaži linijo</button>` +
		`</div>`
	);
}

export function createBusStopPopup(
	{ name, id, ref_id, gtfs_id, ijpp_id, vCenter, routes_on_stop },
	coordinates,
	onSelect,
) {
	const wrapper = document.createElement("div");
	const title = document.createElement("h3");
	title.innerHTML =
		(name || "") + (vCenter ? `<img src="${Center}" alt="Center" />` : "");
	wrapper.appendChild(title);

	// Parse routes (may be JSON string from GeoJSON properties)
	let routes = [];
	try {
		routes =
			typeof routes_on_stop === "string"
				? JSON.parse(routes_on_stop)
				: routes_on_stop || [];
	} catch (e) {
		routes = [];
	}

	// Display routes if available
	if (routes.length > 0) {
		const routesContainer = document.createElement("div");
		routesContainer.style.cssText =
			"display:flex; flex-wrap:wrap; gap:4px; margin:8px 0;";

		const maxDisplay = 5;
		const displayRoutes = routes.slice(0, maxDisplay);

		displayRoutes.forEach((route) => {
			const badge = document.createElement("span");
			badge.textContent = route;
			badge.style.cssText =
				"background:#2a9d8f; color:white; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;";
			routesContainer.appendChild(badge);
		});

		if (routes.length > maxDisplay) {
			const more = document.createElement("span");
			more.textContent = `+${routes.length - maxDisplay}`;
			more.style.cssText =
				"background:#6c757d; color:white; padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600;";
			routesContainer.appendChild(more);
		}

		wrapper.appendChild(routesContainer);
	}

	const button = document.createElement("button");
	button.textContent = "Tukaj sem";
	button.className = "popup-button";
	wrapper.appendChild(button);

	button.addEventListener("click", () => {
		onSelect({
			id: id ?? name,
			name,
			gpsLocation: coordinates,
			ref_id: ref_id ?? null,
			gtfs_id: gtfs_id ?? null,
			ijpp_id: ijpp_id ?? null,
			vCenter: Boolean(vCenter),
		});
	});

	return wrapper;
}

export function createTrainStopPopup(
	{ name, stopId, id },
	coordinates,
	onSelect,
) {
	const wrapper = document.createElement("div");
	const title = document.createElement("h3");
	title.textContent = name || "";
	wrapper.appendChild(title);

	if (stopId) {
		const code = document.createElement("p");
		code.textContent = stopId;
		code.style.margin = "4px 0";
		code.style.opacity = "0.75";
		wrapper.appendChild(code);
	}

	const button = document.createElement("button");
	button.textContent = "Izberi postajo";
	button.className = "popup-button";
	wrapper.appendChild(button);

	button.addEventListener("click", () => {
		onSelect({
			id: stopId ?? id ?? name,
			name,
			stopId: stopId ?? null,
			gpsLocation: coordinates,
			lat: coordinates?.[0] ?? null,
			lon: coordinates?.[1] ?? null,
		});
	});

	return wrapper;
}
