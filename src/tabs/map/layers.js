import {
	zoomRamp,
	CLUSTER_CONFIG,
	ICON_SIZE_BY_LAYER,
	ICON_ANCHOR_BY_LAYER,
	BRAND_COLORS,
	HALO_RADIUS,
	HALO_ARROW_SIZE,
} from "./config";

const BRAND_COLOR_KEY = {
	arriva: "arriva",
	sz: "sz",
	nomago: "nomago",
	lpp: "lpp",
	marprom: "marprom",
	murska: "arriva",
	kranj: "marprom",
};

function brandColorExpr(part) {
	const expr = ["match", ["coalesce", ["get", "brand"], ["get", "icon"]]];
	for (const [brand, key] of Object.entries(BRAND_COLOR_KEY)) {
		expr.push(brand, BRAND_COLORS[key][part]);
	}
	expr.push(BRAND_COLORS.default[part]);
	return ["coalesce", ["get", "lineColor"], expr];
}

// Izrazi za barvo črte/krogov (obroba = temnejši odtenek).
export const BRAND_COLOR_EXPR = brandColorExpr("stroke");
const HALO_COLOR_EXPR = brandColorExpr("fill");
const HALO_STROKE_EXPR = BRAND_COLOR_EXPR;

const TRIP_LINE_WIDTH = [
	"interpolate",
	["linear"],
	["zoom"],
	...[10, 3, 14, 5, 16, 7],
];

const EMPTY_LINE = {
	type: "Feature",
	geometry: { type: "LineString", coordinates: [] },
	properties: {},
};
const EMPTY_FEATURES = { type: "FeatureCollection", features: [] };

export function setupTripOverlay(map, prefix, colorExpr = BRAND_COLOR_EXPR) {
	const lineSrc = `${prefix}-trip-line-src`;
	const stopsSrc = `${prefix}-trip-stops-src`;
	const lineLayer = `${prefix}-trip-line`;
	const stopsLayer = `${prefix}-trip-stops-points`;

	if (!map.getSource(lineSrc)) {
		map.addSource(lineSrc, { type: "geojson", data: EMPTY_LINE });
	}
	if (!map.getLayer(lineLayer)) {
		map.addLayer({
			id: lineLayer,
			type: "line",
			source: lineSrc,
			paint: {
				"line-color": colorExpr,
				"line-width": TRIP_LINE_WIDTH,
				"line-opacity": 0.9,
			},
			layout: { "line-cap": "round", "line-join": "round" },
		});
	}
	if (!map.getSource(stopsSrc)) {
		map.addSource(stopsSrc, { type: "geojson", data: EMPTY_FEATURES });
	}
	if (!map.getLayer(stopsLayer)) {
		map.addLayer({
			id: stopsLayer,
			type: "circle",
			source: stopsSrc,
			paint: {
				"circle-color": colorExpr,
				"circle-radius": 6,
				"circle-stroke-color": "#ffffff",
				"circle-stroke-width": 2,
			},
		});
	}
}

export function clearTripOverlay(map, prefix) {
	const lineSrc = map.getSource(`${prefix}-trip-line-src`);
	const stopsSrc = map.getSource(`${prefix}-trip-stops-src`);
	if (lineSrc?.setData) lineSrc.setData(EMPTY_LINE);
	if (stopsSrc?.setData) stopsSrc.setData(EMPTY_FEATURES);
}

export function updateTripOverlay(
	map,
	prefix,
	lineCoords,
	stopsFeatures,
	brand,
	lineColor = null,
) {
	const lineSrc = map.getSource(`${prefix}-trip-line-src`);
	const stopsSrc = map.getSource(`${prefix}-trip-stops-src`);

	const isMulti =
		lineCoords.length > 0 &&
		Array.isArray(lineCoords[0]) &&
		Array.isArray(lineCoords[0][0]);

	const lineData = {
		type: "Feature",
		geometry: isMulti
			? { type: "MultiLineString", coordinates: lineCoords }
			: { type: "LineString", coordinates: lineCoords },
		properties: { brand: brand || "generic", lineColor },
	};
	const stopsData = { type: "FeatureCollection", features: stopsFeatures };

	if (lineSrc?.setData) lineSrc.setData(lineData);
	if (stopsSrc?.setData) stopsSrc.setData(stopsData);
}

export function registerHaloLayer(map, prefix) {
	const id = `${prefix}-halo`;
	if (map.getLayer(id)) return;

	map.addLayer(
		{
			id,
			type: "circle",
			source: prefix,
			filter: ["!", ["has", "point_count"]],
			paint: {
				"circle-color": HALO_COLOR_EXPR,
				"circle-radius": HALO_RADIUS,
				"circle-stroke-color": HALO_STROKE_EXPR,
				"circle-stroke-width": 3,
				"circle-opacity": 0.8,
				"circle-stroke-opacity": 1,
			},
		},
		`${prefix}-points`,
	);
}

