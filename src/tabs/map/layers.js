import {
    CLUSTER_CONFIG,
    ICON_SIZE_BY_LAYER,
    ICON_ANCHOR_BY_LAYER,
    BRAND_COLORS,
    HALO_RADIUS,
} from "./config";

export function registerHaloLayer(map, prefix) {
    const id = `${prefix}-halo`;
    if (map.getLayer(id)) return;

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
        BRAND_COLORS.default.fill,
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
        BRAND_COLORS.default.stroke,
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

export function setupSourcesAndLayers(map, dataBySource) {
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
        if (!["busStops", "trainStops"].includes(id)) {
            registerHaloLayer(map, id);
        }
        registerClusterInteraction(map, id);
    });
}

export function updateSourceData(map, id, data) {
    const source = map.getSource(id);
    if (source && source.setData) source.setData(data);
}

export function setPrefixVisible(map, prefix, visible) {
    const vis = visible ? "visible" : "none";
    const layers = [
        `${prefix}-points`,
        `${prefix}-clusters`,
        `${prefix}-cluster-count`,
        `${prefix}-halo`,
    ];
    layers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", vis);
        }
    });
}
