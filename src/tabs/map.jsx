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
import locationPNG from "../img/location.png";
import trainPNG from "../img/trainStop.png";

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
    layers: [
        {
            id: "osm",
            type: "raster",
            source: "osm",
        },
    ],
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
                    geometry: {
                        type: "Point",
                        coordinates: [lng, lat],
                    },
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
    trainStops,
    activeStation,
    setActiveStation,
    userLocation,
    setCurentUrl,
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
                (g) => ({
                    title: g.route || "",
                    lineName: g.lineName || "",
                    operator: g.operator || "",
                    icon: operatorToIcon[g.operator] || "bus-generic",
                })
            ),
        [gpsPositions]
    );

    const busStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                busStops || [],
                (s) => s.gpsLocation,
                (s) => ({ id: s.id, name: s.name, icon: "bus-stop" })
            ),
        [busStops]
    );

    const trainStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                trainStops || [],
                (t) => [t.lat, t.lng],
                (t) => ({ id: t.id, name: t.name || t.naziv, icon: "train" })
            ),
        [trainStops]
    );

    // Initialize map once
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
                addImage("train", trainPNG, { sdf: false }),
                addImage("user", userPNG, { sdf: false }),
                addImage("station", locationPNG, { sdf: false }),
                addImage("arriva", arrivaPNG, { sdf: false }),
                addImage("lpp", lppPNG, { sdf: false }),
                addImage("nomago", nomagoPNG, { sdf: false }),
                addImage("marprom", marpromPNG, { sdf: false }),
                addImage("murska", murskaPNG, { sdf: false }),
                addImage("bus-generic", locationPNG, { sdf: false }),
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
                        clusterRadius: 35,
                        clusterMaxZoom: 14,
                    });
                }
                if (!map.getSource("trainStops")) {
                    map.addSource("trainStops", {
                        type: "geojson",
                        data: trainStopsGeoJSON,
                        cluster: true,
                        clusterRadius: 40,
                        clusterMaxZoom: 13,
                    });
                }

                // Layers: clusters
                const addClusterLayers = (prefix, color) => {
                    // Bubbles
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
                                    12,
                                    20,
                                    16,
                                    50,
                                    22,
                                ],
                                "circle-opacity": 0.8,
                            },
                        });
                    }

                    // Labels
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
                                "text-size": 11,
                            },
                            paint: { "text-color": "#ffffff" },
                        });
                    }
                };

                addClusterLayers("buses", "#5b8cff");
                addClusterLayers("busStops", "#7a5bff");
                addClusterLayers("trainStops", "#5b8cff");

                // Unclustered icons (smaller, scale by zoom)
                const addUnclusteredIconLayer = (prefix, sizeExpr) => {
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
                                "icon-anchor": "bottom",
                            },
                        });
                    }
                };

                // Smaller at low zoom, slightly larger when zoomed in
                const busSize = [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.35,
                    12,
                    0.45,
                    14,
                    0.55,
                    16,
                    0.7,
                ];
                const stopSize = [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.3,
                    12,
                    0.4,
                    14,
                    0.5,
                    16,
                    0.65,
                ];
                const trainSize = [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0.32,
                    12,
                    0.42,
                    14,
                    0.52,
                    16,
                    0.68,
                ];

                addUnclusteredIconLayer("buses", busSize);
                addUnclusteredIconLayer("busStops", stopSize);
                addUnclusteredIconLayer("trainStops", trainSize);

                // Interactions
                // Zoom into clusters on click
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
                registerClusterClick("trainStops");

                // Bus stop popup with 'Tukaj sem' button (Leaflet-like)
                map.on("click", "busStops-points", (e) => {
                    const f = e.features?.[0];
                    if (!f) return;
                    const { id, name } = f.properties || {};
                    const [lng, lat] = f.geometry.coordinates;

                    const wrapper = document.createElement("div");
                    const title = document.createElement("h3");
                    title.textContent = name || "";
                    const btn = document.createElement("button");
                    btn.textContent = "Tukaj sem";
                    btn.className = "popup-button";
                    wrapper.appendChild(title);
                    wrapper.appendChild(btn);

                    const popup = new maplibregl.Popup({ closeButton: true })
                        .setLngLat([lng, lat])
                        .setDOMContent(wrapper)
                        .addTo(map);

                    btn.addEventListener("click", () => {
                        const busStop = { id, name, gpsLocation: [lat, lng] };
                        setActiveStation({
                            name: busStop.name,
                            coordinates: busStop.gpsLocation,
                            id: busStop.id,
                        });
                        localStorage.setItem(
                            "activeStation",
                            JSON.stringify({
                                name: busStop.name,
                                coordinates: busStop.gpsLocation,
                                id: busStop.id,
                            })
                        );
                        setCurentUrl("/arrivals");
                        document.location.href = "/#/arrivals";
                        popup.remove();
                    });
                });

                // Simple popups for buses and train stops
                const attachPopup = (layerId, formatter) => {
                    map.on("click", layerId, (e) => {
                        const f = e.features?.[0];
                        if (!f) return;
                        const html = formatter(f.properties);
                        new maplibregl.Popup({ closeButton: true })
                            .setLngLat(e.lngLat)
                            .setHTML(html)
                            .addTo(map);
                    });
                    map.on("mouseenter", layerId, () => {
                        map.getCanvas().style.cursor = "pointer";
                    });
                    map.on("mouseleave", layerId, () => {
                        map.getCanvas().style.cursor = "";
                    });
                };

                attachPopup("buses-points", (p) => {
                    const route = p.title || "";
                    const line = p.lineName || "";
                    const op = p.operator || "";
                    // Match Leaflet's simple <p> layout
                    return `\
                        <div style="min-width:160px">\
                            <p>${route}</p>\
                            <p>${line}</p>\
                            <p>${op}</p>\
                        </div>`;
                });

                attachPopup("trainStops-points", (p) => {
                    const name = p.name || "";
                    const id = p.id || "";
                    return (
                        `<div style="min-width:160px">` +
                        `<div style="font-weight:600">${name}</div>` +
                        `<div>ID: ${id}</div>` +
                        `</div>`
                    );
                });
            });
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update sources when data changes
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
        const src = map.getSource("trainStops");
        if (src && src.setData) src.setData(trainStopsGeoJSON);
    }, [trainStopsGeoJSON]);

    // Center map when active station or user location changes
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;
        map.easeTo({ center: [center[1], center[0]], duration: 500 });
    }, [center]);

    // User and active station markers (DOM markers with popups like Leaflet)
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        // helper
        const ensureMarker = (key, coords, img, size = [22, 22], popupText) => {
            // remove existing
            if (markersRef.current[key]) {
                markersRef.current[key].remove();
                markersRef.current[key] = null;
            }
            if (!coords) return;
            const el = document.createElement("img");
            el.src = img;
            el.style.width = `${size[0]}px`;
            el.style.height = `${size[1]}px`;
            el.style.transform = "translate(-50%, -100%)"; // anchor bottom-center
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
