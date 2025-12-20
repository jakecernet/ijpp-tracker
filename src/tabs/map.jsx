import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    ICON_SOURCES,
    operatorToIcon,
    OSM_RASTER_STYLE_DARK,
    OSM_RASTER_STYLE_LIGHT,
} from "./map/config";
import { toGeoJSONPoints, ensureIcons } from "./map/utils";
import {
    setupSourcesAndLayers,
    updateSourceData,
    setPrefixVisible,
} from "./map/layers";
import {
    configureBusStopPopup,
    configureTrainStopPopup,
    configureTrainPopup,
    configureBusPopup,
    configureLppTripStopsPopup,
    configureIjppTripStopsPopup,
    configureSzTripStopsPopup,
} from "./map/interactions";
import LayerSelector from "./map/LayerSelector";

import userPNG from "../img/user.png";
import locationPNG from "../img/location.png";

const STYLE =
    typeof window !== "undefined"
        ? localStorage.getItem("theme") === "dark"
            ? OSM_RASTER_STYLE_DARK
            : OSM_RASTER_STYLE_LIGHT
        : OSM_RASTER_STYLE_LIGHT;

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
                `<h4>${popup}</h4>`
            )
        );
        element.style.cursor = "pointer";
    }

    markersRef.current[key] = marker;
}

