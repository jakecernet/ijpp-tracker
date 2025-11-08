import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const STOP_NAME_KEYS = [
    "name",
    "stop_name",
    "common_name",
    "Name",
    "naziv",
    "stop",
    "StopName",
];
const STOP_ARRIVAL_KEYS = [
    "arrival",
    "arrival_time",
    "arrivalTime",
    "ArrivalTime",
    "arrival_planned",
    "Arrival",
];
const STOP_DEPARTURE_KEYS = [
    "departure",
    "departure_time",
    "departureTime",
    "DepartureTime",
    "departure_planned",
    "Departure",
];

const pickFirstNonEmpty = (container, keys) => {
    if (!container) return null;
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(container, key)) continue;
        const value = container[key];
        if (value === null || value === undefined) continue;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length === 0) continue;
            return trimmed;
        }
        return value;
    }
    return null;
};

const toText = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
    }
    return String(value);
};

const pickFirstText = (container, keys) => {
    const value = pickFirstNonEmpty(container, keys);
    return toText(value);
};

const loadStoredVehicle = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem("selectedBusRoute");
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("Neuspelo branje podatkov o liniji:", error);
        return null;
    }
};

const valueAsString = (value) => {
    if (value === null || value === undefined) return null;
    return String(value);
};

const deriveIdentifier = (vehicle) => {
    if (!vehicle) return null;
    const key = {
        tripId: valueAsString(vehicle.tripId),
        routeId: valueAsString(vehicle.routeId),
        journeyPatternId: valueAsString(vehicle.journeyPatternId),
        lineName: valueAsString(vehicle.lineName),
        vehicleRef: valueAsString(vehicle.vehicleRef),
    };
    const hasValue = Object.values(key).some((entry) => entry);
    return hasValue ? JSON.stringify(key) : null;
};

const findMatchingVehicle = (collection, vehicle) => {
    if (!Array.isArray(collection) || !vehicle) return null;
    const targetTrip = valueAsString(vehicle.tripId);
    const targetRoute = valueAsString(vehicle.routeId);
    const targetJourney = valueAsString(vehicle.journeyPatternId);
    const targetLine = valueAsString(vehicle.lineName);
    const targetVehicleRef = valueAsString(vehicle.vehicleRef);

    return (
        collection.find((entry) => {
            const entryTrip = valueAsString(
                entry?.LineData?.trip?.trip_id ?? entry?.LineData?.tripId
            );
            const entryRoute = valueAsString(
                entry?.LineData?.trip?.route_id ??
                    entry?.LineData?.trip?.routeId ??
                    entry?.LineData?.routeId
            );
            const entryJourney = valueAsString(
                entry?.JourneyPatternRef ?? entry?.JourneyPatternName
            );
            const entryLine = valueAsString(
                entry?.PublishedLineName ?? entry?.LineRef
            );
            const entryVehicleRef = valueAsString(entry?.VehicleRef);

            if (targetTrip && entryTrip && targetTrip === entryTrip)
                return true;
            if (
                !targetTrip &&
                targetRoute &&
                entryRoute &&
                targetRoute === entryRoute
            )
                return true;
            if (
                !targetTrip &&
                !targetRoute &&
                targetJourney &&
                entryJourney &&
                targetJourney === entryJourney
            )
                return true;
            if (
                targetVehicleRef &&
                entryVehicleRef &&
                targetVehicleRef === entryVehicleRef
            )
                return true;
            if (
                !targetTrip &&
                !targetRoute &&
                !targetJourney &&
                targetLine &&
                entryLine &&
                targetLine === entryLine
            )
                return true;
            return false;
        }) ?? null
    );
};

