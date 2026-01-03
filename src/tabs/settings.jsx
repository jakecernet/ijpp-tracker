import React, { useState } from "react";

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
    const [radius, setRadius] = useState(() => {
        const stored = localStorage.getItem("stationRadius");
        return stored ? JSON.parse(stored) : { busRadius: 5, szRadius: 20 };
    });

    return (
        <div className="settings">
            <h2>Nastavitve</h2>
            <div className="inside">
                <h3 style={{ textAlign: "center", padding: "5px" }}>
                    Zemljevid
                </h3>
                <div className="map-setttings">
                    <div style={{ margin: 0, padding: 0 }}>
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
                    <div style={{ margin: 0, padding: 0 }}>
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
                    <label>
                        Avtobusne postaje: {radius.busRadius} km
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={radius.busRadius}
                            onChange={(e) => {
                                const newRadius = {
                                    ...radius,
                                    busRadius: Number(e.target.value),
                                };
                                setRadius(newRadius);
                                localStorage.setItem(
                                    "stationRadius",
                                    JSON.stringify(newRadius)
                                );
                            }}
                        />
                    </label>
                    <label>
                        Železniške postaje: {radius.szRadius} km
                        <input
                            type="range"
                            min="5"
                            max="300"
                            value={radius.szRadius}
                            onChange={(e) => {
                                const newRadius = {
                                    ...radius,
                                    szRadius: Number(e.target.value),
                                };
                                setRadius(newRadius);
                                localStorage.setItem(
                                    "stationRadius",
                                    JSON.stringify(newRadius)
                                );
                            }}
                        />
                    </label>
                </div>
                <h3
                    style={{
                        textAlign: "center",
                        padding: "5px",
                        borderTop: "1px solid var(--selector-border)",
                    }}
                >
                    O aplikaciji
                </h3>
                <p className="about">
                    Avtor:{" "}
                    <a href="https://cernetic.cc" target="_blank">
                        Jaka Černetič
                    </a>
                    <br />
                    Viri podatkov:
                    <br />{" "}
                    <a href="https://data.lpp.si/doc" target="_blank">
                        LPP
                    </a>
                    ,{" "}
                    <a
                        href="https://mestnipromet.cyou/tracker/"
                        target="_blank"
                    >
                        Mestni promet
                    </a>
                    ,{" "}
                    <a href="https://beta.brezavta.si/" target="_blank">
                        Brezavta
                    </a>
                    ,{" "}
                    <a
                        href="https://mapper-motis.ojpp-gateway.derp.si/"
                        target="_blank"
                    >
                        SŽ Mapper
                    </a>
                    ,{" "}
                    <a
                        href="https://gitlab.com/derp-si/ojpp-docs"
                        target="_blank"
                    >
                        (DERP)
                    </a>
                    <br />
                    Izvirna koda:{" "}
                    <a
                        href="https://github.com/jakecernet/ijpp-tracker"
                        target="_blank"
                    >
                        GitHub
                    </a>
                </p>
            </div>
        </div>
    );
};

export default SettingsTab;