const Map = React.memo(function Map({
    gpsPositions,
    busStops,
    trainStops = [],
    activeStation,
    setActiveStation,
    userLocation,
    trainPositions,
    setSelectedVehicle,
    ijppTrip,
    lppRoute,
    szRoute,
    theme,
    setTheme,
}) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({ user: null, active: null });
    const handlersRef = useRef({ setActiveStation, setSelectedVehicle });
    const initialCenterRef = useRef(
        userLocation || activeStation?.coordinates || DEFAULT_CENTER
    );

    const [showFilter, setShowFilter] = useState(false);
    const [filterByRoute, setFilterByRoute] = useState(false);
    const [visibility, setVisibility] = useState({
        buses: true,
        busStops: true,
        trainPositions: true,
        trainStops: true,
    });
    const [busOperators, setBusOperators] = useState({
        arriva: true,
        lpp: true,
        nomago: true,
        marprom: true,
        murska: true,
        generic: true,
    });
    const prevVisibilityRef = useRef(null);

    useEffect(() => {
        handlersRef.current = { setActiveStation, setSelectedVehicle };
    }, [setActiveStation, setSelectedVehicle]);

    // Restore persisted layer settings (visibility, operators, filter)
    useEffect(() => {
        try {
            const raw = localStorage.getItem("mapLayerSettings");
            if (!raw) return;
            const settings = JSON.parse(raw);
            if (settings && typeof settings === "object") {
                if (
                    settings.visibility &&
                    typeof settings.visibility === "object"
                ) {
                    setVisibility((v) => ({ ...v, ...settings.visibility }));
                }
                if (
                    settings.busOperators &&
                    typeof settings.busOperators === "object"
                ) {
                    setBusOperators((b) => ({
                        ...b,
                        ...settings.busOperators,
                    }));
                }
                if (typeof settings.filterByRoute === "boolean") {
                    setFilterByRoute(settings.filterByRoute);
                }
            }
        } catch {}
    }, []);

    const center = useMemo(
        () => activeStation?.coordinates || userLocation || DEFAULT_CENTER,
        [activeStation, userLocation]
    );

    const busesGeoJSON = useMemo(() => {
        let currentRouteInfo = null;
        try {
            const stored = localStorage.getItem("selectedBusRoute");
            if (stored) currentRouteInfo = JSON.parse(stored);
        } catch (error) {
            console.log("[v0] Error reading route from localStorage:", error);
        }

        const filtered = (gpsPositions || []).filter((position) => {
            const brandKey = operatorToIcon[position?.operator] || "generic";
            if (!busOperators[brandKey]) return false;

            if (filterByRoute && currentRouteInfo) {
                if (
                    position.lineNumber !== undefined ||
                    position.lineId !== undefined
                ) {
                    const routeMatch =
                        (currentRouteInfo.lineNumber &&
                            position.lineNumber ===
                                currentRouteInfo.lineNumber) ||
                        (currentRouteInfo.routeName &&
                            position.lineNumber ===
                                currentRouteInfo.routeName) ||
                        (currentRouteInfo.tripId &&
                            position.tripId === currentRouteInfo.tripId);
                    if (!routeMatch) return false;
                } else if (position.tripId !== undefined) {
                    if (
                        currentRouteInfo.tripId &&
                        position.tripId !== currentRouteInfo.tripId
                    )
                        return false;
                }
            }

            return true;
        });

        return toGeoJSONPoints(
            filtered,
            (position) => position?.gpsLocation,
            (position) => {
                const props = { ...position };
                delete props.gpsLocation;

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
                props.brand = operatorToIcon[position?.operator] || "generic";
                props.operator = position?.operator || "";

                return props;
            }
        );
    }, [gpsPositions, busOperators, filterByRoute]);

    const busStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                busStops,
                (stop) => stop?.gpsLocation,
                (stop) => ({
                    id:
                        stop?.ijppID ??
                        stop?.refID ??
                        stop?.ref_id ??
                        stop?.id ??
                        stop?.name,
                    name: stop?.name,
                    icon: "bus-stop",
                    ref_id: stop?.ref_id ?? stop?.refID ?? null,
                    gtfs_id: stop?.gtfs_id ?? null,
                })
            ),
        [busStops]
    );

    const trainStopsGeoJSON = useMemo(
        () =>
            toGeoJSONPoints(
                trainStops,
                (stop) => {
                    const lat = Number(
                        Array.isArray(stop?.gpsLocation)
                            ? stop.gpsLocation[0]
                            : stop?.lat
                    );
                    const lon = Number(
                        Array.isArray(stop?.gpsLocation)
                            ? stop.gpsLocation[1]
                            : stop?.lon
                    );
                    return Number.isFinite(lat) && Number.isFinite(lon)
                        ? [lat, lon]
                        : null;
                },
                (stop) => {
                    const lat = Number(
                        Array.isArray(stop?.gpsLocation)
                            ? stop.gpsLocation[0]
                            : stop?.lat
                    );
                    const lon = Number(
                        Array.isArray(stop?.gpsLocation)
                            ? stop.gpsLocation[1]
                            : stop?.lon
                    );
                    return {
                        id: stop?.stopId ?? stop?.id ?? stop?.name,
                        name: stop?.name ?? "",
                        stopId: stop?.stopId ?? null,
                        icon: "train-stop",
                        lat: Number.isFinite(lat) ? lat : null,
                        lon: Number.isFinite(lon) ? lon : null,
                    };
                }
            ),
        [trainStops]
    );

    const trainPositionsGeoJSON = useMemo(() => {
        let currentRouteInfo = null;
        try {
            const stored = localStorage.getItem("selectedBusRoute");
            if (stored) currentRouteInfo = JSON.parse(stored);
        } catch {}

        const filtered = (trainPositions || []).filter((train) => {
            if (filterByRoute && currentRouteInfo?.tripId) {
                return train.tripId === currentRouteInfo.tripId;
            }
            return true;
        });

        return toGeoJSONPoints(
            filtered,
            (train) => {
                const coord = train?.gpsLocation;
                if (!coord) return null;
                const [lng, lat] = String(coord)
                    .split(",")
                    .map((value) => Number(value.trim()))
                    .slice(0, 2);
                return Number.isFinite(lat) && Number.isFinite(lng)
                    ? [lat, lng]
                    : null;
            },
            (train) => ({
                id: train?.tripId,
                relation: [train?.from?.name, train?.to?.name]
                    .filter(Boolean)
                    .join(" - "),
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
            })
        );
    }, [trainPositions, filterByRoute]);

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
            await ensureIcons(map, ICON_SOURCES);

            setupSourcesAndLayers(map, {
                buses: busesGeoJSON,
                busStops: busStopsGeoJSON,
                trainPositions: trainPositionsGeoJSON,
                trainStops: trainStopsGeoJSON,
            });

            // Setup IJPP trip overlay sources
            if (!map.getSource("ijpp-trip-line-src")) {
                map.addSource("ijpp-trip-line-src", {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: [] },
                        properties: {},
                    },
                });
            }
            if (!map.getLayer("ijpp-trip-line")) {
                map.addLayer({
                    id: "ijpp-trip-line",
                    type: "line",
                    source: "ijpp-trip-line-src",
                    paint: {
                        "line-color": "#1976d2",
                        "line-width": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            10,
                            3,
                            14,
                            5,
                            16,
                            7,
                        ],
                        "line-opacity": 0.9,
                    },
                    layout: { "line-cap": "round", "line-join": "round" },
                });
            }

            if (!map.getSource("ijpp-trip-stops-src")) {
                map.addSource("ijpp-trip-stops-src", {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [] },
                });
            }
            if (!map.getLayer("ijpp-trip-stops-points")) {
                map.addLayer({
                    id: "ijpp-trip-stops-points",
                    type: "symbol",
                    source: "ijpp-trip-stops-src",
                    layout: {
                        "icon-image": "route-stop",
                        "icon-size": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            8,
                            0.22,
                            12,
                            0.3,
                            14,
                            0.38,
                            16,
                            0.46,
                        ],
                        "icon-anchor": "bottom",
                        "icon-allow-overlap": true,
                    },
                });
            }

            // Setup LPP trip overlay sources
            if (!map.getSource("lpp-trip-line-src")) {
                map.addSource("lpp-trip-line-src", {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: [] },
                        properties: {},
                    },
                });
            }
            if (!map.getLayer("lpp-trip-line")) {
                map.addLayer({
                    id: "lpp-trip-line",
                    type: "line",
                    source: "lpp-trip-line-src",
                    paint: {
                        "line-color": "#2e7d32",
                        "line-width": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            10,
                            3,
                            14,
                            5,
                            16,
                            7,
                        ],
                        "line-opacity": 0.9,
                    },
                    layout: { "line-cap": "round", "line-join": "round" },
                });
            }
            if (!map.getSource("lpp-trip-stops-src")) {
                map.addSource("lpp-trip-stops-src", {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [] },
                });
            }
            if (!map.getLayer("lpp-trip-stops-points")) {
                map.addLayer({
                    id: "lpp-trip-stops-points",
                    type: "symbol",
                    source: "lpp-trip-stops-src",
                    layout: {
                        "icon-image": "route-stop",
                        "icon-size": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            8,
                            0.22,
                            12,
                            0.3,
                            14,
                            0.38,
                            16,
                            0.46,
                        ],
                        "icon-anchor": "bottom",
                        "icon-allow-overlap": true,
                    },
                });
            }

            // Setup SZ trip overlay sources
            if (!map.getSource("sz-trip-line-src")) {
                map.addSource("sz-trip-line-src", {
                    type: "geojson",
                    data: {
                        type: "Feature",
                        geometry: { type: "LineString", coordinates: [] },
                        properties: {},
                    },
                });
            }
            if (!map.getLayer("sz-trip-line")) {
                map.addLayer({
                    id: "sz-trip-line",
                    type: "line",
                    source: "sz-trip-line-src",
                    paint: {
                        "line-color": "#29ace2",
                        "line-width": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            10,
                            3,
                            14,
                            5,
                            16,
                            7,
                        ],
                        "line-opacity": 0.9,
                    },
                    layout: { "line-cap": "round", "line-join": "round" },
                });
            }
            if (!map.getSource("sz-trip-stops-src")) {
                map.addSource("sz-trip-stops-src", {
                    type: "geojson",
                    data: { type: "FeatureCollection", features: [] },
                });
            }
            if (!map.getLayer("sz-trip-stops-points")) {
                map.addLayer({
                    id: "sz-trip-stops-points",
                    type: "symbol",
                    source: "sz-trip-stops-src",
                    layout: {
                        "icon-image": "route-stop",
                        "icon-size": [
                            "interpolate",
                            ["linear"],
                            ["zoom"],
                            8,
                            0.22,
                            12,
                            0.3,
                            14,
                            0.38,
                            16,
                            0.46,
                        ],
                        "icon-anchor": "bottom",
                        "icon-allow-overlap": true,
                    },
                });
            }

            // Restore persisted IJPP trip overlay
            try {
                const persisted = JSON.parse(
                    localStorage.getItem("ijppTripOverlay") || "null"
                );
                if (persisted && typeof persisted === "object") {
                    const lineSource = map.getSource("ijpp-trip-line-src");
                    const stopsSource = map.getSource("ijpp-trip-stops-src");
                    if (lineSource && lineSource.setData && persisted.line)
                        lineSource.setData(persisted.line);
                    if (stopsSource && stopsSource.setData && persisted.stops)
                        stopsSource.setData(persisted.stops);
                }
            } catch {}

            // Restore persisted LPP trip overlay
            try {
                const persisted = JSON.parse(
                    localStorage.getItem("lppTripOverlay") || "null"
                );
                if (persisted && typeof persisted === "object") {
                    const lineSource = map.getSource("lpp-trip-line-src");
                    const stopsSource = map.getSource("lpp-trip-stops-src");
                    if (lineSource && lineSource.setData && persisted.line)
                        lineSource.setData(persisted.line);
                    if (stopsSource && stopsSource.setData && persisted.stops)
                        stopsSource.setData(persisted.stops);
                }
            } catch {}

            // Restore persisted SZ trip overlay
            try {
                const persisted = JSON.parse(
                    localStorage.getItem("szTripOverlay") || "null"
                );
                if (persisted && typeof persisted === "object") {
                    const lineSource = map.getSource("sz-trip-line-src");
                    const stopsSource = map.getSource("sz-trip-stops-src");
                    if (lineSource && lineSource.setData && persisted.line)
                        lineSource.setData(persisted.line);
                    if (stopsSource && stopsSource.setData && persisted.stops)
                        stopsSource.setData(persisted.stops);
                }
            } catch {}

            // Configure all popups
            configureBusStopPopup({
                map,
                onSelectStop: (stop) => {
                    const payload = {
                        name: stop.name,
                        coordinates: stop.gpsLocation,
                        id: stop.id,
                        ref_id: stop.ref_id,
                        gtfs_id: stop.gtfs_id,
                        type: "bus-stop",
                    };
                    handlersRef.current.setActiveStation(payload);
                    localStorage.setItem(
                        "activeStation",
                        JSON.stringify(payload)
                    );
                    window.location.hash = "/arrivals";
                },
            });

            configureTrainStopPopup({
                map,
                onSelectStop: (stop) => {
                    const coordinates = Array.isArray(stop?.gpsLocation)
                        ? stop.gpsLocation
                        : [stop?.lat, stop?.lon];
                    if (
                        !Array.isArray(coordinates) ||
                        !Number.isFinite(coordinates[0]) ||
                        !Number.isFinite(coordinates[1])
                    ) {
                        return;
                    }
                    const payload = {
                        name: stop.name,
                        coordinates,
                        gpsLocation: coordinates,
                        stopId: stop.stopId ?? null,
                        id: stop.id ?? stop.stopId ?? stop.name,
                        lat: coordinates[0],
                        lon: coordinates[1],
                        type: "train-stop",
                    };
                    handlersRef.current.setActiveStation(payload);
                    localStorage.setItem(
                        "activeStation",
                        JSON.stringify(payload)
                    );
                    window.location.hash = "/arrivals";
                },
            });

            configureTrainPopup({
                map,
                onSelectVehicle: (vehicle) => {
                    try {
                        localStorage.setItem(
                            "selectedBusRoute",
                            JSON.stringify(vehicle)
                        );
                    } catch (err) {
                        console.warn("Shranjevanje ni uspelo:", err);
                    }
                    handlersRef.current.setSelectedVehicle(vehicle);
                    // Enable route-only SZ view and hide buses & stations
                    prevVisibilityRef.current = visibility;
                    setFilterByRoute(true);
                    setVisibility({
                        buses: false,
                        busStops: false,
                        trainPositions: true,
                        trainStops: false,
                    });
                },
                onNavigateRoute: () => {
                    window.location.hash = "/route";
                },
            });

            configureBusPopup({
                map,
                onSelectVehicle: (vehicle) => {
                    try {
                        localStorage.setItem(
                            "selectedBusRoute",
                            JSON.stringify(vehicle)
                        );
                    } catch (err) {
                        console.warn("Shranjevanje ni uspelo:", err);
                    }
                    handlersRef.current.setSelectedVehicle(vehicle);
                    // Enable route-only bus view and hide stations & SZ markers
                    prevVisibilityRef.current = visibility;
                    setFilterByRoute(true);
                    setVisibility({
                        buses: true,
                        busStops: false,
                        trainPositions: false,
                        trainStops: false,
                    });
                },
                onNavigateRoute: () => {
                    window.location.hash = "/route";
                },
            });

            configureIjppTripStopsPopup({
                map,
                onNavigateRoute: () => {
                    // Enable route-only bus view when navigating from IJPP route stops
                    prevVisibilityRef.current = visibility;
                    setFilterByRoute(true);
                    setVisibility({
                        buses: true,
                        busStops: false,
                        trainPositions: false,
                        trainStops: false,
                    });
                    window.location.hash = "/route";
                },
            });

            // Add popup for LPP route stop markers
            configureLppTripStopsPopup({
                map,
                onNavigateRoute: () => {
                    // Enable route-only bus view when navigating from LPP route stops
                    prevVisibilityRef.current = visibility;
                    setFilterByRoute(true);
                    setVisibility({
                        buses: true,
                        busStops: false,
                        trainPositions: false,
                        trainStops: false,
                    });
                    window.location.hash = "/route";
                },
            });

            // Add popup for SZ route stop markers
            configureSzTripStopsPopup({
                map,
                onNavigateRoute: () => {
                    // Enable route-only SZ view when navigating from SZ route stops
                    prevVisibilityRef.current = visibility;
                    setFilterByRoute(true);
                    setVisibility({
                        buses: false,
                        busStops: false,
                        trainPositions: true,
                        trainStops: false,
                    });
                    window.location.hash = "/route";
                },
            });
        });

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update GeoJSON sources
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        updateSourceData(map, "buses", busesGeoJSON);
        updateSourceData(map, "busStops", busStopsGeoJSON);
        updateSourceData(map, "trainPositions", trainPositionsGeoJSON);
        updateSourceData(map, "trainStops", trainStopsGeoJSON);
    }, [
        busesGeoJSON,
        busStopsGeoJSON,
        trainPositionsGeoJSON,
        trainStopsGeoJSON,
    ]);

    // Apply layer visibility
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        setPrefixVisible(map, "buses", visibility.buses);
        setPrefixVisible(map, "busStops", visibility.busStops);
        setPrefixVisible(map, "trainStops", visibility.trainStops);
        setPrefixVisible(map, "trainPositions", visibility.trainPositions);
    }, [visibility]);

    // Persist layer settings as a single localStorage item
    useEffect(() => {
        try {
            const payload = {
                visibility,
                busOperators,
                filterByRoute,
            };
            localStorage.setItem("mapLayerSettings", JSON.stringify(payload));
        } catch {}
    }, [visibility, busOperators, filterByRoute]);

    // Update IJPP trip overlays
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const lineSource = map.getSource("ijpp-trip-line-src");
        const stopsSource = map.getSource("ijpp-trip-stops-src");

        const lineData = ijppTrip?.geometry?.length
            ? {
                  type: "Feature",
                  geometry: {
                      type: "LineString",
                      coordinates: ijppTrip.geometry.filter(
                          (c) => Array.isArray(c) && c.length >= 2
                      ),
                  },
                  properties: {},
              }
            : {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: [] },
                  properties: {},
              };

        const stopsData = {
            type: "FeatureCollection",
            features: Array.isArray(ijppTrip?.stops)
                ? ijppTrip.stops
                      .map((s) => {
                          const coord = Array.isArray(s?.gpsLocation)
                              ? s.gpsLocation
                              : null;
                          if (
                              !coord ||
                              !Number.isFinite(coord[0]) ||
                              !Number.isFinite(coord[1])
                          )
                              return null;
                          return {
                              type: "Feature",
                              geometry: {
                                  type: "Point",
                                  coordinates: [coord[1], coord[0]],
                              },
                              properties: { name: s?.name || "" },
                          };
                      })
                      .filter(Boolean)
                : [],
        };

        if (lineSource && lineSource.setData) lineSource.setData(lineData);
        if (stopsSource && stopsSource.setData) stopsSource.setData(stopsData);

        try {
            localStorage.setItem(
                "ijppTripOverlay",
                JSON.stringify({ line: lineData, stops: stopsData })
            );
        } catch {}
    }, [ijppTrip]);

    // Update LPP trip overlays
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const lineSource = map.getSource("lpp-trip-line-src");
        const stopsSource = map.getSource("lpp-trip-stops-src");

        const lineCoords = Array.isArray(lppRoute?.geometry?.[0]?.points)
            ? lppRoute.geometry[0].points
                  .filter((c) => Array.isArray(c) && c.length >= 2)
                  .map((c) => [c[1], c[0]])
            : [];

        const lineData = {
            type: "Feature",
            geometry: { type: "LineString", coordinates: lineCoords },
            properties: {},
        };

        const stopsData = {
            type: "FeatureCollection",
            features: Array.isArray(lppRoute?.stops)
                ? lppRoute.stops
                      .map((s) => {
                          let coord = null;
                          if (Array.isArray(s?.stop_location)) {
                              coord = [s.stop_location[0], s.stop_location[1]];
                          } else if (
                              s?.stop_location &&
                              typeof s.stop_location === "object"
                          ) {
                              const lat = Number(
                                  s.stop_location.lat ?? s.stop_location[0]
                              );
                              const lon = Number(
                                  s.stop_location.lon ?? s.stop_location[1]
                              );
                              coord =
                                  Number.isFinite(lat) && Number.isFinite(lon)
                                      ? [lat, lon]
                                      : null;
                          } else if (Array.isArray(s?.gpsLocation)) {
                              coord = s.gpsLocation;
                          } else {
                              const lat = Number(
                                  s.latitude ?? s.lat ?? s.stop_lat ?? null
                              );
                              const lon = Number(
                                  s.longitude ?? s.lon ?? s.stop_lon ?? null
                              );
                              coord =
                                  Number.isFinite(lat) && Number.isFinite(lon)
                                      ? [lat, lon]
                                      : null;
                          }
                          if (
                              !coord ||
                              !Number.isFinite(coord[0]) ||
                              !Number.isFinite(coord[1])
                          )
                              return null;
                          return {
                              type: "Feature",
                              geometry: {
                                  type: "Point",
                                  coordinates: [coord[1], coord[0]],
                              },
                              properties: {
                                  name:
                                      s?.name ||
                                      s?.stop_name ||
                                      s?.station_name ||
                                      s?.route_name ||
                                      "",
                              },
                          };
                      })
                      .filter(Boolean)
                : [],
        };

        if (lineSource && lineSource.setData) lineSource.setData(lineData);
        if (stopsSource && stopsSource.setData) stopsSource.setData(stopsData);

        try {
            localStorage.setItem(
                "lppTripOverlay",
                JSON.stringify({ line: lineData, stops: stopsData })
            );
        } catch {}
    }, [lppRoute]);

    // Update SZ trip overlays
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const lineSource = map.getSource("sz-trip-line-src");
        const stopsSource = map.getSource("sz-trip-stops-src");

        const lineCoords = Array.isArray(szRoute?.geometry)
            ? szRoute.geometry
                  .filter((c) => Array.isArray(c) && c.length >= 2)
                  // geometry already [lng, lat]
                  .map((c) => [c[0], c[1]])
            : [];

        const lineData = {
            type: "Feature",
            geometry: { type: "LineString", coordinates: lineCoords },
            properties: {},
        };

        // Build features for start (from), intermediate stops, and end (to)
        const features = [];

        const pushStop = (s) => {
            if (!s) return;
            const coord = Array.isArray(s?.gpsLocation)
                ? s.gpsLocation
                : [s?.lat, s?.lon];
            if (
                !coord ||
                !Number.isFinite(coord[0]) ||
                !Number.isFinite(coord[1])
            )
                return;
            features.push({
                type: "Feature",
                geometry: { type: "Point", coordinates: [coord[1], coord[0]] },
                properties: { name: s?.name || "" },
            });
        };

        // include start and end stops
        pushStop(szRoute?.from);
        if (Array.isArray(szRoute?.stops)) szRoute.stops.forEach(pushStop);
        pushStop(szRoute?.to);

        const stopsData = {
            type: "FeatureCollection",
            features,
        };

        if (lineSource && lineSource.setData) lineSource.setData(lineData);
        if (stopsSource && stopsSource.setData) stopsSource.setData(stopsData);

        try {
            localStorage.setItem(
                "szTripOverlay",
                JSON.stringify({ line: lineData, stops: stopsData })
            );
        } catch {}
    }, [szRoute]);

    // Update map center
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map || !center) return;
        map.easeTo({ center: [center[1], center[0]], duration: 500 });
    }, [center]);

    // Update markers
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
        <div>
            <div className="map-container" style={{ position: "relative" }}>
                <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
                <LayerSelector
                    showFilter={showFilter}
                    setShowFilter={setShowFilter}
                    visibility={visibility}
                    setVisibility={setVisibility}
                    busOperators={busOperators}
                    setBusOperators={setBusOperators}
                    setTheme={setTheme}
                />
                {filterByRoute && (
                    <div
                        style={{
                            position: "absolute",
                            top: 12,
                            left: 12,
                            background: "rgba(0,0,0,0.6)",
                            color: "#fff",
                            padding: "6px 10px",
                            borderRadius: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            zIndex: 10,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                        }}
                        aria-live="polite"
                    >
                        <span style={{ fontSize: 13 }}>
                            Samo izbrana linija
                        </span>
                        <button
                            type="button"
                            aria-label="Izklopi filter linije"
                            onClick={() => {
                                setFilterByRoute(false);
                                const prev = prevVisibilityRef.current;
                                if (prev && typeof prev === "object") {
                                    setVisibility(prev);
                                } else {
                                    setVisibility({
                                        buses: true,
                                        busStops: true,
                                        trainPositions: true,
                                        trainStops: true,
                                    });
                                }
                            }}
                            style={{
                                background: "transparent",
                                color: "#fff",
                                border: "1px solid rgba(255,255,255,0.6)",
                                borderRadius: 6,
                                padding: "2px 6px",
                                cursor: "pointer",
                                fontSize: 12,
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default Map;