// Puščica smeri vožnje: SDF ikona (barva po operaterju), vrtimo jo po
// `heading` (avtobusi) oziroma `bearing` (vlaki). Brez znane smeri je ni.
export const ARROW_ICON_ID = "heading-arrow";
const HEADING_EXPR = [
	"to-number",
	["coalesce", ["get", "bearing"], ["get", "heading"]],
	-1,
];

export function ensureArrowIcon(map) {
	if (map.hasImage(ARROW_ICON_ID)) return;
	const size = 144;
	const c = size / 2;
	const R = 32; // polmer kroga na ikoni (16 px pri size 1)
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.fillStyle = "#000";
	// Raven trikotnik: osnova je široka kot krog (premer 2R), stranici gresta
	// ravno v konico. Del znotraj kroga izrežemo, vidi se le konica.
	ctx.beginPath();
	ctx.moveTo(c - R, c);
	ctx.lineTo(c, 2);
	ctx.lineTo(c + R, c);
	ctx.closePath();
	ctx.fill();
	ctx.globalCompositeOperation = "destination-out";
	ctx.beginPath();
	ctx.arc(c, c, R - 2, 0, Math.PI * 2);
	ctx.fill();
	const data = ctx.getImageData(0, 0, size, size);
	map.addImage(ARROW_ICON_ID, data, { sdf: true, pixelRatio: 2 });
}

export function registerArrowLayer(map, prefix) {
	const id = `${prefix}-arrow`;
	if (map.getLayer(id)) return;
	ensureArrowIcon(map);
	map.addLayer(
		{
			id,
			type: "symbol",
			source: prefix,
			filter: [
				"all",
				["!", ["has", "point_count"]],
				[">=", HEADING_EXPR, 0],
			],
			layout: {
				"icon-image": ARROW_ICON_ID,
				"icon-rotate": HEADING_EXPR,
				"icon-rotation-alignment": "map",
				"icon-pitch-alignment": "map",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				// pixelRatio 2 → ikona je 72 px; polmer kroga na ikoni = 16 px
				"icon-size": HALO_ARROW_SIZE,
			},
			paint: {
				"icon-color": BRAND_COLOR_EXPR,
				"icon-halo-color": "#ffffff",
				"icon-halo-width": 0,
			},
		},
		`${prefix}-points`,
	);
}

const BLOB_SOURCES = new Set(["busStops", "trainStops"]);
const blobUrls = new Map();

function setBlobData(source, id, data) {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(data)], { type: "application/json" }),
	);
	const previous = blobUrls.get(id);
	blobUrls.set(id, url);
	source.setData(url);
	// Worker lahko prejšnji URL še bere; sprostimo ga zamaknjeno.
	if (previous) setTimeout(() => URL.revokeObjectURL(previous), 30000);
}

function ensureSource(map, id, data, cluster, radius, maxZoom) {
	if (map.getSource(id)) return;
	map.addSource(id, {
		type: "geojson",
		data: BLOB_SOURCES.has(id) ? EMPTY_FEATURES : data,
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
					...[14, 10, 18, 50, 22, 100, 26],
				],
				"circle-opacity": 0.85,
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
				"text-size": 12,
				"text-allow-overlap": true,
			},
			paint: { "text-color": "#ffffff" },
		});
	}
}

function ensurePointLayer(map, id, iconSize, anchor) {
	if (map.getLayer(`${id}-points`)) return;

	// Vehicle layers (buses, trains) should always show on top
	const isVehicle = id === "buses" || id === "trainPositions";

	map.addLayer({
		id: `${id}-points`,
		type: "symbol",
		source: id,
		filter: ["!", ["has", "point_count"]],
		layout: {
			"icon-image": ["get", "icon"],
			"icon-allow-overlap": isVehicle,
			"icon-ignore-placement": isVehicle,
			"icon-size": iconSize,
			"icon-anchor": anchor,
			"symbol-sort-key": isVehicle ? 1 : 0,
		},
	});
}

const STOP_CIRCLE_STYLE = {
	busStops: { color: "#3b80c3", glyph: "stop-glyph-bus" },
	trainStops: { color: "#e64c3c", glyph: "stop-glyph-train" },
};
const STOP_CIRCLE_RADIUS = zoomRamp([10, 5], [13, 8], [15, 11], [17, 14]);
const STOP_CIRCLE_STROKE = zoomRamp([10, 1.5], [15, 2], [17, 2.5]);
// Simbol ~1,1 × polmer krogca; vsebina ikone je ~26 px pri size 1.
const STOP_GLYPH_SIZE = zoomRamp(
	[12, 0.26],
	[13, 0.34],
	[15, 0.47],
	[17, 0.59],
);
const STOP_GLYPH_MIN_ZOOM = 12;

