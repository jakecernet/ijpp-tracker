import React, { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import arrivaPNG from "../img/arriva.png";
import lppPNG from "../img/lpp.png";
import nomagoPNG from "../img/nomago.png";
import marpromPNG from "../img/marprom.png";
import murskaPNG from "../img/murska.png";
import userPNG from "../img/user.png";
import busStopPNG from "../img/busStop.png";
import trainStopPNG from "../img/trainStop.png";
import szPNG from "../img/sz.png";
import locationPNG from "../img/location.png";

// --- Map style configuration -------------------------------------------------

const DEFAULT_CENTER = [46.0569, 14.5058];
const DEFAULT_ZOOM = 13;

const OSM_RASTER_STYLE = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
    },
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const ICON_SOURCES = [
    { id: "bus-stop", image: busStopPNG },
    { id: "train-stop", image: trainStopPNG },
    { id: "train", image: szPNG },
    { id: "user", image: userPNG },
    { id: "station", image: locationPNG },
    { id: "arriva", image: arrivaPNG },
    { id: "lpp", image: lppPNG },
    { id: "nomago", image: nomagoPNG },
    { id: "marprom", image: marpromPNG },
    { id: "murska", image: murskaPNG },
    { id: "bus-generic", image: locationPNG },
    { id: "train-generic", image: locationPNG },
];

const CLUSTER_CONFIG = {
    buses: { radius: 40, maxZoom: 14, color: "#5b8cff" },
    busStops: { radius: 60, maxZoom: 20, color: "#7a5bff" },
    trainPositions: { radius: 80, maxZoom: 15, color: "#ff5b5b" },
};

const ICON_SIZE_BY_LAYER = {
    buses: [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.28,
        12,
        0.36,
        14,
        0.44,
        16,
        0.52,
    ],
    busStops: [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.24,
        12,
        0.32,
        14,
        0.4,
        16,
        0.48,
    ],
    trainPositions: [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.26,
        12,
        0.34,
        14,
        0.42,
        16,
        0.5,
    ],
};

const ICON_ANCHOR_BY_LAYER = {
    buses: "center",
    busStops: "bottom",
    trainPositions: "center",
};

const BRAND_COLORS = {
    arriva: { fill: "#5bc0ff", stroke: "#0091ea" },
    sz: { fill: "#5bc9ff", stroke: "#0091ea" },
    nomago: { fill: "#ffeb3b", stroke: "#fbc02d" },
    lpp: { fill: "#4caf50", stroke: "#388e3c" },
    marprom: { fill: "#f44336", stroke: "#d32f2f" },
    default: { fill: "#607d8b", stroke: "#455a64" },
};

const operatorToIcon = {
    "Javno podjetje Ljubljanski potniški promet d.o.o.": "lpp",
    "Nomago d.o.o.": "nomago",
    "Arriva d.o.o.": "arriva",
    "Javno podjetje za mestni potniški promet Marprom, d.o.o.": "marprom",
    "Avtobusni promet Murska Sobota d.d.": "murska",
};

const HALO_RADIUS = [
    "interpolate",
    ["linear"],
    ["zoom"],
    22,
    22,
    30,
    26,
    34,
    30,
    38,
    34,
];

const STYLE =
    typeof window !== "undefined"
        ? localStorage.getItem("mapStyleUrl") || OSM_RASTER_STYLE
        : OSM_RASTER_STYLE;

// --- Popup layout helpers ----------------------------------------------------

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
        switch (char) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return char;
        }
    });
}

function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return '<span style="opacity:0.6">&mdash;</span>';
    }
    if (typeof value === "object") {
        try {
            const text = JSON.stringify(value, null, 2);
            return `<pre style="margin:4px 0; white-space:pre-wrap">${escapeHTML(
                text
            )}</pre>`;
        } catch {
            return `<pre style="margin:4px 0; white-space:pre-wrap">${escapeHTML(
                String(value)
            )}</pre>`;
        }
    }
    return `<span>${escapeHTML(String(value))}</span>`;
}

function prettifyKey(key) {
    const spaced = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!spaced) return key;
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function createRow(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return (
        `<div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px">` +
        `<span style="opacity:0.7">${escapeHTML(label)}</span>` +
        `<span style="font-weight:600; text-align:right">${escapeHTML(
            String(value)
        )}</span>` +
        `</div>`
    );
}

