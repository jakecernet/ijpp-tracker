import arrivaPNG from "../../img/arriva.png";
import lppPNG from "../../img/lpp.png";
import nomagoPNG from "../../img/nomago.png";
import marpromPNG from "../../img/marprom.png";
import murskaPNG from "../../img/murska.png";
import userPNG from "../../img/user.png";
import busStopPNG from "../../img/busStop.png";
import trainStopPNG from "../../img/trainStop.png";
import szPNG from "../../img/sz.png";
import locationPNG from "../../img/location.png";
import routeStop from "../../img/routeStop2.png";

export const DEFAULT_CENTER = [46.0569, 14.5058];
export const DEFAULT_ZOOM = 13;

export const OSM_RASTER_STYLE_DARK = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
    },
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const OSM_RASTER_STYLE_LIGHT = {
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
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
    },
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const ICON_SOURCES = [
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
    { id: "route-stop", image: routeStop },
];

// TODO: fix this shit and unify icons
export const CLUSTER_CONFIG = {
    buses: { radius: 40, maxZoom: 14, color: "#5b8cff" },
    busStops: { radius: 60, maxZoom: 20, color: "#7a5bff" },
    trainPositions: { radius: 80, maxZoom: 15, color: "#ff5b5b" },
    trainStops: { radius: 60, maxZoom: 20, color: "#ffa45b" },
};

export const ICON_SIZE_BY_LAYER = {
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
    trainStops: [
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
    routeStops: [
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
};

export const ICON_ANCHOR_BY_LAYER = {
    buses: "center",
    busStops: "bottom",
    trainPositions: "center",
    trainStops: "bottom",
};

export const BRAND_COLORS = {
    arriva: { fill: "#5bc0ff", stroke: "#0091ea" },
    sz: { fill: "#5bc9ff", stroke: "#0091ea" },
    nomago: { fill: "#ffeb3b", stroke: "#fbc02d" },
    lpp: { fill: "#4caf50", stroke: "#388e3c" },
    marprom: { fill: "#f44336", stroke: "#d32f2f" },
    default: { fill: "#607d8b", stroke: "#455a64" },
};

export const operatorToIcon = {
    "Ljubljanski potniški promet d.o.o.": "lpp",
    "Nomago d.o.o.": "nomago",
    "Arriva d.o.o.": "arriva",
    Marprom: "marprom",
    "AP Murska Sobota, d.d.": "murska",
};

export const HALO_RADIUS = [
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