function roundRectPath(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function drawGlyph(kind) {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	ctx.fillStyle = "#000";
	ctx.strokeStyle = "#000";
	ctx.lineCap = "round";

	if (kind === "bus") {
		roundRectPath(ctx, 12, 8, 40, 40, 7);
		ctx.fill();
		ctx.fillRect(16, 46, 9, 10);
		ctx.fillRect(39, 46, 9, 10);
		ctx.globalCompositeOperation = "destination-out";
		roundRectPath(ctx, 17, 14, 30, 15, 3);
		ctx.fill();
		for (const x of [23, 41]) {
			ctx.beginPath();
			ctx.arc(x, 38, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
	} else {
		roundRectPath(ctx, 14, 6, 36, 42, 9);
		ctx.fill();
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.moveTo(23, 48);
		ctx.lineTo(16, 59);
		ctx.moveTo(41, 48);
		ctx.lineTo(48, 59);
		ctx.stroke();
		ctx.globalCompositeOperation = "destination-out";
		roundRectPath(ctx, 19, 12, 26, 15, 3);
		ctx.fill();
		for (const x of [24, 40]) {
			ctx.beginPath();
			ctx.arc(x, 38, 3.2, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	return ctx.getImageData(0, 0, size, size);
}

function ensureStopGlyphs(map) {
	for (const [id, kind] of [
		["stop-glyph-bus", "bus"],
		["stop-glyph-train", "train"],
	]) {
		if (!map.hasImage(id)) {
			map.addImage(id, drawGlyph(kind), { sdf: true, pixelRatio: 2 });
		}
	}
}

function ensureStopCircleLayer(map, id) {
	if (map.getLayer(`${id}-points`)) return;
	const style = STOP_CIRCLE_STYLE[id];
	map.addLayer({
		id: `${id}-points`,
		type: "circle",
		source: id,
		filter: ["!", ["has", "point_count"]],
		paint: {
			"circle-color": style.color,
			"circle-radius": STOP_CIRCLE_RADIUS,
			"circle-stroke-color": "#ffffff",
			"circle-stroke-width": STOP_CIRCLE_STROKE,
		},
	});

	ensureStopGlyphs(map);
	map.addLayer({
		id: `${id}-glyph`,
		type: "symbol",
		source: id,
		minzoom: STOP_GLYPH_MIN_ZOOM,
		filter: ["!", ["has", "point_count"]],
		layout: {
			"icon-image": style.glyph,
			"icon-size": STOP_GLYPH_SIZE,
			"icon-allow-overlap": true,
			"icon-ignore-placement": true,
		},
		paint: { "icon-color": "#ffffff" },
	});
}

function registerClusterInteraction(map, prefix) {
	map.on("click", `${prefix}-clusters`, (event) => {
		const features = map.queryRenderedFeatures(event.point, {
			layers: [`${prefix}-clusters`],
		});
		const clusterId = features[0]?.properties?.cluster_id;
		if (!clusterId) return;
		map.getSource(prefix)
			?.getClusterExpansionZoom(clusterId)
			.then((zoom) =>
				map.easeTo({ center: features[0].geometry.coordinates, zoom }),
			)
			.catch(() => {});
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
			config.maxZoom,
		);
		ensureClusterLayers(map, id, config.color);
		if (id === "busStops" || id === "trainStops") {
			ensureStopCircleLayer(map, id);
		} else {
			ensurePointLayer(
				map,
				id,
				ICON_SIZE_BY_LAYER[id],
				ICON_ANCHOR_BY_LAYER[id],
			);
			registerHaloLayer(map, id);
			registerArrowLayer(map, id);
		}
	});
}

export function registerClusterInteractions(map) {
	Object.keys(CLUSTER_CONFIG).forEach((id) =>
		registerClusterInteraction(map, id),
	);
}

export function updateSourceData(map, id, data) {
	const source = map.getSource(id);
	if (!source || !source.setData) return;
	if (BLOB_SOURCES.has(id) && data?.features?.length) {
		setBlobData(source, id, data);
	} else {
		source.setData(data);
	}
}

export function setPrefixVisible(map, prefix, visible) {
	const vis = visible ? "visible" : "none";
	const layers = [
		`${prefix}-points`,
		`${prefix}-clusters`,
		`${prefix}-cluster-count`,
		`${prefix}-halo`,
		`${prefix}-arrow`,
		`${prefix}-glyph`,
	];
	layers.forEach((layerId) => {
		if (
			map.getLayer(layerId) &&
			map.getLayoutProperty(layerId, "visibility") !== vis
		) {
			map.setLayoutProperty(layerId, "visibility", vis);
		}
	});
}