function formatSpeed(speed) {
    if (!Number.isFinite(speed)) return null;
    return `${Math.round(speed)} km/h`;
}

function summarizeStops(stops) {
    if (!Array.isArray(stops) || stops.length === 0) return null;
    const getName = (stop) =>
        stop?.name ??
        stop?.stop_name ??
        stop?.common_name ??
        stop?.Name ??
        stop?.naziv ??
        stop?.stop ??
        null;
    const first = getName(stops[0]);
    const last = getName(stops[stops.length - 1]);
    if (first && last && first !== last) return `${first} -> ${last}`;
    return first || last || null;
}

function renderStopsList(stops) {
    if (!Array.isArray(stops) || stops.length === 0) return "";
    const names = stops
        .map(
            (stop) =>
                stop?.name ??
                stop?.stop_name ??
                stop?.common_name ??
                stop?.Name ??
                stop?.naziv ??
                stop?.stop ??
                null
        )
        .filter(Boolean);
    if (!names.length) return "";
    const preview = names.slice(0, 4);
    const items = preview
        .map(
            (name) =>
                `<li style="margin:0; padding:0; list-style-position:inside">${escapeHTML(
                    name
                )}</li>`
        )
        .join("");
    const moreCount = names.length - preview.length;
    const moreLabel =
        moreCount > 0
            ? `<li style="margin:0; padding:0; list-style-position:inside; opacity:0.7">+${moreCount} postaj</li>`
            : "";
    return (
        `<div style="margin-top:10px">` +
        `<div style="font-weight:600; margin-bottom:4px">Postaje</div>` +
        `<ul style="margin:0; padding-left:16px">${items}${moreLabel}</ul>` +
        `</div>`
    );
}

function renderExtraFields(properties, usedKeys = []) {
    const ignore = new Set([...usedKeys, "icon", "brand", "sourceType"]);
    const entries = Object.entries(properties || {}).filter(
        ([key]) => !ignore.has(key)
    );
    if (!entries.length) return "";
    const rows = entries
        .map(([key, value]) => {
            const label = escapeHTML(prettifyKey(key));
            return `<div style="margin-bottom:6px"><strong>${label}</strong>: ${formatValue(
                value
            )}</div>`;
        })
        .join("");
    return (
        `<div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(0,0,0,0.1)">` +
        rows +
        `</div>`
    );
}

// --- Popup renderers ---------------------------------------------------------

function renderLppPopup(properties) {
    const title = [properties.lineNumber, properties.lineName]
        .filter(Boolean)
        .map((value) => escapeHTML(String(value)))
        .join(" | ");
    const rows =
        createRow("Prevoznik", properties.operator) +
        createRow("Smer", properties.lineDestination) +
        createRow("Vozilo", properties.busName) +
        createRow("Hitrost", formatSpeed(properties.speed)) +
        createRow("Vžig", properties.ignition ? "Vključen" : "Izključen");
    const extra = renderExtraFields(properties, [
        "lineNumber",
        "lineName",
        "operator",
        "lineDestination",
        "busName",
        "speed",
        "ignition",
        "lineId",
        "tripId",
    ]);

    return (
        `<div style="min-width:240px">` +
        (title
            ? `<div style="font-weight:500; font-size:16px; margin-bottom:8px">${title}</div>`
            : "") +
        rows +
        extra +
        `<button type="button" class="popup-button" style="margin-top:12px; width:100%" data-role="view-lpp-route">Prikaži linijo</button>` +
        `</div>`
    );
}

function renderIjppPopup(properties) {
    const heading =
        properties.lineName ||
        properties.title ||
        properties.routeId ||
        "Vozilo";
    const relation = summarizeStops(properties.stops);
    const rows =
        createRow("Prevoznik", properties.operator) +
        createRow("Relacija", relation);
    const stopsSection = renderStopsList(properties.stops);
    const extra = renderExtraFields(properties, [
        "lineName",
        "title",
        "routeId",
        "operator",
        "stops",
        "journeyPatternId",
        "tripId",
    ]);

    return (
        `<div style="min-width:240px">` +
        `<div style="font-weight:700; font-size:16px; margin-bottom:8px">${escapeHTML(
            String(heading)
        )}</div>` +
        rows +
        stopsSection +
        '<button type="button" class="popup-button" data-role="view-route" style="margin-top:12px; width:100%">Prikaži linijo</button>' +
        extra +
        `</div>`
    );
}

