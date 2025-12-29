import maplibregl from "maplibre-gl";
import {
    renderLppPopup,
    renderIjppPopup,
    renderTrainPopup,
    createBusStopPopup,
    createTrainStopPopup,
} from "./popups";

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

export function configureBusStopPopup({ map, onSelectStop }) {
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

export function configureTrainStopPopup({ map, onSelectStop }) {
    map.on("click", "trainStops-points", (event) => {
        // If SZ route stop is under cursor, prefer route-stop popup only
        try {
            const routeFeatures = map.queryRenderedFeatures(event.point, {
                layers: ["sz-trip-stops-points"],
            });
            if (Array.isArray(routeFeatures) && routeFeatures.length > 0) {
                return; // suppress normal train stop popup
            }
        } catch {}
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;
        const popupContent = createTrainStopPopup(
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

export function configureTrainPopup({ map, onSelectVehicle }) {
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
                    popup.remove();
                },
                { once: true }
            );
        }
    );
}

export function configureBusPopup({ map, onSelectVehicle }) {
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
            return `<div style="min-width:180px">Ni podatkov</div>`;
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
                                vehicleId: properties.vehicleId || null,
                                stop: properties.stop || null,
                                stopStatus: properties.stopStatus || null,
                            });
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
                            popup.remove();
                        },
                        { once: true }
                    );
                }
            }
        }
    );
}

export function configureLppTripStopsPopup({ map }) {
    map.on("click", "lpp-trip-stops-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;
        const name = props?.name || "Postaja";
        const html = `<div style="font-weight:600; font-size:15px; margin-bottom:8px">${name}</div>`;
        const popup = new maplibregl.Popup({ closeButton: false })
            .setLngLat([lng, lat])
            .setHTML(html)
            .addTo(map);
    });
}

export function configureIjppTripStopsPopup({ map }) {
    map.on("click", "ijpp-trip-stops-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;
        const name = props?.name || "Postaja";
        const html = `<div style="font-weight:600; font-size:15px; margin-bottom:8px">${name}</div>`;
        const popup = new maplibregl.Popup({ closeButton: false })
            .setLngLat([lng, lat])
            .setHTML(html)
            .addTo(map);
    });
}

export function configureSzTripStopsPopup({ map }) {
    map.on("click", "sz-trip-stops-points", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties || {};
        const [lng, lat] = feature.geometry.coordinates;
        const name = props?.name || "Postaja";
        const html = `<div style="font-weight:600; font-size:15px; margin-bottom:8px">${name}</div>`;
        const popup = new maplibregl.Popup({ closeButton: false })
            .setLngLat([lng, lat])
            .setHTML(html)
            .addTo(map);
    });
}
