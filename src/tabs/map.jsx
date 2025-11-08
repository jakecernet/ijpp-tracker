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
    layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const STYLE =
    typeof window !== "undefined"
        ? localStorage.getItem("mapStyleUrl") || OSM_RASTER_STYLE
        : OSM_RASTER_STYLE;

function toGeoJSONPoints(items, getCoord, getProps) {
    return {
        type: "FeatureCollection",
        features: (items || [])
            .map((item) => {
                const [lat, lng] = getCoord(item) || [];
                if (
                    typeof lat !== "number" ||
                    typeof lng !== "number" ||
                    Number.isNaN(lat) ||
                    Number.isNaN(lng)
                )
                    return null;
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [lng, lat] },
                    properties: getProps ? getProps(item) : {},
                };
            })
            .filter(Boolean),
    };
}

const operatorToIcon = {
    "Javno podjetje Ljubljanski potniški promet d.o.o.": "lpp",
    "Nomago d.o.o.": "nomago",
    "Arriva d.o.o.": "arriva",
    "Javno podjetje za mestni potniški promet Marprom, d.o.o.": "marprom",
    "Avtobusni promet Murska Sobota d.d.": "murska",
};

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

    const center = useMemo(
        () => activeStation?.coordinates || userLocation || [46.0569, 14.5058],
        [activeStation, userLocation]
    );

    const busesGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                gpsPositions || [],
                (g) => g.gpsLocation,
                (g) => {
                    const props = { ...g };
                    delete props.gpsLocation;
                    if (props.title === undefined && g.route) {
                        props.title = g.route;
                    }
                    if (!props.lineName && g.lineName) {
                        props.lineName = g.lineName;
                    }
                    const isLpp =
                        (typeof g.operator === "string" &&
                            g.operator
                                .toLowerCase()
                                .includes("ljubljanski potniški promet")) ||
                        g.lineNumber !== undefined ||
                        g.lineId !== undefined;
                    props.sourceType = isLpp ? "lpp" : "ijpp";
                    props.icon = operatorToIcon[g.operator] || "bus-generic";
                    props.brand = operatorToIcon[g.operator] || "generic";
                    props.operator = g.operator || props.operator || "";
                    return props;
                }
            ),
        [gpsPositions]
    );

    const busStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                busStops || [],
                (s) => s.gpsLocation,
                (s) => {
                    const id =
                        s.ijppID ?? s.refID ?? s.ref_id ?? s.id ?? s.name;
                    const refId = s.ref_id ?? s.refID ?? null;
                    return {
                        id,
                        name: s.name,
                        icon: "bus-stop",
                        ref_id: refId,
                    };
                }
            ),
        [busStops]
    );

    const trainPositionsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                trainPositions || [],
                (t) => {
                    const coord = t?.Koordinate;
                    if (!coord) return null;
                    const [lng, lat] = String(coord)
                        .split(",")
                        .map((v) => Number(v.trim()));
                    if (
                        typeof lat !== "number" ||
                        typeof lng !== "number" ||
                        Number.isNaN(lat) ||
                        Number.isNaN(lng)
                    )
                        return null;
                    return [lat, lng];
                },
                (t) => ({
                    id: t.St_vlaka,
                    relation: t.Relacija,
                    station: t.Postaja,
                    departure: t.Odhod,
                    delay: t.Zamuda_cas,
                    rank: t.Rang,
                    type: t.Vrsta_vlaka,
                    icon: "train",
                    brand: "sz",
                })
            ),
        [trainPositions]
    );

    useEffect(() => {
        if (mapInstanceRef.current) return;
        const map = new maplibregl.Map({
            container: mapRef.current,
            style: STYLE,
            center: [center[1], center[0]],
            zoom: 13,
            attributionControl: false,
        });

        mapInstanceRef.current = map;
        map.addControl(
            new maplibregl.NavigationControl({ showCompass: false }),
            "top-right"
        );

        map.on("load", () => {
            const addImage = (name, src, options) =>
                new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => {
                        try {
                            map.addImage(name, img, options || {});
                            resolve();
                        } catch {
                            resolve();
                        }
                    };
                    img.onerror = () => resolve();
                    img.src = src;
                });

            const imageAdds = [
                addImage("bus-stop", busStopPNG, { sdf: false }),
                addImage("train-stop", trainStopPNG, { sdf: false }),
                addImage("train", szPNG, { sdf: false }),
                addImage("user", userPNG, { sdf: false }),
                addImage("station", locationPNG, { sdf: false }),
                addImage("arriva", arrivaPNG, { sdf: false }),
                addImage("lpp", lppPNG, { sdf: false }),
                addImage("nomago", nomagoPNG, { sdf: false }),
                addImage("marprom", marpromPNG, { sdf: false }),
                addImage("murska", murskaPNG, { sdf: false }),
                addImage("bus-generic", locationPNG, { sdf: false }),
                addImage("train-generic", locationPNG, { sdf: false }),
            ];

            Promise.all(imageAdds).then(() => {
                if (!map.getSource("buses")) {
                    map.addSource("buses", {
                        type: "geojson",
                        data: busesGeoJSON,
                        cluster: true,
                        clusterRadius: 40,
                        clusterMaxZoom: 14,
                    });
                }
                if (!map.getSource("busStops")) {
                    map.addSource("busStops", {
                        type: "geojson",
                        data: busStopsGeoJSON,
                        cluster: true,
                        clusterRadius: 60,
                        clusterMaxZoom: 20,
                    });
                }

                if (!map.getSource("trainPositions")) {
                    map.addSource("trainPositions", {
                        type: "geojson",
                        data: trainPositionsGeoJSON,
                        cluster: true,
                        clusterRadius: 80,
                        clusterMaxZoom: 15,
                    });
                }

                // Cluster layers (smaller circles, fewer)
                const addClusterLayers = (prefix, color) => {
                    if (!map.getLayer(`${prefix}-clusters`)) {
                        map.addLayer({
                            id: `${prefix}-clusters`,
                            type: "circle",
                            source: prefix,
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
                    if (!map.getLayer(`${prefix}-cluster-count`)) {
                        map.addLayer({
                            id: `${prefix}-cluster-count`,
                            type: "symbol",
                            source: prefix,
                            filter: ["has", "point_count"],
                            layout: {
                                "text-field": [
                                    "get",
                                    "point_count_abbreviated",
                                ],
                                "text-font": ["Open Sans Semibold"],
                                "text-size": 10,
                            },
                            paint: { "text-color": "#ffffff" },
                        });
                    }
                };

                addClusterLayers("buses", "#5b8cff");
                addClusterLayers("busStops", "#7a5bff");
                // lppBusStops merged into busStops
                addClusterLayers("trainPositions", "#ff5b5b");

                // Unclustered icons with smaller, zoom-based sizes
                const addUnclusteredIconLayer = (
                    prefix,
                    sizeExpr,
                    anchor = "bottom"
                ) => {
                    if (!map.getLayer(`${prefix}-points`)) {
                        map.addLayer({
                            id: `${prefix}-points`,
                            type: "symbol",
                            source: prefix,
                            filter: ["!", ["has", "point_count"]],
                            layout: {
                                "icon-image": ["get", "icon"],
                                "icon-allow-overlap": true,
                                "icon-size": sizeExpr,
                                "icon-anchor": anchor,
                            },
                        });
                    }
                };

                const busSize = [
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
                ];
                const stopSize = [
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
                ];
                const trainSize = [
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
                ];
                const trainPosSize = [
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
                ];

                // Center vehicle icons so they sit inside their halo circles
                addUnclusteredIconLayer("buses", busSize, "center");
                addUnclusteredIconLayer("busStops", stopSize, "bottom");
                // lppBusStops merged into busStops
                addUnclusteredIconLayer(
                    "trainPositions",
                    trainPosSize,
                    "center"
                );

                // New: colored circle halos under bus/train position icons
                const brandColorExpr = [
                    "match",
                    ["coalesce", ["get", "brand"], ["get", "icon"]],
                    "arriva",
                    "#5bc0ff", // light blue
                    "sz",
                    "#5bc9ff", // SŽ light blue
                    "nomago",
                    "#ffeb3b", // yellow
                    "lpp",
                    "#4caf50", // green
                    "marprom",
                    "#f44336", // red
                    /* default */ "#607d8b", // grey-blue
                ];
                const brandColorExprDarkened = [
                    "match",
                    ["coalesce", ["get", "brand"], ["get", "icon"]],
                    "arriva",
                    "#0091ea", // dark blue
                    "sz",
                    "#0091ea", // SŽ dark blue
                    "nomago",
                    "#fbc02d", // dark yellow
                    "lpp",
                    "#388e3c", // dark green
                    "marprom",
                    "#d32f2f", // dark red
                    /* default */ "#455a64", // dark grey-blue
                ];
                const circleRadius = [
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
                const addUnclusteredCircleLayer = (prefix) => {
                    const id = `${prefix}-halo`;
                    if (!map.getLayer(id)) {
                        map.addLayer(
                            {
                                id,
                                type: "circle",
                                source: prefix,
                                filter: ["!", ["has", "point_count"]],
                                paint: {
                                    "circle-color": brandColorExpr,
                                    "circle-radius": circleRadius,
                                    "circle-stroke-color":
                                        brandColorExprDarkened,
                                    "circle-stroke-width": 2.8,
                                    "circle-opacity": 0.6,
                                },
                            },
                            `${prefix}-points`
                        );
                    }
                };

                addUnclusteredCircleLayer("buses");
                addUnclusteredCircleLayer("trainPositions");

                // Cluster interactions
                const registerClusterClick = (prefix) => {
                    map.on("click", `${prefix}-clusters`, (e) => {
                        const features = map.queryRenderedFeatures(e.point, {
                            layers: [`${prefix}-clusters`],
                        });
                        const clusterId = features[0]?.properties?.cluster_id;
                        if (!clusterId) return;
                        const source = map.getSource(prefix);
                        source.getClusterExpansionZoom(
                            clusterId,
                            (err, zoom) => {
                                if (err) return;
                                map.easeTo({
                                    center: features[0].geometry.coordinates,
                                    zoom,
                                });
                            }
                        );
                    });
                    map.on("mouseenter", `${prefix}-clusters`, () => {
                        map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", `${prefix}-clusters`, () => {
                        map.getCanvas().style.cursor = "";
                    });
                };

                registerClusterClick("buses");
                registerClusterClick("busStops");
                registerClusterClick("trainPositions");

                // Bus stop popup with action button
                map.on("click", "busStops-points", (e) => {
                    const f = e.features?.[0];
                    if (!f) return;
                    const { id, name, ref_id } = f.properties || {};
                    const [lng, lat] = f.geometry.coordinates;

                    const wrapper = document.createElement("div");
                    const title = document.createElement("h3");
                    title.textContent = name || "";
                    const btn = document.createElement("button");
                    btn.textContent = "Tukaj sem";
                    btn.className = "popup-button";
                    wrapper.appendChild(title);
                    wrapper.appendChild(btn);

                    const popup = new maplibregl.Popup({ closeButton: false })
                        .setLngLat([lng, lat])
                        .setDOMContent(wrapper)
                        .addTo(map);

                    btn.addEventListener("click", () => {
                        const busStop = {
                            id: id ?? name,
                            name,
                            gpsLocation: [lat, lng],
                            ref_id: ref_id ?? null,
                        };
                        const payload = {
                            name: busStop.name,
                            coordinates: busStop.gpsLocation,
                            id: busStop.id,
                            ref_id: busStop.ref_id,
                        };
                        setActiveStation(payload);
                        localStorage.setItem(
                            "activeStation",
                            JSON.stringify(payload)
                        );
                        setCurentUrl("/arrivals");
                        document.location.href = "/#/arrivals";
                        popup.remove();
                    });
                });

                // Simple popups for buses and train stops
                const escapeHTML = (value) =>
                    String(value).replace(/[&<>"']/g, (char) => {
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

                const formatValue = (value) => {
                    if (value === null || value === undefined || value === "") {
                        return '<span style="opacity:0.6">&mdash;</span>';
                    }
                    if (typeof value === "object") {
                        try {
                            const text = JSON.stringify(value, null, 2);
                            return `<pre style="margin:4px 0; white-space:pre-wrap">${escapeHTML(
                                text
                            )}</pre>`;
                        } catch (err) {
                            return `<pre style="margin:4px 0; white-space:pre-wrap">${escapeHTML(
                                String(value)
                            )}</pre>`;
                        }
                    }
                    return `<span>${escapeHTML(String(value))}</span>`;
                };

                const prettifyKey = (key) => {
                    const spaced = key
                        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                        .replace(/_/g, " ")
                        .replace(/\s+/g, " ")
                        .trim();
                    if (!spaced) return key;
                    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
                };

                const createRow = (label, value) => {
                    if (value === null || value === undefined || value === "")
                        return "";
                    return (
                        `<div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:6px">` +
                        `<span style="opacity:0.7">${escapeHTML(
                            label
                        )}</span>` +
                        `<span style="font-weight:600; text-align:right">${escapeHTML(
                            String(value)
                        )}</span>` +
                        `</div>`
                    );
                };

                const formatSpeed = (speed) => {
                    if (typeof speed !== "number" || Number.isNaN(speed))
                        return null;
                    const rounded = Math.round(speed);
                    return `${rounded} km/h`;
                };

                const formatIgnitionStatus = (value) => {
                    if (value === null || value === undefined) return null;
                    if (typeof value === "boolean")
                        return value ? "Vklopljen" : "Izklopljen";
                    if (typeof value === "number")
                        return value > 0 ? "Vklopljen" : "Izklopljen";
                    const normalized = String(value).trim().toLowerCase();
                    if (["1", "on", "true", "yes"].includes(normalized))
                        return "Vklopljen";
                    if (["0", "off", "false", "no"].includes(normalized))
                        return "Izklopljen";
                    if (!normalized) return null;
                    return normalized;
                };

                const summarizeStops = (stops) => {
                    if (!Array.isArray(stops) || stops.length === 0)
                        return null;
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
                    if (first && last && first !== last)
                        return `${first} -> ${last}`;
                    return first || last || null;
                };

                const renderStopsList = (stops) => {
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
                    if (names.length === 0) return "";
                    const preview = names.slice(0, 4);
                    const items = preview
                        .map(
                            (name, index) =>
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
                };

                const renderExtraFields = (properties, usedKeys = []) => {
                    const ignore = new Set([
                        ...usedKeys,
                        "icon",
                        "brand",
                        "sourceType",
                    ]);
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
                };

                const renderLppPopup = (properties) => {
                    const lineCombined = [
                        properties.lineNumber,
                        properties.lineName,
                    ]
                        .filter(Boolean)
                        .map((value) => escapeHTML(String(value)))
                        .join(" | ");
                    const rows =
                        createRow("Prevoznik", properties.operator) +
                        createRow("Smer", properties.lineDestination) +
                        createRow("Vozilo", properties.busName) +
                        createRow("Hitrost", formatSpeed(properties.speed)) +
                        createRow(
                            "Vžig",
                            formatIgnitionStatus(properties.ignition)
                        );
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
                        (lineCombined
                            ? `<div style="font-weight:500; font-size:16px; margin-bottom:8px">${lineCombined}</div>`
                            : "") +
                        rows +
                        extra +
                        `<button type="button" class="popup-button" style="margin-top:12px; width:100%" data-role="view-lpp-route">Prikaži linijo</button>
                        </div>`
                    );
                };

                const renderIjppPopup = (properties) => {
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
                    const routeButton =
                        '<button type="button" class="popup-button" data-role="view-route" style="margin-top:12px; width:100%">Prikaži linijo</button>';
                    return (
                        `<div style="min-width:240px">` +
                        `<div style="font-weight:700; font-size:16px; margin-bottom:8px">${escapeHTML(
                            String(heading)
                        )}</div>` +
                        rows +
                        stopsSection +
                        routeButton +
                        extra +
                        `</div>`
                    );
                };

                const renderDefaultBusPopup = (properties) => {
                    const extra = renderExtraFields(properties, []);
                    if (extra)
                        return `<div style="min-width:200px">${extra}</div>`;
                    return `<div style="min-width:180px">Ni podatkov</div>`;
                };

                const attachPopup = (layerId, formatter, afterOpen) => {
                    map.on("click", layerId, (e) => {
                        const f = e.features?.[0];
                        if (!f) return;
                        const content = formatter(f.properties);
                        const popup = new maplibregl.Popup({
                            closeButton: false,
                        }).setLngLat(e.lngLat);
                        if (
                            content &&
                            typeof content === "object" &&
                            typeof Node !== "undefined" &&
                            content instanceof Node
                        ) {
                            popup.setDOMContent(content);
                        } else {
                            popup.setHTML(String(content ?? ""));
                        }
                        popup.addTo(map);
                        if (typeof afterOpen === "function") {
                            afterOpen(popup, f.properties || {}, e.lngLat);
                        }
                    });
                    map.on("mouseenter", layerId, () => {
                        map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", layerId, () => {
                        map.getCanvas().style.cursor = "";
                    });
                };

                attachPopup("trainPositions-points", (p) => {
                    const number = p.id || p.St_vlaka || "";
                    const relation = p.relation || p.Relacija || "";
                    const station = p.station || p.Postaja || "";
                    const departure = p.departure || p.Odhod || "";
                    const delay =
                        p.delay !== undefined
                            ? p.delay
                            : p.Zamuda_cas !== undefined
                            ? p.Zamuda_cas
                            : null;

                    return (
                        `<div style="min-width:180px">` +
                        (number
                            ? `<div style="font-weight:600">Vlak ${number}</div>`
                            : "") +
                        (relation ? `<div>Relacija: ${relation}</div>` : "") +
                        (station
                            ? `<div>Naslednja postaja: ${station}</div>`
                            : "") +
                        (departure ? `<div>Odhod: ${departure}</div>` : "") +
                        (delay !== null
                            ? `<div>Zamuda: ${delay} min</div>`
                            : "") +
                        `</div>`
                    );
                });

                attachPopup(
                    "buses-points",
                    (p) => {
                        if (!p || typeof p !== "object")
                            return `<div style="min-width:180px">Ni podatkov</div>`;
                        if (p.sourceType === "lpp") return renderLppPopup(p);
                        if (p.sourceType === "ijpp") return renderIjppPopup(p);
                        return renderDefaultBusPopup(p);
                    },
                    (popup, properties) => {
                        if (
                            !properties ||
                            typeof setSelectedVehicle !== "function"
                        )
                            return;
                        const container = popup.getElement();
                        if (!container) return;
                        if (properties.sourceType === "ijpp") {
                            const button = container.querySelector(
                                '[data-role="view-route"]'
                            );
                            if (button) {
                                const handler = (event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    let stops = [];
                                    const rawStops = properties.stops;
                                    if (Array.isArray(rawStops)) {
                                        stops = rawStops;
                                    } else if (typeof rawStops === "string") {
                                        try {
                                            stops = JSON.parse(rawStops);
                                        } catch (parseErr) {
                                            console.warn(
                                                "Neveljaven format postaj:",
                                                parseErr
                                            );
                                            stops = [];
                                        }
                                    }
                                    const payload = {
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
                                    };
                                    try {
                                        localStorage.setItem(
                                            "selectedBusRoute",
                                            JSON.stringify(payload)
                                        );
                                    } catch (err) {
                                        console.warn(
                                            "Shranjevanje ni uspelo:",
                                            err
                                        );
                                    }
                                    setSelectedVehicle(payload);
                                    setCurrentUrl("/route");
                                    window.location.hash = "/route";
                                    popup.remove();
                                };
                                button.addEventListener("click", handler, {
                                    once: true,
                                });
                            }
                        }

                        if (properties.sourceType === "lpp") {
                            const lppButton = container.querySelector(
                                '[data-role="view-lpp-route"]'
                            );
                            if (lppButton) {
                                lppButton.addEventListener(
                                    "click",
                                    (event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const payload = {
                                            lineId: properties.lineId || null,
                                            tripId: properties.tripId || null,
                                        };
                                        try {
                                            localStorage.setItem(
                                                "selectedBusRoute",
                                                JSON.stringify(payload)
                                            );
                                        } catch (err) {
                                            console.warn(
                                                "Shranjevanje ni uspelo:",
                                                err
                                            );
                                        }
                                        setSelectedVehicle(payload);
                                        setCurrentUrl("/route");
                                        window.location.hash = "/route";
                                        popup.remove();
                                    },
                                    { once: true }
                                );
                            }
                        }
                    }
                );
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
        const src = map.getSource("buses");
        if (src && src.setData) src.setData(busesGeoJSON);
    }, [busesGeoJSON]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const src = map.getSource("busStops");
        if (src && src.setData) src.setData(busStopsGeoJSON);
    }, [busStopsGeoJSON]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const src = map.getSource("trainPositions");
        if (src && src.setData) src.setData(trainPositionsGeoJSON);
    }, [trainPositionsGeoJSON]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;
        map.easeTo({ center: [center[1], center[0]], duration: 500 });
    }, [center]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const ensureMarker = (key, coords, img, size = [22, 22], popupText) => {
            if (markersRef.current[key]) {
                markersRef.current[key].remove();
                markersRef.current[key] = null;
            }
            if (!coords) return;
            const el = document.createElement("img");
            el.src = img;
            el.style.width = `${size[0]}px`;
            el.style.height = `${size[1]}px`;
            el.style.transform = "translate(-50%, -100%)";
            const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
                .setLngLat([coords[1], coords[0]])
                .addTo(map);
            if (popupText) {
                m.setPopup(
                    new maplibregl.Popup().setHTML(`<h4>${popupText}</h4>`)
                );
                el.style.cursor = "pointer";
            }
            markersRef.current[key] = m;
        };

        ensureMarker("user", userLocation, userPNG, [22, 22], "Vaša lokacija");
        ensureMarker(
            "active",
            activeStation?.coordinates,
            locationPNG,
            [22, 22],
            "Aktivna postaja"
        );
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
