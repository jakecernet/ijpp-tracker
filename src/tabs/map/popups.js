import { escapeHTML } from "./utils";
import Camera from "../../img/camera.svg";

export function createImage(src) {
    if (!src) return "";
    const name =
        src.includes("U1") || src.includes("U2") ? "-U1" : src.slice(7);
    const author = name === "-U1" ? "Doris Kordić" : "DWProski";

    return `<div class="popup-image-wrapper">
              <img loading="lazy" src="https://mestnipromet.cyou/tracker/img/avtobusi/${name}.jpg" alt="Slika" />
              <p>
                <img src="${Camera}" alt="Camera" />
                ${escapeHTML(author)}
              </p>
            </div>`;
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

function formatSpeed(speed) {
    if (!Number.isFinite(speed)) return null;
    return `${Math.round(speed)} km/h`;
}

export function renderLppPopup(properties) {
    const title = [properties.lineNumber, properties.lineName]
        .filter(Boolean)
        .map((value) => escapeHTML(String(value)))
        .join(" | ");
    const isUrban =
        properties.busName?.includes("U1") ||
        properties.busName?.includes("U2");
    const rows =
        createRow("Prevoznik", "LPP") +
        (isUrban
            ? createRow("Tip", "Turistični vlakec Urban")
            : createRow("Smer", properties.lineDestination)) +
        createRow("Vozilo", properties.busName) +
        createRow("Hitrost", formatSpeed(properties.speed)) +
        (isUrban
            ? ""
            : createRow(
                  "Vžig",
                  properties.ignition ? "Vključen" : "Izključen",
              ));

    return (
        `<div style="min-width:240px">` +
        createImage(properties.busName) +
        (title
            ? `<div style="font-weight:500; font-size:16px; margin-bottom:8px">${title}</div>`
            : "") +
        rows +
        `<button type="button" class="popup-button" style="margin-top:12px; width:100%" data-role="view-lpp-route">Prikaži linijo</button>` +
        `</div>`
    );
}

export function renderIjppPopup(properties) {
    const heading =
        properties.lineName ||
        properties.title ||
        properties.routeId ||
        "Vozilo";
    const operator = createRow("Prevoznik", properties.operator);
    const stop = createRow(
        properties.stopStatus === "STOPPED_AT"
            ? "Na postaji: "
            : "Naslednja postaja: ",
        properties.stop,
    );

    return (
        `<div style="min-width:240px">` +
        `<div style="font-weight:700; font-size:16px; margin-bottom:8px">${escapeHTML(
            String(heading),
        )}</div>` +
        operator +
        stop +
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
    { name, id, ref_id, gtfs_id, vCenter },
    coordinates,
    onSelect,
) {
    const wrapper = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = (name || "") + (vCenter ? " (Proti centru)" : "");
    const button = document.createElement("button");
    button.textContent = "Tukaj sem";
    button.className = "popup-button";
    wrapper.appendChild(title);
    wrapper.appendChild(button);

    button.addEventListener("click", () => {
        onSelect({
            id: id ?? name,
            name,
            gpsLocation: coordinates,
            ref_id: ref_id ?? null,
            gtfs_id: gtfs_id ?? null,
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
