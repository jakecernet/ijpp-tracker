const SettingsTab = ({
    visibility,
    setVisibility,
    busOperators,
    setBusOperators,
    setTheme,
}) => {
    const isDark =
        typeof window !== "undefined"
            ? (localStorage.getItem("theme") || "light") === "dark"
            : false;

    return (
        <div className="settings">
            <h2>Nastavitve</h2>
            <h3 style={{ textAlign: "center", padding: "5px" }}>Zemljevid</h3>
            <div className="map-setttings">
                <div>
                    <h3>Aktivni markerji</h3>
                    <label>
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
                    <label>
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
                    <label>
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
                    <label>
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
                <div>
                    <h3>Prevozniki</h3>
                    {Object.entries({
                        lpp: "LPP",
                        arriva: "Arriva",
                        nomago: "Nomago",
                        marprom: "Marprom",
                        murska: "Murska Sobota",
                        generic: "Ostali",
                    }).map(([key, label]) => (
                        <label key={key}>
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
            <h3
                style={{
                    textAlign: "center",
                    padding: "5px",
                    borderTop: "1px solid var(--selector-border)",
                }}
            >
                Temni način
            </h3>
            <div className="theme-switcher">
                <p>Temno</p>
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
                >
                    <span aria-hidden />
                </button>
                <p>Svetlo</p>
            </div>
            <h3
                style={{
                    textAlign: "center",
                    padding: "5px",
                    borderTop: "1px solid var(--selector-border)",
                }}
            >
                Radij postaj
            </h3>
            <div className="ranges">
                
            </div>
        </div>
    );
};

export default SettingsTab;
