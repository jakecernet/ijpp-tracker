import * as maplibregl from "maplibre-gl";
import {
	renderBusStopPopup,
	renderIjppPopup,
	renderLppPopup,
	renderTrainPopup,
	renderTrainStopPopup,
	renderTripStopPopup,
} from "./popups";

const TRIP_STOP_LAYERS = ["ijpp", "lpp", "sz"].map(
	(prefix) => `${prefix}-trip-stops-points`,
);
const POPUP_ZOOM = 16;

const parseJSON = (value) => {
	if (typeof value !== "string") return value ?? null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const setPointerCursor = (map, layerId) => {
	map.on("mouseenter", layerId, () => {
		map.getCanvas().style.cursor = "pointer";
	});
	map.on("mouseleave", layerId, () => {
		map.getCanvas().style.cursor = "";
	});
};

/**
 * Registrira klike na sloje zemljevida. Poklicati ga je treba ENKRAT na
 * instanco zemljevida (poslušalci preživijo `setStyle`, zato bi jih ob vsaki
 * menjavi teme podvojili in odprli več popupov hkrati).
 *
 * @param map
 * @param getHandlers - vrne trenutne { onSelectStation, onSelectVehicle } (da
 *   poslušalcev ni treba ponovno registrirati, ko se props komponente spremenijo)
 */
export function registerMapInteractions(map, getHandlers) {
	let current = null; // { popup, restoreZoom: boolean }

	/** Odpre popup (zapre prejšnjega) in ob zaprtju povrne zoom. */
	function openPopup(lngLat, html, onAction) {
		current?.popup.remove();

		const previousZoom = map.getZoom();
		const popup = new maplibregl.Popup({ closeButton: false })
			.setLngLat(lngLat)
			.setHTML(html)
			.addTo(map);
		const state = { popup, restoreZoom: true };
		current = state;

		const element = popup.getElement();
		// Delegiranje klikov: deluje tudi po tem, ko asinhrono zamenjamo vsebino.
		element.addEventListener("click", (event) => {
			const target = event.target.closest?.("[data-role]");
			if (!target || !element.contains(target)) return;
			event.preventDefault();
			event.stopPropagation();
			state.restoreZoom = false; // izbira prevzame kamero (fitBounds / zavihek)
			onAction?.(target.dataset.role);
			popup.remove();
		});
		// `error` ne brbota, zato ga ujamemo v fazi zajema: pokvarjena fotografija
		// ne pusti praznega okvirja.
		element.addEventListener(
			"error",
			(event) => {
				if (event.target.tagName === "IMG") {
					event.target.closest(".popup-image-wrapper")?.remove();
				}
			},
			true,
		);

		popup.on("close", () => {
			if (current === state) current = null;
			if (state.restoreZoom) {
				map.flyTo({
					center: map.getCenter(),
					zoom: previousZoom,
					duration: 1000,
				});
			}
		});

		return {
			popup,
			/** Zamenja vsebino, razen če je bil medtem odprt drug popup. */
			update(nextHtml) {
				if (current === state) popup.setHTML(nextHtml);
			},
		};
	}

	const flyToPoint = (center) =>
		map.flyTo({
			center,
			zoom: Math.max(map.getZoom(), POPUP_ZOOM),
			duration: 1000,
		});

	// --- Postaje -----------------------------------------------------------

	map.on("click", "busStops-points", (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const [lng, lat] = feature.geometry.coordinates;
		const props = feature.properties || {};

		openPopup([lng, lat], renderBusStopPopup(props), () =>
			getHandlers().onSelectStation({
				name: props.name,
				coordinates: [lat, lng],
				gpsLocation: [lat, lng],
				ref_id: props.ref_id ?? null,
				gtfs_id: props.gtfs_id ?? null,
				ijpp_id: props.ijpp_id ?? null,
				vCenter: props.vCenter === true || props.vCenter === "true",
				type: "bus-stop",
			}),
		);
		flyToPoint([lng, lat]);
	});

	map.on("click", "trainStops-points", (event) => {
		// Postaje na izbrani poti imajo svoj (enostavnejši) popup.
		if (
			map.queryRenderedFeatures(event.point, {
				layers: ["sz-trip-stops-points"],
			}).length > 0
		) {
			return;
		}
		const feature = event.features?.[0];
		if (!feature) return;
		const [lng, lat] = feature.geometry.coordinates;
		const props = feature.properties || {};

		openPopup([lng, lat], renderTrainStopPopup(props), () =>
			getHandlers().onSelectStation({
				name: props.name,
				coordinates: [lat, lng],
				gpsLocation: [lat, lng],
				stopId: props.stopId ?? null,
				lat,
				lon: lng,
				type: "train-stop",
			}),
		);
		flyToPoint([lng, lat]);
	});

	map.on("click", "trainPositions-points", (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const props = feature.properties || {};

		openPopup(event.lngLat, renderTrainPopup(props), () =>
			getHandlers().onSelectVehicle({
				tripId: props.tripId || null,
				tripShort: props.tripShort || null,
				departure: props.departure || null,
				arrival: props.arrival || null,
				realTime: props.realTime === true || props.realTime === "true",
				from: parseJSON(props.from),
				to: parseJSON(props.to),
			}),
		);
		flyToPoint(event.lngLat);
	});
	setPointerCursor(map, "trainPositions-points");

	map.on("click", "buses-points", (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const props = feature.properties || {};
		const { onSelectVehicle } = getHandlers();

		let opened;
		if (props.sourceType === "lpp") {
			opened = openPopup(
				event.lngLat,
				renderLppPopup(props, (html) => opened?.update(html)),
				() =>
					onSelectVehicle({
						lineId: props.lineId ?? null,
						tripId: props.tripId ?? null,
						lineNumber: props.lineNumber ?? null,
						lineName: props.lineName ?? null,
					}),
			);
		} else {
			opened = openPopup(
				event.lngLat,
				renderIjppPopup(props, (html) => opened?.update(html)),
				() =>
					onSelectVehicle({
						lineName: props.lineName || null,
						operator: props.operator || null,
						tripId: props.tripId || null,
						vehicleId: props.vehicleId || null,
						stop: props.stop || null,
						stopStatus: props.stopStatus || null,
					}),
			);
		}
		flyToPoint(event.lngLat);
	});

	TRIP_STOP_LAYERS.forEach((layerId) => {
		map.on("click", layerId, (event) => {
			const feature = event.features?.[0];
			if (!feature) return;
			const [lng, lat] = feature.geometry.coordinates;
			openPopup(
				[lng, lat],
				renderTripStopPopup(feature.properties?.name),
			);
			flyToPoint([lng, lat]);
		});
	});
}
