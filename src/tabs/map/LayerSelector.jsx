import { Layers } from "lucide-react";

export default function LayerSelector({
    showFilter,
    setShowFilter,
    visibility,
    setVisibility,
    filterByRoute,
    setFilterByRoute,
    busOperators,
    setBusOperators,
}) {
    return (
        <div className="layer-selector">
            <div
                style={{
                    height: showFilter ? "auto" : 0,
                    width: showFilter ? "auto" : 0,
                    padding: showFilter ? "10px" : 0,
                }}
            >
                <div>
                    <h3>Aktivni markerji</h3>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={visibility.buses}
                            onChange={(e) =>
                                setVisibility((v) => ({
                                    ...v,
                                    buses: e.target.checked,
                                }))
                            }
                        />
                        Avtobusi
                    </label>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={visibility.busStops}
                            onChange={(e) =>
                                setVisibility((v) => ({
                                    ...v,
                                    busStops: e.target.checked,
                                }))
                            }
                        />
                        Avtobusne postaje
                    </label>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={visibility.trainPositions}
                            onChange={(e) =>
                                setVisibility((v) => ({
                                    ...v,
                                    trainPositions: e.target.checked,
                                }))
                            }
                        />
                        Vlaki
                    </label>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={visibility.trainStops}
                            onChange={(e) =>
                                setVisibility((v) => ({
                                    ...v,
                                    trainStops: e.target.checked,
                                }))
                            }
                        />
                        Železniške postaje
                    </label>
                </div>

                <div
                    style={{
                        marginTop: "16px",
                        paddingTop: "12px",
                        borderTop: "1px solid rgba(128,128,128,0.3)",
                    }}
                >
                    <h3>Filtriranje</h3>
                    <label
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={filterByRoute}
                            onChange={(e) => setFilterByRoute(e.target.checked)}
                        />
                        Samo izbrana linija
                    </label>
                </div>

                <div style={{ marginTop: "12px" }}>
                    <h3>Prevozniki</h3>
                    {Object.entries({
                        lpp: "LPP",
                        arriva: "Arriva",
                        nomago: "Nomago",
                        marprom: "Marprom",
                        murska: "Murska Sobota",
                        generic: "Ostali",
                    }).map(([key, label]) => (
                        <label
                            key={key}
                            style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={busOperators[key]}
                                onChange={(e) =>
                                    setBusOperators((prev) => ({
                                        ...prev,
                                        [key]: e.target.checked,
                                    }))
                                }
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>
            <button onClick={() => setShowFilter((v) => !v)}>
                <Layers />
            </button>
        </div>
    );
}
