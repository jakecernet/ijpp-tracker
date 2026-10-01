import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import { useBottomSheet } from "../hooks/useBottomSheet";
import {
	DEFAULT_CENTER,
	DEFAULT_ZOOM,
	ICON_SOURCES,
	OSM_STYLE_DARK,
	OSM_STYLE_LIGHT,
} from "./map/config";
import {
	buildBusesGeoJSON,
	buildBusStopsGeoJSON,
	buildTripOverlay,
	buildTrainsGeoJSON,
	buildTrainStopsGeoJSON,
	isTrainRoute,
} from "./map/geojson";
import { registerMapInteractions } from "./map/interactions";
import {
	BRAND_COLOR_EXPR,
	clearTripOverlay,
	registerClusterInteractions,
	setPrefixVisible,
	setupSourcesAndLayers,
	setupTripOverlay,
	updateSourceData,
	updateTripOverlay,
} from "./map/layers";
import { ensureIcons } from "./map/utils";
import RouteTab from "./route.jsx";

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const PROVIDER_PREFIXES = ["ijpp", "lpp", "sz"];
const ROUTE_DRAWER_PEEK_HEIGHT = 140;
const EMPTY_COLLECTION = { type: "FeatureCollection", features: [] };

const FIT_OPTIONS = {
	padding: {
		top: 60,
		right: 60,
		bottom: ROUTE_DRAWER_PEEK_HEIGHT + 60,
		left: 60,
	},
	maxZoom: 15,
	duration: 800,
};

const getMapStyle = (theme) =>
	theme === "dark" ? OSM_STYLE_DARK : OSM_STYLE_LIGHT;

/** Ikone, viri in sloji - po vsaki (ponovni) naložitvi sloga. */
async function setupMapContent(map, data) {
	await ensureIcons(map, ICON_SOURCES);
	setupSourcesAndLayers(map, data);
	PROVIDER_PREFIXES.forEach((prefix) =>
		setupTripOverlay(map, prefix, BRAND_COLOR_EXPR),
	);
}

/** Stabilen ključ izbrane vožnje (za odpiranje spodnjega lista). */
function getVehicleKey(vehicle) {
	if (!vehicle) return null;
	if (vehicle.tripId != null) return String(vehicle.tripId);
	return JSON.stringify([
		vehicle.lineNumber ?? null,
		vehicle.lineId ?? null,
		vehicle.routeId ?? null,
		vehicle.vehicleId ?? null,
		vehicle.from?.stopId ?? vehicle.from?.name ?? null,
		vehicle.to?.stopId ?? vehicle.to?.name ?? null,
	]);
}

