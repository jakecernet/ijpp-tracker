import arrivaPNG from "../../img/arriva.png";
import lppPNG from "../../img/lpp.png";
import nomagoPNG from "../../img/nomago.png";
import marpromPNG from "../../img/marprom.png";
import murskaPNG from "../../img/murska.png";
import kranjPNG from "../../img/kranj.png";
import busStopPNG from "../../img/routeStop2.png";
import trainStopPNG from "../../img/trainStop.png";
import szPNG from "../../img/sz.png";

export const DEFAULT_CENTER = [46.0569, 14.5058];
export const DEFAULT_ZOOM = 13;

export const OSM_STYLE_LIGHT = {
	version: 8,
	sources: {
		osm: {
			type: "raster",
			tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			tileSize: 256,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		},
	},
	glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
	layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export const OSM_STYLE_DARK =
	"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json?key=cb1_31r1_1_de984037cd54e589a6e6ce68";

export const ICON_SOURCES = [
	{ id: "bus-stop", image: busStopPNG },
	{ id: "train-stop", image: trainStopPNG },
	{ id: "train", image: szPNG },
	{ id: "arriva", image: arrivaPNG },
	{ id: "lpp", image: lppPNG },
	{ id: "nomago", image: nomagoPNG },
	{ id: "marprom", image: marpromPNG },
	{ id: "murska", image: murskaPNG },
	{ id: "kranj", image: kranjPNG },
];

export const CLUSTER_CONFIG = {
	buses: { radius: 50, maxZoom: 14, color: "#4CAF50" },
	busStops: { radius: 60, maxZoom: 14, color: "#7E57C2" },
	trainPositions: { radius: 90, maxZoom: 14, color: "#0091EA" },
	trainStops: { radius: 70, maxZoom: 14, color: "#FF7043" },
};

/** Velikost ikone glede na zoom: pari [zoom, velikost]. */
const zoomRamp = (...stops) => [
	"interpolate",
	["linear"],
	["zoom"],
	...stops.flat(),
];

export const ICON_SIZE_BY_LAYER = {
	buses: zoomRamp([10, 0.2], [13, 0.25], [15, 0.31], [17, 0.36]),
	busStops: zoomRamp([10, 0.28], [13, 0.36], [15, 0.44], [17, 0.52]),
	trainPositions: zoomRamp([10, 0.2], [13, 0.25], [15, 0.31], [17, 0.36]),
	trainStops: zoomRamp([10, 0.28], [13, 0.36], [15, 0.44], [17, 0.52]),
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
	"Ljubljanski potniški promet, d.o.o.": "lpp",
	"Nomago d.o.o.": "nomago",
	"Arriva d.o.o.": "arriva",
	Marprom: "marprom",
	"AP Murska Sobota, d.d.": "murska",
	"Avtobusni promet Murska Sobota d.d.": "murska",
	MP_Kranj: "kranj",
	"SŽ - Potniški promet, d.o.o.": "sz",
};

export const HALO_RADIUS = zoomRamp([10, 14], [13, 18], [15, 22], [17, 26]);

// Velikost puščice, usklajena s polmerom kroga (ikona ima krog polmera 16 px pri size 1).
export const HALO_ARROW_SIZE = zoomRamp(
	[10, 0.875],
	[13, 1.125],
	[15, 1.375],
	[17, 1.625],
);
