import maplibregl from "maplibre-gl";
import {
	renderLppPopup,
	renderIjppPopup,
	renderTrainPopup,
	createBusStopPopup,
	createTrainStopPopup,
} from "./popups";

const currentPopupRef = { popup: null };

// Opens a popup with fly-to and restores zoom on close.
// Returns the popup instance.
function openPopup(map, lngLat, content) {
	const previousZoom = map.getZoom();

	if (currentPopupRef.popup) {
		currentPopupRef.popup.remove();
		currentPopupRef.popup = null;
	}

	const popup = new maplibregl.Popup({ closeButton: false }).setLngLat(
		lngLat,
	);

	if (content instanceof Node) {
		popup.setDOMContent(content);
	} else {
		popup.setHTML(String(content ?? ""));
	}

	popup.addTo(map);
	currentPopupRef.popup = popup;

	popup.on("close", () => {
		if (currentPopupRef.popup === popup) currentPopupRef.popup = null;
		map.flyTo({
			center: map.getCenter(),
			zoom: previousZoom,
			duration: 1000,
		});
	});

	return popup;
}

export function configureBusStopPopup({ map, onSelectStop }) {
	map.on("click", "busStops-points", (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const [lng, lat] = feature.geometry.coordinates;
		const popup = openPopup(
			map,
			[lng, lat],
			createBusStopPopup(
				feature.properties || {},
				[lat, lng],
				onSelectStop,
			),
		);
		map.flyTo({
			center: [lng, lat],
			zoom: Math.max(map.getZoom(), 16),
			duration: 1000,
		});
		void popup;
	});
}

export function configureTrainStopPopup({ map, onSelectStop }) {
	map.on("click", "trainStops-points", (event) => {
		try {
			const routeFeatures = map.queryRenderedFeatures(event.point, {
				layers: ["sz-trip-stops-points"],
			});
			if (routeFeatures?.length > 0) return;
		} catch {}

		const feature = event.features?.[0];
		if (!feature) return;
		const [lng, lat] = feature.geometry.coordinates;
		openPopup(
			map,
			[lng, lat],
			createTrainStopPopup(
				feature.properties || {},
				[lat, lng],
				onSelectStop,
			),
		);
		map.flyTo({
			center: [lng, lat],
			zoom: Math.max(map.getZoom(), 16),
			duration: 1000,
		});
	});
}

export function configureTrainPopup({ map, onSelectVehicle }) {
	map.on("click", "trainPositions-points", (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const properties = feature.properties || {};

		const popup = openPopup(
			map,
			event.lngLat,
			renderTrainPopup(properties),
		);
		map.flyTo({
			center: event.lngLat,
			zoom: Math.max(map.getZoom(), 16),
			duration: 1000,
		});

		const button = popup
			.getElement()
			?.querySelector('[data-role="view-sz-route"]');
		if (!button) return;

		button.addEventListener(
			"click",
			(e) => {
				e.preventDefault();
				e.stopPropagation();

				let from = properties.from;
				let to = properties.to;
				try {
					from = typeof from === "string" ? JSON.parse(from) : from;
				} catch {
					from = null;
				}
				try {
					to = typeof to === "string" ? JSON.parse(to) : to;
				} catch {
					to = null;
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
			{ once: true },
		);
	});

	map.on("mouseenter", "trainPositions-points", () => {
		map.getCanvas().style.cursor = "pointer";
	});
	map.on("mouseleave", "trainPositions-points", () => {
		map.getCanvas().style.cursor = "";
	});
}

export function configureBusPopup({ map, onSelectVehicle }) {
	map.on("click", "buses-points", async (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const properties = feature.properties || {};

		let content;
		if (properties.sourceType === "lpp")
			content = await renderLppPopup(properties);
		else if (properties.sourceType === "ijpp")
			content = renderIjppPopup(properties);
		else content = `<div style="min-width:180px">Ni podatkov</div>`;

		const popup = openPopup(map, event.lngLat, content);
		map.flyTo({
			center: event.lngLat,
			zoom: Math.max(map.getZoom(), 16),
			duration: 1000,
		});

		const container = popup.getElement();
		if (!container) return;

		if (properties.sourceType === "ijpp") {
			container
				.querySelector('[data-role="view-route"]')
				?.addEventListener(
					"click",
					(e) => {
						e.preventDefault();
						e.stopPropagation();
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
					{ once: true },
				);
		}

		if (properties.sourceType === "lpp") {
			container
				.querySelector('[data-role="view-lpp-route"]')
				?.addEventListener(
					"click",
					(e) => {
						e.preventDefault();
						e.stopPropagation();
						onSelectVehicle({
							lineId: properties.lineId ?? null,
							tripId: properties.tripId ?? null,
							lineNumber: properties.lineNumber ?? null,
							lineName: properties.lineName ?? null,
						});
						popup.remove();
					},
					{ once: true },
				);
		}
	});
}

export function configureTripStopsPopup(map, layerId) {
	map.on("click", layerId, (event) => {
		const feature = event.features?.[0];
		if (!feature) return;
		const [lng, lat] = feature.geometry.coordinates;
		const name = feature.properties?.name || "Postaja";
		openPopup(
			map,
			[lng, lat],
			`<div style="font-weight:600;font-size:15px;margin-bottom:8px">${name}</div>`,
		);
		map.flyTo({
			center: [lng, lat],
			zoom: Math.max(map.getZoom(), 16),
			duration: 1000,
		});
	});
}