const MapTab = memo(function MapTab({
	gpsPositions,
	trains,
	busStops,
	trainStops = [],
	activeStation,
	onSelectStation,
	userLocation,
	setSelectedVehicle,
	selectedVehicle,
	routeLoading,
	visibility,
	busOperators,
	mapTheme,
	isActive = true,
}) {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const [isMapLoaded, setIsMapLoaded] = useState(false);
	const [mapError, setMapError] = useState(false);
	const initialCenterRef = useRef(
		userLocation || activeStation?.coordinates || DEFAULT_CENTER,
	);
	const appliedThemeRef = useRef(mapTheme);
	const pendingFitRef = useRef(null);
	const fittedKeyRef = useRef(null);

	// --- Stanje izbrane poti (vse izpeljano iz selectedVehicle) ---------------

	const routeMode = selectedVehicle != null;
	const routeIsTrain = useMemo(
		() => isTrainRoute(selectedVehicle),
		[selectedVehicle],
	);
	const selectedRoute = routeMode ? selectedVehicle : null;
	const selectedVehicleKey = useMemo(
		() => getVehicleKey(selectedVehicle),
		[selectedVehicle],
	);

	// Med prikazom poti so vidni samo vozila/vlaki te poti, ne pa postaje.
	const effectiveVisibility = useMemo(
		() =>
			routeMode
				? {
						buses: !routeIsTrain,
						busStops: false,
						trainPositions: routeIsTrain,
						trainStops: false,
					}
				: visibility,
		[routeMode, routeIsTrain, visibility],
	);

	// --- GeoJSON ---------------------------------------------------------------

	const busesGeoJSON = useMemo(
		() => buildBusesGeoJSON(gpsPositions, busOperators, selectedRoute),
		[gpsPositions, busOperators, selectedRoute],
	);
	const busStopsGeoJSON = useMemo(
		() => buildBusStopsGeoJSON(busStops),
		[busStops],
	);
	const trainStopsGeoJSON = useMemo(
		() => buildTrainStopsGeoJSON(trainStops),
		[trainStops],
	);

	// Ob (ponovni) postavitvi slojev potrebujemo trenutne podatke.
	const dataRef = useRef({});
	dataRef.current = {
		buses: busesGeoJSON,
		busStops: busStopsGeoJSON,
		trainPositions: EMPTY_COLLECTION, // animacija jih takoj nadomesti
		trainStops: trainStopsGeoJSON,
	};

	const handlersRef = useRef({});
	useEffect(() => {
		handlersRef.current = {
			onSelectStation,
			onSelectVehicle: setSelectedVehicle,
		};
	}, [onSelectStation, setSelectedVehicle]);

	// --- Spodnji list z potjo --------------------------------------------------

	const clearPathOverlays = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;
		PROVIDER_PREFIXES.forEach((prefix) => clearTripOverlay(map, prefix));
	}, []);

	const resetRouteView = useCallback(() => {
		clearPathOverlays();
		setSelectedVehicle(null);
	}, [clearPathOverlays, setSelectedVehicle]);

	const sheet = useBottomSheet({
		peekHeight: ROUTE_DRAWER_PEEK_HEIGHT,
		onDismiss: resetRouteView,
	});
	const { open: openSheet, close: closeSheet, isOpen: isSheetOpen } = sheet;

	const lastKeyRef = useRef(selectedVehicleKey);
	const [pendingOpen, setPendingOpen] = useState(false);

	// Nova vožnja -> list se odpre, ko so podatki naloženi.
	useEffect(() => {
		if (!selectedVehicleKey) {
			lastKeyRef.current = null;
			setPendingOpen(false);
			return;
		}
		if (lastKeyRef.current !== selectedVehicleKey) {
			lastKeyRef.current = selectedVehicleKey;
			setPendingOpen(true);
		}
	}, [selectedVehicleKey]);

	useEffect(() => {
		if (pendingOpen && !routeLoading) {
			setPendingOpen(false);
			openSheet();
		}
	}, [pendingOpen, routeLoading, openSheet]);

	// Izbira je bila od zunaj počiščena (npr. menjava zavihka) -> zapri list.
	useEffect(() => {
		if (!selectedVehicle && isSheetOpen) closeSheet();
	}, [selectedVehicle, isSheetOpen, closeSheet]);

	// --- Zemljevid: ustvarjanje ---------------------------------------------------

	useEffect(() => {
		let map;
		try {
			map = new maplibregl.Map({
				container: containerRef.current,
				style: getMapStyle(appliedThemeRef.current),
				center: [
					initialCenterRef.current[1],
					initialCenterRef.current[0],
				],
				zoom: DEFAULT_ZOOM,
				attributionControl: true,
				maxZoom: 22,
			});
		} catch (error) {
			console.error("Failed to initialize map:", error);
			setMapError(true);
			return;
		}

		mapRef.current = map;
		map.addControl(
			new maplibregl.NavigationControl({ showCompass: true }),
			"top-right",
		);
		map.addControl(
			new maplibregl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				trackUserLocation: true,
				showUserLocation: true,
				showAccuracyCircle: true,
				fitBoundsOptions: { maxZoom: 15 },
			}),
			"top-right",
		);
		map.addControl(
			new maplibregl.FullscreenControl({ container: document.body }),
			"top-right",
		);

		map.on("load", async () => {
			await setupMapContent(map, dataRef.current);
			if (mapRef.current !== map) return; // odstranjen med nalaganjem
			// Poslušalce registriramo ENKRAT - preživijo menjavo sloga.
			registerClusterInteractions(map);
			registerMapInteractions(map, () => handlersRef.current);
			setIsMapLoaded(true);
		});

		return () => {
			map.remove();
			mapRef.current = null;
			setIsMapLoaded(false);
		};
	}, []);

	// Menjava teme: nov slog, nato znova postavimo naše vire in sloje.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !isMapLoaded || appliedThemeRef.current === mapTheme)
			return;

		appliedThemeRef.current = mapTheme;
		setIsMapLoaded(false);
		map.once("style.load", async () => {
			await setupMapContent(map, dataRef.current);
			if (mapRef.current === map) setIsMapLoaded(true);
		});
		map.setStyle(getMapStyle(mapTheme));
	}, [mapTheme, isMapLoaded]);

	// Skrit zavihek ima velikost 0: ob vrnitvi popravimo velikost in izvedemo zamaknjen fitBounds.
	useEffect(() => {
		if (!isActive) return;
		const map = mapRef.current;
		if (!map) return;
		const frame = requestAnimationFrame(() => {
			map.resize();
			if (pendingFitRef.current) {
				map.fitBounds(pendingFitRef.current, FIT_OPTIONS);
				pendingFitRef.current = null;
			}
		});
		return () => cancelAnimationFrame(frame);
	}, [isActive, isMapLoaded]);

	// --- Zemljevid: podatki (vsak vir posebej, da posodobitev avtobusov
	// ne pošilja znova 11.000+ postaj v worker) ---------------------------------

	useEffect(() => {
		if (isMapLoaded)
			updateSourceData(mapRef.current, "buses", busesGeoJSON);
	}, [busesGeoJSON, isMapLoaded]);

	useEffect(() => {
		if (isMapLoaded)
			updateSourceData(mapRef.current, "busStops", busStopsGeoJSON);
	}, [busStopsGeoJSON, isMapLoaded]);

	useEffect(() => {
		if (isMapLoaded) {
			updateSourceData(mapRef.current, "trainStops", trainStopsGeoJSON);
		}
	}, [trainStopsGeoJSON, isMapLoaded]);

	// Vlaki: pozicijo interpoliramo vsako sekundo neposredno v viru zemljevida,
	// brez React stanja (prej je to ponovno izrisalo celotno aplikacijo).
	const onlyTripId = routeMode ? (selectedVehicle?.tripId ?? null) : null;
	const trainsVisible = effectiveVisibility.trainPositions;
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !isMapLoaded) return;

		const render = () =>
			updateSourceData(
				map,
				"trainPositions",
				buildTrainsGeoJSON(trains, Date.now(), onlyTripId),
			);
		render();

		if (!isActive || !trainsVisible || !trains?.length) return;
		const timer = setInterval(() => {
			if (!document.hidden) render();
		}, 1000);
		return () => clearInterval(timer);
	}, [trains, isMapLoaded, isActive, trainsVisible, onlyTripId]);

	useEffect(() => {
		const map = mapRef.current;
		if (!map || !isMapLoaded) return;
		[
			["buses", effectiveVisibility.buses],
			["busStops", effectiveVisibility.busStops],
			["trainStops", effectiveVisibility.trainStops],
			["trainPositions", effectiveVisibility.trainPositions],
		].forEach(([prefix, visible]) =>
			setPrefixVisible(map, prefix, visible),
		);
	}, [effectiveVisibility, isMapLoaded]);

	// Črta in postaje izbrane poti + prilagoditev pogleda.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !isMapLoaded) return;

		PROVIDER_PREFIXES.forEach((prefix) => clearTripOverlay(map, prefix));
		if (!selectedVehicle) {
			fittedKeyRef.current = null;
			pendingFitRef.current = null;
			return;
		}

		const overlay = buildTripOverlay(selectedVehicle);
		if (!overlay) return;
		updateTripOverlay(
			map,
			overlay.prefix,
			overlay.lineCoords,
			overlay.stopsFeatures,
			overlay.brand,
		);

		// Pogled prilagodimo le enkrat na vožnjo (ne ob menjavi teme ipd.).
		if (
			overlay.fitCoords.length === 0 ||
			fittedKeyRef.current === selectedVehicleKey
		) {
			return;
		}
		fittedKeyRef.current = selectedVehicleKey;
		const bounds = new maplibregl.LngLatBounds();
		overlay.fitCoords.forEach((coord) => bounds.extend(coord));
		if (bounds.isEmpty()) return;

		if (isActive) map.fitBounds(bounds, FIT_OPTIONS);
		else pendingFitRef.current = bounds; // skrit zemljevid nima velikosti
	}, [selectedVehicle, selectedVehicleKey, isMapLoaded, isActive]);

	const handleClose = (event) => {
		event.stopPropagation();
		closeSheet();
		resetRouteView();
	};

	return (
		<div>
			<div className="map-container">
				<div ref={containerRef} className="map-canvas" />
				{mapError && (
					<div className="map-error" role="alert">
						<p>Zemljevid se ne more naložiti</p>
						<p>Preverite grafični gonilnik ali osvežite stran.</p>
					</div>
				)}
				{routeLoading && (
					<div className="map-route-loading" role="status">
						<span className="map-route-loading_spinner" />
						Nalaganje poti...
					</div>
				)}
				<div
					className={
						isSheetOpen
							? "route-drawer route-drawer--open"
							: "route-drawer"
					}
					ref={sheet.ref}
					style={sheet.style}
					role="dialog"
					aria-label="Pot">
					<div
						className="route-drawer__header"
						{...sheet.dragHandlers}>
						<div
							className="route-drawer__grab"
							aria-hidden="true"
						/>
						<button
							type="button"
							className="route-drawer__close"
							aria-label="Zapri"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={handleClose}>
							×
						</button>
					</div>
					<div className="route-drawer__content">
						{selectedVehicle ? (
							<RouteTab
								selectedVehicle={selectedVehicle}
								gpsPositions={gpsPositions}
								onSelectStation={onSelectStation}
								dragHandlers={sheet.dragHandlers}
							/>
						) : (
							<p className="route-drawer__empty">
								Ni izbrane linije.
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
});

export default MapTab;
