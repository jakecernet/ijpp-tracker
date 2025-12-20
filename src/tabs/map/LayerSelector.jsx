import { Layers } from "lucide-react";

export default function LayerSelector({
    showFilter,
    setShowFilter,
    visibility,
    setVisibility,
    busOperators,
    setBusOperators,
    setTheme,
}) {
    const isDark =
        typeof window !== "undefined"
            ? (localStorage.getItem("theme") || "light") === "dark"
            : false;
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
                <div
                    style={{
                        marginTop: "16px",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <h3>Temni način</h3>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isDark}
                        aria-label="Preklopi temni način"
                        onClick={() => {
                            const next = isDark ? "light" : "dark";
                            setTheme(next);
                            try {
                                localStorage.setItem("theme", next);
                            } catch {}
                            window.location.reload();
                        }}
                        style={{
                            width: 42,
                            height: 24,
                            borderRadius: 999,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: isDark ? "#111827" : "#d1d5db",
                            position: "relative",
                            cursor: "pointer",
                            padding: 0,
                            outline: "none",
                            marginTop: 0,
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                position: "absolute",
                                top: 2,
                                left: isDark ? 20 : 2,
                                width: 20,
                                height: 20,
                                background: "#ffffff",
                                borderRadius: 999,
                                boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
                                transition: "left 0.2s ease",
                            }}
                        />
                    </button>
                </div>
            </div>
            <button onClick={() => setShowFilter((v) => !v)}>
                <Layers />
            </button>
        </div>
    );
}