function renderDefaultBusPopup(properties) {
    const extra = renderExtraFields(properties, []);
    return extra
        ? `<div style="min-width:200px">${extra}</div>`
        : `<div style="min-width:180px">Ni podatkov</div>`;
}

function renderTrainPopup(properties) {
    const number = properties.tripShort || properties.id || "";
    const fromStation = properties.fromStation;
    const toStation = properties.toStation;
    const departure = properties.departure || properties.Odhod || "";
    const arrival = properties.arrival;

    return (
        `<div style="min-width:220px">` +
        (number
            ? `<div style="font-weight:600; font-size:16px; margin-bottom:4px">${escapeHTML(
                  number
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

// --- GeoJSON helpers ---------------------------------------------------------

function toGeoJSONPoints(items, getCoord, getProps) {
    return {
        type: "FeatureCollection",
        features: (items || [])
            .map((item) => {
                const [lat, lng] = getCoord(item) || [];
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [lng, lat] },
                    properties: getProps ? getProps(item) : {},
                };
            })
            .filter(Boolean),
    };
}

// --- Map layer setup ---------------------------------------------------------

function registerHaloLayer(map, prefix) {
    const id = `${prefix}-halo`;
    if (map.getLayer(id)) return;
    const { fill, stroke } = BRAND_COLORS.default;
    const haloColorExpr = [
        "match",
        ["coalesce", ["get", "brand"], ["get", "icon"]],
        "arriva",
        BRAND_COLORS.arriva.fill,
        "sz",
        BRAND_COLORS.sz.fill,
        "nomago",
        BRAND_COLORS.nomago.fill,
        "lpp",
        BRAND_COLORS.lpp.fill,
        "marprom",
        BRAND_COLORS.marprom.fill,
        fill,
    ];
    const haloStrokeExpr = [
        "match",
        ["coalesce", ["get", "brand"], ["get", "icon"]],
        "arriva",
        BRAND_COLORS.arriva.stroke,
        "sz",
        BRAND_COLORS.sz.stroke,
        "nomago",
        BRAND_COLORS.nomago.stroke,
        "lpp",
        BRAND_COLORS.lpp.stroke,
        "marprom",
        BRAND_COLORS.marprom.stroke,
        stroke,
    ];

    map.addLayer(
        {
            id,
            type: "circle",
            source: prefix,
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-color": haloColorExpr,
                "circle-radius": HALO_RADIUS,
                "circle-stroke-color": haloStrokeExpr,
                "circle-stroke-width": 2.8,
                "circle-opacity": 0.6,
            },
        },
        `${prefix}-points`
    );
}

function ensureSource(map, id, data, cluster, radius, maxZoom) {
    if (map.getSource(id)) return;
    map.addSource(id, {
        type: "geojson",
        data,
        cluster,
        clusterRadius: radius,
        clusterMaxZoom: maxZoom,
    });
}

function ensureClusterLayers(map, id, color) {
    if (!map.getLayer(`${id}-clusters`)) {
        map.addLayer({
            id: `${id}-clusters`,
            type: "circle",
            source: id,
            filter: ["has", "point_count"],
            paint: {
                "circle-color": color,
                "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    10,
                    20,
                    13,
                    50,
                    17,
                ],
                "circle-opacity": 0.8,
            },
        });
    }

    if (!map.getLayer(`${id}-cluster-count`)) {
        map.addLayer({
            id: `${id}-cluster-count`,
            type: "symbol",
            source: id,
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["Open Sans Semibold"],
                "text-size": 10,
            },
            paint: { "text-color": "#ffffff" },
        });
    }
}

function ensurePointLayer(map, id, iconSize, anchor) {
    if (map.getLayer(`${id}-points`)) return;
    map.addLayer({
        id: `${id}-points`,
        type: "symbol",
        source: id,
        filter: ["!", ["has", "point_count"]],
        layout: {
            "icon-image": ["get", "icon"],
            "icon-allow-overlap": true,
            "icon-size": iconSize,
            "icon-anchor": anchor,
        },
    });
}

function registerClusterInteraction(map, prefix) {
    map.on("click", `${prefix}-clusters`, (event) => {
        const features = map.queryRenderedFeatures(event.point, {
            layers: [`${prefix}-clusters`],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;
        const source = map.getSource(prefix);
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: features[0].geometry.coordinates, zoom });
        });
    });

    map.on("mouseenter", `${prefix}-clusters`, () => {
        map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", `${prefix}-clusters`, () => {
        map.getCanvas().style.cursor = "";
    });
}

function setupSourcesAndLayers(map, dataBySource) {
    Object.entries(CLUSTER_CONFIG).forEach(([id, config]) => {
        ensureSource(
            map,
            id,
            dataBySource[id],
            true,
            config.radius,
            config.maxZoom
        );
        ensureClusterLayers(map, id, config.color);
        ensurePointLayer(
            map,
            id,
            ICON_SIZE_BY_LAYER[id],
            ICON_ANCHOR_BY_LAYER[id]
        );
        if (id !== "busStops") registerHaloLayer(map, id);
        registerClusterInteraction(map, id);
    });
}

function updateSourceData(map, id, data) {
    const source = map.getSource(id);
    if (source && source.setData) source.setData(data);
}

function ensureIcons(map) {
    return Promise.all(
        ICON_SOURCES.map(({ id, image }) => loadImage(map, id, image))
    );
}

function loadImage(map, id, src) {
    return new Promise((resolve) => {
        if (map.hasImage(id)) {
            resolve();
            return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                map.addImage(id, img, { sdf: false });
            } catch (err) {
                console.warn(`Ne morem dodati slike "${id}":`, err);
            }
            resolve();
        };
        img.onerror = () => resolve();
        img.src = src;
    });
}

// --- Popup wiring ------------------------------------------------------------

function attachPopup(map, layerId, formatter, afterOpen) {
    map.on("click", layerId, (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const content = formatter(feature.properties || {});
        const popup = new maplibregl.Popup({ closeButton: false }).setLngLat(
            event.lngLat
        );

        if (content && typeof content === "object" && content instanceof Node) {
            popup.setDOMContent(content);
        } else {
            popup.setHTML(String(content ?? ""));
        }

        popup.addTo(map);
        if (typeof afterOpen === "function") {
            afterOpen(popup, feature.properties || {}, event.lngLat);
        }
    });

    map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
    });
}

function configureBusStopPopup({ map, onSelectStop }) {
    map.on("click", "busStops-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;
        const popupContent = createBusStopPopup(
            props,
            [lat, lng],
            onSelectStop
        );

        new maplibregl.Popup({ closeButton: false })
            .setLngLat([lng, lat])
            .setDOMContent(popupContent)
            .addTo(map);
    });
}

function configureTrainPopup({ map, onSelectVehicle, onNavigateRoute }) {
    attachPopup(
        map,
        "trainPositions-points",
        renderTrainPopup,
        (popup, properties) => {
            if (!properties) return;
            const container = popup.getElement();
            if (!container) return;
            const button = container.querySelector(
                '[data-role="view-sz-route"]'
            );
            if (!button) return;

            button.addEventListener(
                "click",
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    let from = properties.from;
                    let to = properties.to;

                    if (typeof from === "string") {
                        try {
                            from = JSON.parse(from);
                        } catch (error) {
                            console.warn(
                                "Ne morem razvozljati podatkov 'from':",
                                error
                            );
                            from = null;
                        }
                    }

                    if (typeof to === "string") {
                        try {
                            to = JSON.parse(to);
                        } catch (error) {
                            console.warn(
                                "Ne morem razvozljati podatkov 'to':",
                                error
                            );
                            to = null;
                        }
                    }

                    onSelectVehicle({
                        tripId: properties.tripId || null,
                        tripShort: properties.tripShort || null,
                        departure: properties.departure || null,
                        arrival: properties.arrival || null,
                        realTime:
                            properties.realTime === true ||
                            properties.realTime === "true",
                        from,
                        to,
                    });
                    onNavigateRoute();
                    popup.remove();
                },
                { once: true }
            );
        }
    );
}

function configureBusPopup({ map, onSelectVehicle, onNavigateRoute }) {
    attachPopup(
        map,
        "buses-points",
        (properties) => {
            if (!properties || typeof properties !== "object") {
                return `<div style="min-width:180px">Ni podatkov</div>`;
            }
            if (properties.sourceType === "lpp")
                return renderLppPopup(properties);
            if (properties.sourceType === "ijpp")
                return renderIjppPopup(properties);
            return renderDefaultBusPopup(properties);
        },
        (popup, properties) => {
            if (!properties) return;
            const container = popup.getElement();
            if (!container) return;

            if (properties.sourceType === "ijpp") {
                const button = container.querySelector(
                    '[data-role="view-route"]'
                );
                if (button) {
                    button.addEventListener(
                        "click",
                        (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const rawStops = properties.stops;
                            let stops = [];
                            if (Array.isArray(rawStops)) {
                                stops = rawStops;
                            } else if (typeof rawStops === "string") {
                                try {
                                    stops = JSON.parse(rawStops);
                                } catch (err) {
                                    console.warn(
                                        "Neveljaven format postaj:",
                                        err
                                    );
                                }
                            }
                            onSelectVehicle({
                                lineName: properties.lineName || null,
                                operator: properties.operator || null,
                                tripId: properties.tripId || null,
                                routeId: properties.routeId || null,
                                journeyPatternId:
                                    properties.journeyPatternId || null,
                                stops,
                                vehicleRef:
                                    properties.vehicleRef ||
                                    properties.vehicleId ||
                                    null,
                                destination:
                                    properties.lineDestination ||
                                    properties.destination ||
                                    null,
                                origin: properties.origin || null,
                                lastKnown: Date.now(),
                            });
                            onNavigateRoute();
                            popup.remove();
                        },
                        { once: true }
                    );
                }
            }

            if (properties.sourceType === "lpp") {
                const button = container.querySelector(
                    '[data-role="view-lpp-route"]'
                );
                if (button) {
                    button.addEventListener(
                        "click",
                        (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSelectVehicle({
                                lineId: properties.lineId ?? null,
                                tripId: properties.tripId ?? null,
                                lineNumber: properties.lineNumber ?? null,
                                lineName: properties.lineName ?? null,
                            });
                            onNavigateRoute();
                            popup.remove();
                        },
                        { once: true }
                    );
                }
            }
        }
    );
}

function createBusStopPopup({ name, id, ref_id }, coordinates, onSelect) {
    const wrapper = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = name || "";
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
        });
    });

    return wrapper;
}

// --- Marker helpers ----------------------------------------------------------

function refreshMarker({ map, markersRef, key, coords, img, size, popup }) {
    if (markersRef.current[key]) {
        markersRef.current[key].remove();
        markersRef.current[key] = null;
    }
    if (!coords) return;

    const element = document.createElement("img");
    element.src = img;
    element.style.width = `${size[0]}px`;
    element.style.height = `${size[1]}px`;
    element.style.transform = "translate(-50%, -100%)";

    const marker = new maplibregl.Marker({ element, anchor: "bottom" })
        .setLngLat([coords[1], coords[0]])
        .addTo(map);

    if (popup) {
        marker.setPopup(
            new maplibregl.Popup({ closeButton: false }).setHTML(
                `<h4>${escapeHTML(popup)}</h4>`
            )
        );
        element.style.cursor = "pointer";
    }

    markersRef.current[key] = marker;
}

// --- React component ---------------------------------------------------------

const Map = React.memo(function Map({
    gpsPositions,
    busStops,
    activeStation,
    setActiveStation,
    userLocation,
    setCurrentUrl,
    trainPositions,
    setSelectedVehicle,
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({ user: null, active: null });
    const initialCenterRef = useRef(
        activeStation?.coordinates || userLocation || DEFAULT_CENTER
    );
    const handlersRef = useRef({
        setActiveStation,
        setCurrentUrl,
        setSelectedVehicle,
    });

    useEffect(() => {
        handlersRef.current = {
            setActiveStation,
            setCurrentUrl,
            setSelectedVehicle,
        };
    }, [setActiveStation, setCurrentUrl, setSelectedVehicle]);

    const center = useMemo(
        () => activeStation?.coordinates || userLocation || DEFAULT_CENTER,
        [activeStation, userLocation]
    );

    const busesGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                gpsPositions,
                (position) => position?.gpsLocation,
                (position) => {
                    const props = { ...position };
                    delete props.gpsLocation;

                    if (props.title === undefined && position?.route) {
                        props.title = position.route;
                    }
                    if (!props.lineName && position?.lineName) {
                        props.lineName = position.lineName;
                    }

                    const isLpp =
                        (typeof position?.operator === "string" &&
                            position.operator
                                .toLowerCase()
                                .includes("ljubljanski potniški promet")) ||
                        position?.lineNumber !== undefined ||
                        position?.lineId !== undefined;

                    props.sourceType = isLpp ? "lpp" : "ijpp";
                    props.icon =
                        operatorToIcon[position?.operator] || "bus-generic";
                    props.brand =
                        operatorToIcon[position?.operator] || "generic";
                    props.operator = position?.operator || props.operator || "";

                    return props;
                }
            ),
        [gpsPositions]
    );

    const busStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                busStops,
                (stop) => stop?.gpsLocation,
                (stop) => {
                    const id =
                        stop?.ijppID ??
                        stop?.refID ??
                        stop?.ref_id ??
                        stop?.id ??
                        stop?.name;
                    return {
                        id,
                        name: stop?.name,
                        icon: "bus-stop",
                        ref_id: stop?.ref_id ?? stop?.refID ?? null,
                    };
                }
            ),
        [busStops]
    );

    const trainPositionsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                trainPositions,
                (train) => {
                    const coord = train?.gpsLocation;
                    if (!coord) return null;
                    const [lng, lat] = String(coord)
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .slice(0, 2);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng))
                        return null;
                    return [lat, lng];
                },
                (train) => {
                    const relation = [train?.from?.name, train?.to?.name]
                        .filter(Boolean)
                        .join(" - ");
                    return {
                        id: train?.tripId,
                        relation,
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
                    };
                }
            ),
        [trainPositions]
    );

    useEffect(() => {
        if (mapInstanceRef.current) return;

        const map = new maplibregl.Map({
            container: mapRef.current,
            style: STYLE,
            center: [initialCenterRef.current[1], initialCenterRef.current[0]],
            zoom: DEFAULT_ZOOM,
            attributionControl: false,
        });

        mapInstanceRef.current = map;

        map.addControl(
            new maplibregl.NavigationControl({ showCompass: true }),
            "top-right"
        );

        map.on("load", async () => {
            await ensureIcons(map);

            setupSourcesAndLayers(map, {
                buses: busesGeoJSON,
                busStops: busStopsGeoJSON,
                trainPositions: trainPositionsGeoJSON,
            });

            configureBusStopPopup({
                map,
                onSelectStop: (stop) => {
                    const {
                        setActiveStation: applyActive,
                        setCurrentUrl: applyUrl,
                    } = handlersRef.current;

                    const payload = {
                        name: stop.name,
                        coordinates: stop.gpsLocation,
                        id: stop.id,
                        ref_id: stop.ref_id,
                    };

                    applyActive(payload);
                    localStorage.setItem(
                        "activeStation",
                        JSON.stringify(payload)
                    );
                    applyUrl("/arrivals");
                    window.location.hash = "/arrivals";
                },
            });

            const handleSelectVehicle = (vehicle) => {
                const { setSelectedVehicle: applySelectedVehicle } =
                    handlersRef.current;
                try {
                    localStorage.setItem(
                        "selectedBusRoute",
                        JSON.stringify(vehicle)
                    );
                } catch (err) {
                    console.warn("Shranjevanje ni uspelo:", err);
                }
                applySelectedVehicle(vehicle);
            };

            const handleNavigateRoute = () => {
                const { setCurrentUrl: applyUrl } = handlersRef.current;
                applyUrl("/route");
                window.location.hash = "/route";
            };

            configureTrainPopup({
                map,
                onSelectVehicle: handleSelectVehicle,
                onNavigateRoute: handleNavigateRoute,
            });

            configureBusPopup({
                map,
                onSelectVehicle: handleSelectVehicle,
                onNavigateRoute: handleNavigateRoute,
            });
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        updateSourceData(map, "buses", busesGeoJSON);
        updateSourceData(map, "busStops", busStopsGeoJSON);
        updateSourceData(map, "trainPositions", trainPositionsGeoJSON);
    }, [busesGeoJSON, busStopsGeoJSON, trainPositionsGeoJSON]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;
        map.easeTo({ center: [center[1], center[0]], duration: 500 });
    }, [center]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        refreshMarker({
            map,
            markersRef,
            key: "user",
            coords: userLocation,
            img: userPNG,
            size: [22, 22],
            popup: "Vaša lokacija",
        });

        refreshMarker({
            map,
            markersRef,
            key: "active",
            coords: activeStation?.coordinates,
            img: locationPNG,
            size: [22, 22],
            popup: "Aktivna postaja",
        });
    }, [userLocation, activeStation]);

    return (
        <div className="insideDiv">
            <div className="map-container">
                <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
            </div>
        </div>
    );
});

export default Map;
