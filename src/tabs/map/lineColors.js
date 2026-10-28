// Barve LPP linij (colors.json) in ikone z oznako linije.
import lineColors from "./colors.json";

export const LINE_ICON_PREFIX = "lpp-line:";

const normalize = (line) => String(line ?? "").trim().toUpperCase();

/** Barva LPP linije ali null, če je ni v colors.json. */
export function getLppLineColor(lineNumber) {
	const key = normalize(lineNumber);
	return key && Object.hasOwn(lineColors, key) ? lineColors[key] : null;
}

export const lineIconId = (lineNumber) =>
	LINE_ICON_PREFIX + normalize(lineNumber);

// Krog je enak polmeru "halo" kroga (ICON_SIZE_BY_LAYER * 72 px ≈ HALO_RADIUS),
// da se puščica smeri prilega.
const SIZE = 160;
const RADIUS = 72;

function isLight(hex) {
	const n = parseInt(hex.slice(1), 16);
	const lin = (v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	const l =
		0.2126 * lin((n >> 16) & 255) +
		0.7152 * lin((n >> 8) & 255) +
		0.0722 * lin(n & 255);
	return l > 0.4;
}

/** Nariše ikono: barvni krog z belo obrobo in številko linije. */
function drawLineIcon(lineNumber, color) {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = SIZE;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	const c = SIZE / 2;

	ctx.beginPath();
	ctx.arc(c, c, RADIUS, 0, Math.PI * 2);
	ctx.fillStyle = "#ffffff";
	ctx.fill();
	ctx.beginPath();
	ctx.arc(c, c, RADIUS - 7, 0, Math.PI * 2);
	ctx.fillStyle = color;
	ctx.fill();

	const text = normalize(lineNumber);
	const fontSize = text.length <= 1 ? 80 : text.length === 2 ? 70 : text.length === 3 ? 54 : 44;
	ctx.font = `700 ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = isLight(color) ? "#1b1b1b" : "#ffffff";
	ctx.fillText(text, c, c + fontSize * 0.04);
	return ctx.getImageData(0, 0, SIZE, SIZE);
}

/** Ob manjkajoči sliki "lpp-line:<št>" jo ustvari (po menjavi sloga se ponovi). */
export function registerLineIconGenerator(map) {
	map.on("styleimagemissing", (event) => {
		const id = event.id;
		if (!id?.startsWith(LINE_ICON_PREFIX) || map.hasImage(id)) return;
		const line = id.slice(LINE_ICON_PREFIX.length);
		const color = getLppLineColor(line);
		if (!color) return;
		map.addImage(id, drawLineIcon(line, color), { pixelRatio: 1 });
	});
}