const normalizeVehicleData = (source, fallback = {}) => {
    const stops = Array.isArray(source?.LineData?.stops)
        ? source.LineData.stops
        : Array.isArray(source?.stops)
        ? source.stops
        : Array.isArray(fallback?.stops)
        ? fallback.stops
        : [];

    return {
        lineName:
            pickFirstText(source, [
                "PublishedLineName",
                "LineRef",
                "lineName",
            ]) ??
            fallback.lineName ??
            null,
        operator:
            pickFirstText(source?.OperatorData, ["agency_name"]) ??
            pickFirstText(source, ["OperatorRef", "operator"]) ??
            fallback.operator ??
            null,
        tripId:
            pickFirstText(source?.LineData?.trip, ["trip_id", "tripId"]) ??
            pickFirstText(source?.LineData, ["tripId"]) ??
            pickFirstText(source, ["tripId"]) ??
            fallback.tripId ??
            null,
        routeId:
            pickFirstText(source?.LineData?.trip, ["route_id", "routeId"]) ??
            pickFirstText(source?.LineData, ["routeId"]) ??
            pickFirstText(source, ["routeId"]) ??
            fallback.routeId ??
            null,
        journeyPatternId:
            pickFirstText(source, [
                "JourneyPatternRef",
                "JourneyPatternName",
                "journeyPatternId",
            ]) ??
            fallback.journeyPatternId ??
            null,
        vehicleRef:
            pickFirstText(source, ["VehicleRef", "vehicleRef"]) ??
            fallback.vehicleRef ??
            null,
        destination:
            pickFirstText(source, [
                "DestinationName",
                "DestinationRef",
                "lineDestination",
                "destination",
            ]) ??
            fallback.destination ??
            null,
        origin:
            pickFirstText(source, ["OriginName", "origin"]) ??
            fallback.origin ??
            null,
        stops,
        lastKnown: Date.now(),
    };
};

const formatTime = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return `${value}`;
        return date.toLocaleTimeString("sl-SI", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    const text = String(value).trim();
    if (!text) return null;
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) return text.slice(0, 5);
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString("sl-SI", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    return text;
};

