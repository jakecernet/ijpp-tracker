import { memo, useId, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import { useSwipeTabs } from "../hooks/useSwipeTabs";
import {
	clearLppRoutes,
	clearStops,
	downloadLppRoutes,
	downloadStops,
	getLppRoutesInfo,
	getStopsInfo,
} from "../utils/offlineData";

const DEFAULT_RADIUS = { busRadius: 5, szRadius: 20 };

const MARKER_OPTIONS = [
	["buses", "Avtobusi"],
	["busStops", "Avtobusne postaje"],
	["trainPositions", "Vlaki"],
	["trainStops", "Železniške postaje"],
];

const OPERATOR_OPTIONS = [
	["lpp", "LPP"],
	["arriva", "Arriva"],
	["nomago", "Nomago"],
	["marprom", "Marprom"],
	["murska", "Murska Sobota"],
	["kranj", "MP Kranj"],
	["generic", "Ostali"],
];

const SOURCE_LINKS = [
	["https://data.lpp.si/doc", "LPP"],
	["https://mestnipromet.cyou/tracker/", "Mestni promet"],
	["https://beta.brezavta.si/", "Brezavta"],
	["https://mapper-motis.ojpp-gateway.derp.si/", "SŽ Mapper"],
	["https://gitlab.com/derp-si/ojpp-docs", "(DERP)"],
	["https://prikazovalnik.gt.tc/zemljevid.html", "Prikazovalnik"],
];

function ExternalLink({ href, children }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	);
}

function CheckboxGroup({ title, options, values, onChange }) {
	return (
		<div className="map-settings__group">
			<h3>{title}</h3>
			{options.map(([key, label]) => (
				<label key={key}>
					<input
						type="checkbox"
						checked={Boolean(values[key])}
						onChange={(event) =>
							onChange(key, event.target.checked)
						}
					/>
					{label}
				</label>
			))}
		</div>
	);
}

function ThemeSwitch({ title, label, isDark, onToggle }) {
	return (
		<div className="settings__row">
			<span>{title}</span>
			<button
				type="button"
				role="switch"
				aria-checked={isDark}
				aria-label={label}
				onClick={onToggle}>
				<span aria-hidden />
			</button>
		</div>
	);
}

function Section({ title, index, children }) {
	return (
		<section className="settings__section" style={{ "--i": index }}>
			<h2>{title}</h2>
			{children}
		</section>
	);
}

function RadiusSlider({ label, value, min, max, onChange }) {
	const id = useId();
	return (
		<label htmlFor={id}>
			{label}: {value} km
			<input
				id={id}
				type="range"
				min={min}
				max={max}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</label>
	);
}

