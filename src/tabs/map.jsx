import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap,
    useMapEvents,
    FeatureGroup,
} from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import arrivaPNG from "../img/arriva.png";
import lppPNG from "../img/lpp.png";
import nomagoPNG from "../img/nomago.png";
import marpromPNG from "../img/marprom.png";
import murskaPNG from "../img/murska.png";
import userPNG from "../img/user.png";
import busStopPNG from "../img/busStop.png";
import locationPNG from "../img/location.png";
import trainPNG from "../img/trainStop.png";

const MapCenter = React.memo(({ center }) => {
    const map = useMap();

    useEffect(() => {
        map.setView(center);
    }, [center, map]);

    return null;
});

const stopIcon = new L.Icon({
    iconUrl: busStopPNG,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

const userIcon = new L.Icon({
    iconUrl: userPNG,
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
});

const createOperatorIcon = (iconUrl) =>
    new L.Icon({
        iconUrl,
        iconSize: [35, 35],
        iconAnchor: [17.5, 35],
    });

const stationLocationIcon = new L.Icon({
    iconUrl: locationPNG,
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
});

const trainIcon = new L.Icon({
    iconUrl: trainPNG,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
});

const operatorIcons = {
    "Javno podjetje Ljubljanski potniški promet d.o.o.":
        createOperatorIcon(lppPNG),
    "Nomago d.o.o.": createOperatorIcon(nomagoPNG),
    "Arriva d.o.o.": createOperatorIcon(arrivaPNG),
    "Javno podjetje za mestni potniški promet Marprom, d.o.o.":
        createOperatorIcon(marpromPNG),
    "Avtobusni promet Murska Sobota d.d.": createOperatorIcon(murskaPNG),
};

function getBusIcon(operator) {
    return operatorIcons[operator] || createOperatorIcon(locationPNG);
}

const MemoizedMarker = React.memo(({ position, icon, title, children }) => (
    <Marker position={position} icon={icon} title={title}>
        {children}
    </Marker>
));

const Map = React.memo(
    ({
        gpsPositions,
        busStops,
        trainStops,
        activeStation,
        setActiveStation,
        userLocation,
        setCurentUrl,
    }) => {
        const [map, setMap] = useState(null);
        const position = useMemo(
            () => activeStation.coordinates || userLocation,
            [activeStation, userLocation]
        );

        const [mapCenter, setMapCenter] = useState(position);

        // Track viewport (bounds + zoom) to filter & limit markers rendered
        const [viewport, setViewport] = useState({ bounds: null, zoom: 13 });

        const handleViewportChange = useCallback((bounds, zoom) => {
            setViewport({ bounds, zoom });
        }, []);

        const ViewportWatcher = useCallback(() => {
            useMapEvents({
                moveend: (e) => {
                    const m = e.target;
                    handleViewportChange(m.getBounds(), m.getZoom());
                },
                zoomend: (e) => {
                    const m = e.target;
                    handleViewportChange(m.getBounds(), m.getZoom());
                },
            });
            const m = useMap();
            useEffect(() => {
                handleViewportChange(m.getBounds(), m.getZoom());
            }, [m]);
            return null;
        }, [handleViewportChange]);

        useEffect(() => {
            setMapCenter(position);
        }, [position]);

        const handleStationClick = useCallback(
            (busStop) => {
                setActiveStation({
                    name: busStop.name,
                    coordinates: busStop.gpsLocation,
                    id: busStop.id,
                });
                setMapCenter(busStop.gpsLocation);
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
            },
            [setActiveStation, setCurentUrl]
        );

        const memoizedGpsPositions = useMemo(
            () =>
                gpsPositions.map((gpsPosition, index) => (
                    <MemoizedMarker
                        key={`gps-${index}`}
                        position={gpsPosition.gpsLocation}
                        icon={getBusIcon(gpsPosition.operator)}
                        title={gpsPosition.route}
                    >
                        <Popup>
                            <p>{gpsPosition.route}</p>
                            <p>{gpsPosition.lineName}</p>
                            <p>{gpsPosition.operator}</p>
                        </Popup>
                    </MemoizedMarker>
                )),
            [gpsPositions, getBusIcon]
        );

        // ----- Bus stops (large dataset) performance pipeline -----
        const rawBusStops = useMemo(() => busStops || [], [busStops]);

        const MIN_ZOOM_FOR_BUS_STOPS = 10; // choose a sensible default to reduce clutter when zoomed out
        const filteredBusStops = useMemo(() => {
            if (!viewport.bounds) return [];
            if (viewport.zoom < MIN_ZOOM_FOR_BUS_STOPS) return [];
            const { _southWest, _northEast } = viewport.bounds;
            return rawBusStops.filter((busStop) => {
                const [lat, lng] = busStop.gpsLocation;
                return (
                    lat >= _southWest.lat &&
                    lat <= _northEast.lat &&
                    lng >= _southWest.lng &&
                    lng <= _northEast.lng
                );
            });
        }, [rawBusStops, viewport]);

        // Progressive rendering for bus stops (10.5k total) to avoid blocking
        const [renderedBusStopCount, setRenderedBusStopCount] = useState(0);
        useEffect(() => {
            let cancelled = false;
            if (filteredBusStops.length === 0) {
                setRenderedBusStopCount(0);
                return;
            }
            setRenderedBusStopCount(0);
            const total = filteredBusStops.length;
            // chunk size tuned for large dataset; can adjust further
            const chunkSize = total > 5000 ? 600 : total > 2500 ? 450 : 300;
            let current = 0;
            function step() {
                if (cancelled) return;
                current += chunkSize;
                setRenderedBusStopCount(Math.min(current, total));
                if (current < total) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            return () => {
                cancelled = true;
            };
        }, [filteredBusStops]);

        const progressiveBusStops = useMemo(
            () => filteredBusStops.slice(0, renderedBusStopCount),
            [filteredBusStops, renderedBusStopCount]
        );

        const memoizedBusStops = useMemo(
            () =>
                progressiveBusStops.map((busStop, index) => (
                    <MemoizedMarker
                        key={`stop-${busStop.id || index}`}
                        position={busStop.gpsLocation}
                        icon={stopIcon}
                        title={busStop.name}
                    >
                        <Popup>
                            <h3>{busStop.name}</h3>
                            <button onClick={() => handleStationClick(busStop)}>
                                Tukaj sem
                            </button>
                        </Popup>
                    </MemoizedMarker>
                )),
            [progressiveBusStops, handleStationClick]
        );

        // ----- Train stops performance pipeline -----
        // 1. Raw list
        const rawTrainStops = useMemo(() => trainStops || [], [trainStops]);

        // 2. Filter by viewport (only show within current map bounds & after min zoom)
        const MIN_ZOOM_FOR_TRAIN_STOPS = 8; // adjust as needed
        const filteredTrainStops = useMemo(() => {
            if (!viewport.bounds) return [];
            if (viewport.zoom < MIN_ZOOM_FOR_TRAIN_STOPS) return [];
            const { _southWest, _northEast } = viewport.bounds;
            return rawTrainStops.filter((stop) => {
                const lat = stop.lat;
                const lng = stop.lng;
                return (
                    lat >= _southWest.lat &&
                    lat <= _northEast.lat &&
                    lng >= _southWest.lng &&
                    lng <= _northEast.lng
                );
            });
        }, [rawTrainStops, viewport]);

        // 3. Progressive (chunked) rendering to avoid blocking the main thread
        const [renderedTrainStopCount, setRenderedTrainStopCount] = useState(0);
        useEffect(() => {
            let cancelled = false;
            if (filteredTrainStops.length === 0) {
                setRenderedTrainStopCount(0);
                return;
            }
            // Reset count then increment in animation frames
            setRenderedTrainStopCount(0);
            const total = filteredTrainStops.length;
            const chunkSize = total > 2000 ? 400 : total > 1000 ? 300 : 200; // adaptive
            let current = 0;
            function step() {
                if (cancelled) return;
                current += chunkSize;
                setRenderedTrainStopCount(Math.min(current, total));
                if (current < total) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            return () => {
                cancelled = true;
            };
        }, [filteredTrainStops]);

        // 4. Slice to the number progressively rendered
        const progressiveTrainStops = useMemo(
            () => filteredTrainStops.slice(0, renderedTrainStopCount),
            [filteredTrainStops, renderedTrainStopCount]
        );

        // 5. Convert to markers (memoized)
        const memoizedTrainStops = useMemo(
            () =>
                progressiveTrainStops.map((stop, index) => (
                    <MemoizedMarker
                        key={`train-${stop.stopId || index}`}
                        position={[stop.lat, stop.lng]}
                        icon={trainIcon}
                        title={stop.name}
                    >
                        <Popup>
                            <h3>{stop.naziv}</h3>
                            <p>ID: {stop.id}</p>
                        </Popup>
                    </MemoizedMarker>
                )),
            [progressiveTrainStops]
        );

        return (
            <div className="insideDiv">
                <div className="map-container">
                    <MapContainer
                        center={mapCenter}
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                        attributionControl={false}
                        scrollWheelZoom={true}
                        whenCreated={setMap}
                    >
                        <ViewportWatcher />
                        <MapCenter center={mapCenter} />
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FeatureGroup>
                            <MarkerClusterGroup
                                showCoverageOnHover={false}
                                spiderfyOnMaxZoom={false}
                                disableClusteringAtZoom={25}
                                maxClusterRadius={40}
                                chunkedLoading
                                removeOutsideVisibleBounds
                            >
                                {memoizedGpsPositions}
                            </MarkerClusterGroup>
                        </FeatureGroup>
                        <FeatureGroup>
                            <MarkerClusterGroup
                                showCoverageOnHover={false}
                                spiderfyOnMaxZoom={false}
                                disableClusteringAtZoom={16}
                                maxClusterRadius={30}
                                chunkedLoading
                                removeOutsideVisibleBounds
                            >
                                {memoizedBusStops}
                            </MarkerClusterGroup>
                        </FeatureGroup>
                        {memoizedTrainStops.length > 0 && (
                            <FeatureGroup>
                                <MarkerClusterGroup
                                    showCoverageOnHover={false}
                                    spiderfyOnMaxZoom={false}
                                    disableClusteringAtZoom={18}
                                    maxClusterRadius={35}
                                    chunkedLoading
                                    removeOutsideVisibleBounds
                                >
                                    {memoizedTrainStops}
                                </MarkerClusterGroup>
                            </FeatureGroup>
                        )}
                        {userLocation && (
                            <Marker
                                position={userLocation}
                                icon={userIcon}
                                title="Tukaj sem"
                            >
                                <Popup>
                                    <h4>Vaša lokacija</h4>
                                </Popup>
                            </Marker>
                        )}
                        {activeStation.coordinates && (
                            <Marker
                                position={activeStation.coordinates}
                                icon={stationLocationIcon}
                                title={"Aktivna postaja"}
                            >
                                <Popup>
                                    <h4>Aktivna postaja</h4>
                                </Popup>
                            </Marker>
                        )}
                    </MapContainer>
                    {/* Debug stats toggle (press D to toggle) */}
                    <DebugStats
                        rawTrain={rawTrainStops.length}
                        filteredTrain={filteredTrainStops.length}
                        renderedTrain={renderedTrainStopCount}
                        rawBus={rawBusStops.length}
                        filteredBus={filteredBusStops.length}
                        renderedBus={renderedBusStopCount}
                        zoom={viewport.zoom}
                    />
                </div>
            </div>
        );
    }
);

// Lightweight debug component (hidden by default; press 'd' to toggle)
const DebugStats = ({
    rawTrain,
    filteredTrain,
    renderedTrain,
    rawBus,
    filteredBus,
    renderedBus,
    zoom,
}) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const handler = (e) => {
            if (e.key.toLowerCase() === "d") setVisible((v) => !v);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);
    if (!visible) return null;
    return (
        <div
            style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                padding: "6px 10px",
                fontSize: 12,
                lineHeight: 1.4,
                borderRadius: 4,
                zIndex: 9999,
                pointerEvents: "none",
                fontFamily: "monospace",
            }}
        >
            <div>Zoom: {zoom}</div>
            <div>
                Train: {renderedTrain}/{filteredTrain}/{rawTrain}
            </div>
            <div>
                Bus: {renderedBus}/{filteredBus}/{rawBus}
            </div>
            <div>Press 'd' to hide</div>
        </div>
    );
};

export default Map;