const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleTimeString("sl-SI", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const createStopKey = (stop, index) => {
    const id = pickFirstText(stop, ["id", "stop_id", "stopId", "StopId"]);
    return id ? `${id}-${index}` : `stop-${index}`;
};

function BusRouteTab({
    selectedVehicle,
    setSelectedVehicle,
    positionsUrl,
    setCurentUrl,
}) {
    const navigate = useNavigate();
    const initialVehicle =
        selectedVehicle !== undefined ? selectedVehicle : loadStoredVehicle();
    const [vehicle, setVehicle] = useState(initialVehicle);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        if (typeof setCurentUrl === "function") {
            setCurentUrl("/route");
        }
    }, [setCurentUrl]);

    useEffect(() => {
        if (selectedVehicle !== undefined) {
            setVehicle(selectedVehicle);
        }
    }, [selectedVehicle]);

    useEffect(() => {
        if (typeof setSelectedVehicle === "function") {
            setSelectedVehicle(vehicle ?? null);
        }
        if (typeof window === "undefined") return;
        try {
            if (vehicle) {
                window.localStorage.setItem(
                    "selectedBusRoute",
                    JSON.stringify(vehicle)
                );
            } else {
                window.localStorage.removeItem("selectedBusRoute");
            }
        } catch (storageError) {
            console.warn("Shranjevanje podatkov ni uspelo:", storageError);
        }
    }, [vehicle, setSelectedVehicle]);

    const identifier = useMemo(() => deriveIdentifier(vehicle), [vehicle]);

    useEffect(() => {
        if (!positionsUrl || !identifier) return;
        let ignore = false;

        const fetchLatest = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(positionsUrl);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                if (ignore) return;
                if (!Array.isArray(data)) {
                    throw new Error("Nepričakovan format podatkov.");
                }
                const match = findMatchingVehicle(data, vehicle);
                if (!match) {
                    setError("Trenutno ne najdem informacij o tem vozilu.");
                    return;
                }
                const normalized = normalizeVehicleData(match, vehicle || {});
                if (!ignore) {
                    setVehicle(normalized);
                }
            } catch (fetchError) {
                if (!ignore) {
                    setError(
                        fetchError.message ||
                            "Napaka pri pridobivanju podatkov."
                    );
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        fetchLatest();

        return () => {
            ignore = true;
        };
    }, [identifier, positionsUrl, reloadToken]);

    const stops = Array.isArray(vehicle?.stops) ? vehicle.stops : [];
    const lastUpdatedLabel = vehicle?.lastKnown
        ? formatTimestamp(vehicle.lastKnown)
        : null;

    const handleBack = () => {
        navigate(-1);
    };

    const handleGoToMap = () => {
        if (typeof setCurentUrl === "function") {
            setCurentUrl("/map");
        }
        navigate("/map");
    };

    const handleRefresh = () => {
        setReloadToken((token) => token + 1);
    };

    if (!vehicle) {
        return (
            <div className="route-view route-view--empty">
                <div className="route-header">
                    <button
                        type="button"
                        className="route-button route-button--ghost"
                        onClick={handleBack}
                    >
                        Nazaj
                    </button>
                    <div className="route-title">
                        <h2>Trasa avtobusa</h2>
                        <div className="route-meta">Ni izbranega vozila</div>
                    </div>
                </div>
                <section className="route-card route-empty">
                    <p>Izberite avtobus na zemljevidu za pregled trase.</p>
                </section>
            </div>
        );
    }

    const infoRows = [
        { label: "Linija", value: vehicle.lineName },
        { label: "Prevoznik", value: vehicle.operator },
        { label: "Smer", value: vehicle.destination },
        { label: "Izhodišče", value: vehicle.origin },
        { label: "Trip ID", value: vehicle.tripId },
        { label: "Ruta", value: vehicle.routeId },
        { label: "Vzorec", value: vehicle.journeyPatternId },
    ].filter((row) => row.value);

    return (
        <div className="route-view">
            <div className="route-header">
                <button
                    type="button"
                    className="route-button route-button--ghost"
                    onClick={handleBack}
                >
                    Nazaj
                </button>
                <div className="route-title">
                    <h2>{vehicle.lineName || "Linija"}</h2>
                    {vehicle.operator && (
                        <div className="route-subtitle">{vehicle.operator}</div>
                    )}
                    {lastUpdatedLabel && (
                        <div className="route-meta">
                            Posodobljeno ob {lastUpdatedLabel}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="route-button"
                    onClick={handleRefresh}
                >
                    Osveži
                </button>
            </div>

            {infoRows.length > 0 && (
                <section className="route-card route-info">
                    {infoRows.map((row) => (
                        <div className="route-info-row" key={row.label}>
                            <span className="route-info-label">
                                {row.label}
                            </span>
                            <span className="route-info-value">
                                {row.value}
                            </span>
                        </div>
                    ))}
                </section>
            )}

            {loading && <div className="route-note">Posodabljam podatke…</div>}
            {error && <div className="route-alert">{error}</div>}

            <div className="route-actions">
                <button
                    type="button"
                    className="route-button"
                    onClick={handleGoToMap}
                >
                    Odpri zemljevid
                </button>
            </div>

            {stops.length === 0 ? (
                <section className="route-card route-empty">
                    <p>Za to vozilo ni podatkov o postajah.</p>
                </section>
            ) : (
                <section className="route-card">
                    <h3 className="route-section-title">Postaje</h3>
                    <ol className="route-stoplist">
                        {stops.map((stop, index) => {
                            const name =
                                pickFirstText(stop, STOP_NAME_KEYS) ||
                                `Postaja ${index + 1}`;
                            const arrival = pickFirstText(
                                stop,
                                STOP_ARRIVAL_KEYS
                            );
                            const departure = pickFirstText(
                                stop,
                                STOP_DEPARTURE_KEYS
                            );
                            const arrivalText = formatTime(arrival);
                            const departureText = formatTime(departure);

                            return (
                                <li
                                    key={createStopKey(stop, index)}
                                    className="route-stop"
                                >
                                    <div className="route-stop-title">
                                        {name}
                                    </div>
                                    {(arrivalText || departureText) && (
                                        <div className="route-stop-meta">
                                            {arrivalText && (
                                                <span>
                                                    Prihod: {arrivalText}
                                                </span>
                                            )}
                                            {departureText && (
                                                <span>
                                                    Odhod: {departureText}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </section>
            )}
        </div>
    );
}

export default BusRouteTab;
