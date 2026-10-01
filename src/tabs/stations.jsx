import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BusFrontIcon, Heart, TrainFrontIcon } from "lucide-react";
import { List } from "react-window";
import SubTabs from "../components/SubTabs";
import { useElementHeight } from "../hooks/useElementHeight";
import { useLikedList } from "../hooks/useLikedList";
import { usePersistentState } from "../hooks/usePersistentState";
import { haversineMeters } from "../utils/geo";
import { LIKED_STATIONS_KEY, getStationId } from "../utils/likes";

const STATION_SEARCH_KEY = "stationSearchTerm";
const DEFAULT_RADIUS = { busRadius: 5, szRadius: 20 }; // km
const SEARCH_DEBOUNCE_MS = 300;
const MIN_ALL_SEARCH_LENGTH = 3;
const MIN_LIST_HEIGHT = 200;
const BASE_ROW_HEIGHT = 52;
const ROUTES_ROW_HEIGHT = 26;
const MAX_ROUTE_BADGES = 6;

const STATION_TABS = [
	["nearMe", "V bližini"],
	["all", "Vse"],
	["liked", "Priljubljene"],
];

const formatDistance = (km) =>
	km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`;

/** Razdalja uporabnik → postaja v km (Infinity, če postaja nima koordinat). */
function distanceKm(userLocation, station) {
	const lat = station?.gpsLocation?.[0] ?? station?.lat;
	const lon = station?.gpsLocation?.[1] ?? station?.lon;
	if (!Number.isFinite(lat) || !Number.isFinite(lon) || !userLocation) {
		return Infinity;
	}
	return haversineMeters(userLocation[0], userLocation[1], lat, lon) / 1000;
}

/** Postaja z vnaprej izračunano razdaljo in imenom za iskanje (brez kopiranja postaje). */
const toEntry = (station, kind, userLocation) => ({
	station,
	kind,
	distance: distanceKm(userLocation, station),
	nameLower: (station?.name ?? "").toLowerCase(),
});

const getRowHeight = (entry) =>
	BASE_ROW_HEIGHT +
	(entry?.station?.routes_on_stop?.length ? ROUTES_ROW_HEIGHT : 0);

const StationItem = memo(({ entry, isLiked, onSelect, onToggleLike }) => {
	const { station, kind, distance } = entry;
	const routes = station?.routes_on_stop;

	return (
		<div
			className="station-item-search"
			role="button"
			tabIndex={0}
			onClick={() => onSelect(entry)}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onSelect(entry);
				}
			}}>
			<div className="station-content">
				<div className="name">
					{kind === "sz" ? (
						<TrainFrontIcon size={24} />
					) : (
						<BusFrontIcon size={24} />
					)}
					<h3>{station?.name}</h3>
					{kind !== "sz" && typeof station?.vCenter === "boolean" && (
						<span
							className={`direction-badge ${station.vCenter ? "direction-badge--in" : "direction-badge--out"}`}>
							{station.vCenter ? "V center" : "Iz centra"}
						</span>
					)}
				</div>
				<ul className="station-info">
					{routes?.slice(0, MAX_ROUTE_BADGES).map((route, index) => (
						<li key={index}>
							<p>{route}</p>
						</li>
					))}
					{routes?.length > MAX_ROUTE_BADGES && (
						<li>
							<p>+ {routes.length - MAX_ROUTE_BADGES}</p>
						</li>
					)}
				</ul>
			</div>
			{Number.isFinite(distance) && (
				<span className="distance">{formatDistance(distance)}</span>
			)}
			<button
				type="button"
				className={`like-btn ${isLiked ? "liked" : ""}`}
				onClick={(event) => onToggleLike(entry, event)}
				onKeyDown={(event) => event.stopPropagation()}
				aria-pressed={isLiked}
				aria-label={
					isLiked
						? "Odstrani iz priljubljenih"
						: "Dodaj med priljubljene"
				}>
				<Heart size={20} fill={isLiked ? "currentColor" : "none"} />
			</button>
		</div>
	);
});

const StationRow = memo(
	({
		index,
		style,
		ariaAttributes,
		entries,
		likedIds,
		onToggleLike,
		onSelect,
	}) => {
		const entry = entries[index];
		return (
			<div style={style} {...ariaAttributes}>
				<StationItem
					entry={entry}
					isLiked={likedIds.has(getStationId(entry.station))}
					onToggleLike={onToggleLike}
					onSelect={onSelect}
				/>
			</div>
		);
	},
);

const StationList = ({ entries, height, likedIds, onToggleLike, onSelect }) => {
	const rowProps = useMemo(
		() => ({ entries, likedIds, onToggleLike, onSelect }),
		[entries, likedIds, onToggleLike, onSelect],
	);
	const rowHeight = useCallback(
		(index) => getRowHeight(entries[index]),
		[entries],
	);

	return (
		<List
			rowCount={entries.length}
			rowHeight={rowHeight}
			rowComponent={StationRow}
			rowProps={rowProps}
			overscanCount={5}
			style={{ height, width: "100%" }}
		/>
	);
};

const StationsTab = ({ userLocation, onSelectStation, busStops, szStops }) => {
	const [searchTerm, setSearchTerm] = usePersistentState(
		STATION_SEARCH_KEY,
		"",
		{
			raw: true,
		},
	);
	// Začetna vrednost = shranjeni niz, sicer bi se seznam ~300 ms prikazoval nefiltriran.
	const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);
	const [page, setPage] = useState("nearMe"); // nearMe | all | liked
	const [likedStations, toggleLikedStation] =
		useLikedList(LIKED_STATIONS_KEY);
	const [radius] = usePersistentState("stationRadius", DEFAULT_RADIUS);
	const [listRef, measuredHeight] = useElementHeight(400);
	const listHeight = Math.max(MIN_LIST_HEIGHT, measuredHeight);

	useEffect(() => {
		const timer = setTimeout(
			() => setDebouncedTerm(searchTerm),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	const term = debouncedTerm.toLowerCase();

	// Razdalje za ~12.000 postaj računamo le ob spremembi postaj ali lokacije.
	const allEntries = useMemo(
		() => [
			...busStops.map((stop) => toEntry(stop, "bus", userLocation)),
			...szStops.map((stop) => toEntry(stop, "sz", userLocation)),
		],
		[busStops, szStops, userLocation],
	);

	const nearMeEntries = useMemo(() => {
		const busMax = radius?.busRadius ?? DEFAULT_RADIUS.busRadius;
		const szMax = radius?.szRadius ?? DEFAULT_RADIUS.szRadius;
		return allEntries
			.filter(
				(entry) =>
					entry.distance <= (entry.kind === "bus" ? busMax : szMax) &&
					entry.nameLower.includes(term),
			)
			.sort((a, b) => a.distance - b.distance);
	}, [allEntries, term, radius]);

	const allSearchEntries = useMemo(() => {
		if (term.length < MIN_ALL_SEARCH_LENGTH) return [];
		return allEntries
			.filter((entry) => entry.nameLower.includes(term))
			.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
	}, [allEntries, term]);

	// Priljubljenim postajam razdaljo izračunamo na novo (shranjena bi bila zastarela).
	const likedEntries = useMemo(
		() =>
			likedStations
				.filter((liked) =>
					(liked.name ?? "").toLowerCase().includes(term),
				)
				.map((liked) =>
					toEntry(
						liked.data,
						liked.data?.type === "sz" ? "sz" : "bus",
						userLocation,
					),
				),
		[likedStations, term, userLocation],
	);

	const likedIds = useMemo(
		() => new Set(likedStations.map((station) => station.id)),
		[likedStations],
	);

	const toggleLike = useCallback(
		({ station }, event) => {
			event?.stopPropagation();
			const id = getStationId(station);
			if (id == null) return; // brez ID-ja postaje ni mogoče ločiti od drugih
			toggleLikedStation(id, () => ({
				name: station.name,
				data: station,
			}));
		},
		[toggleLikedStation],
	);

	const handleSelect = useCallback(
		({ station, kind }) => onSelectStation({ ...station, type: kind }),
		[onSelectStation],
	);

	const listProps = {
		height: listHeight,
		likedIds,
		onToggleLike: toggleLike,
		onSelect: handleSelect,
	};

	return (
		<div className="insideDiv">
			<h2>Postaje</h2>
			<input
				type="search"
				placeholder={
					page === "all"
						? "Vnesite vsaj 3 znake..."
						: "Išči postaje..."
				}
				aria-label="Iskanje postaj"
				className="search-input"
				value={searchTerm}
				onChange={(event) => setSearchTerm(event.target.value)}
			/>
			<SubTabs
				label="Prikaz postaj"
				tabs={STATION_TABS}
				value={page}
				onChange={setPage}
			/>

			<div className="results station-list" ref={listRef}>
				{page === "nearMe" &&
					(nearMeEntries.length === 0 ? (
						<p className="empty-message">Ni postaj v bližini.</p>
					) : (
						<StationList entries={nearMeEntries} {...listProps} />
					))}

				{page === "all" && (
					<>
						{searchTerm.length < MIN_ALL_SEARCH_LENGTH && (
							<p className="empty-message">
								Vnesite vsaj 3 znake za iskanje.
							</p>
						)}
						{searchTerm.length >= MIN_ALL_SEARCH_LENGTH &&
							allSearchEntries.length === 0 && (
								<p className="empty-message">Ni rezultatov.</p>
							)}
						{allSearchEntries.length > 0 && (
							<StationList
								entries={allSearchEntries}
								{...listProps}
							/>
						)}
					</>
				)}

				{page === "liked" &&
					(likedEntries.length === 0 ? (
						<p className="empty-message">
							Ni priljubljenih postaj. Kliknite na ❤️ za
							dodajanje.
						</p>
					) : (
						<StationList entries={likedEntries} {...listProps} />
					))}
			</div>
		</div>
	);
};

export default memo(StationsTab);