function formatDate(timestamp) {
	return new Date(timestamp).toLocaleString("sl-SI", {
		day: "numeric",
		month: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function OfflineDataRow({
	title,
	describe,
	getInfo,
	download,
	clear,
	onChanged,
}) {
	const [info, setInfo] = useState(getInfo);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const handleDownload = async () => {
		setBusy(true);
		setError("");
		try {
			setInfo(await download());
			onChanged?.();
		} catch (err) {
			console.error(`Error downloading ${title}:`, err);
			setError(err?.message || "Prenos ni uspel.");
			setInfo(getInfo());
		} finally {
			setBusy(false);
		}
	};

	const handleClear = () => {
		clear();
		setInfo(null);
		setError("");
		onChanged?.();
	};

	return (
		<div className="settings__card offline-data__row">
			<div className="offline-data__text">
				<strong>{title}</strong>
				<span>
					{info
						? `${describe(info)} · posodobljeno ${formatDate(info.updatedAt)}`
						: "Ni preneseno (uporablja se splet)"}
				</span>
				{error && <span className="offline-data__error">{error}</span>}
			</div>
			<div className="offline-data__buttons">
				<button type="button" disabled={busy} onClick={handleDownload}>
					{busy ? "Prenašam…" : info ? "Posodobi" : "Prenesi"}
				</button>
				{info && (
					<button type="button" disabled={busy} onClick={handleClear}>
						Izbriši
					</button>
				)}
			</div>
		</div>
	);
}

const NO_SUBTABS = [];

const SettingsTab = ({
	visibility,
	setVisibility,
	busOperators,
	setBusOperators,
	theme,
	setTheme,
	mapTheme,
	setMapTheme,
	onStopsUpdated,
	onSwipeEdge,
}) => {
	const [radius, setRadius] = usePersistentState(
		"stationRadius",
		DEFAULT_RADIUS,
	);

	const swipe = useSwipeTabs({
		ids: NO_SUBTABS,
		value: "",
		onChange: () => {},
		onEdge: onSwipeEdge,
	});

	return (
		<div className="settings" {...swipe}>
			<div className="inside">
				<Section title="Zemljevid" index={0}>
					<div className="settings__card">
						<CheckboxGroup
							title="Aktivni markerji"
							options={MARKER_OPTIONS}
							values={visibility}
							onChange={(key, checked) =>
								setVisibility((v) => ({ ...v, [key]: checked }))
							}
						/>
						<CheckboxGroup
							title="Prevozniki"
							options={OPERATOR_OPTIONS}
							values={busOperators}
							onChange={(key, checked) =>
								setBusOperators((prev) => ({
									...prev,
									[key]: checked,
								}))
							}
						/>
					</div>
				</Section>
				<Section title="Videz" index={1}>
					<div className="settings__card">
						<ThemeSwitch
							title="Temni način (aplikacija)"
							label="Preklopi temni način"
							isDark={theme === "dark"}
							onToggle={() =>
								setTheme(theme === "dark" ? "light" : "dark")
							}
						/>
						<ThemeSwitch
							title="Temni način (zemljevid)"
							label="Preklopi temni način zemljevida"
							isDark={mapTheme === "dark"}
							onToggle={() =>
								setMapTheme(
									mapTheme === "dark" ? "light" : "dark",
								)
							}
						/>
					</div>
				</Section>
				<Section title="Radij postaj" index={2}>
					<div className="settings__card">
						<RadiusSlider
							label="Avtobusne postaje"
							value={radius.busRadius}
							min={1}
							max={20}
							onChange={(busRadius) =>
								setRadius((r) => ({ ...r, busRadius }))
							}
						/>
						<RadiusSlider
							label="Železniške postaje"
							value={radius.szRadius}
							min={5}
							max={300}
							onChange={(szRadius) =>
								setRadius((r) => ({ ...r, szRadius }))
							}
						/>
					</div>
				</Section>
				<Section title="Podatki v napravi" index={3}>
					<OfflineDataRow
						title="LPP linije"
						describe={(info) => `${info.count} poti`}
						getInfo={getLppRoutesInfo}
						download={downloadLppRoutes}
						clear={clearLppRoutes}
					/>
					<OfflineDataRow
						title="Postaje"
						describe={(info) =>
							`${info.busCount} + ${info.szCount} postaj`
						}
						getInfo={getStopsInfo}
						download={downloadStops}
						clear={clearStops}
						onChanged={onStopsUpdated}
					/>
				</Section>
				<Section title="O aplikaciji" index={4}>
					<p className="settings__card about">
						Avtor:{" "}
						<ExternalLink href="https://cernetic.cc">
							Jaka Černetič
						</ExternalLink>
						<br />
						Viri podatkov:{" "}
						{SOURCE_LINKS.map(([href, label], index) => (
							<span key={href}>
								{index > 0 && ", "}
								<ExternalLink href={href}>{label}</ExternalLink>
							</span>
						))}
						<br />
						Izvirna koda:{" "}
						<ExternalLink href="https://github.com/jakecernet/ijpp-tracker">
							GitHub
						</ExternalLink>
					</p>
				</Section>
			</div>
		</div>
	);
};

export default memo(SettingsTab);
