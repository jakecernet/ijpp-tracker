import { useState, useMemo, useCallback, memo, useEffect, useRef } from "react";
import { Heart, BusFrontIcon, TrainFrontIcon } from "lucide-react";
import { List } from "react-window";

const LIKED_STATIONS_KEY = "likedStations";
const STATION_SEARCH_KEY = "stationSearchTerm";

const StationItem = memo(
	({ station, onSelect, isLiked, onToggleLike, showDistance }) => (
		<div className="station-item-search" onClick={onSelect}>
			<div className="station-content">
				<div className="name">
					{station?.type === "sz" ? (
						<TrainFrontIcon size={24} />
					) : (
						<BusFrontIcon size={24} />
					)}
					<h3>{station?.name}</h3>
					{station?.vCenter !== null && station?.type !== "sz" && (
						<span
							style={{
								fontSize: "11px",
								backgroundColor:
									station?.vCenter === true
										? "darkgreen"
										: "#BA8E23",
								color: "var(--text-color)",
								padding: "2px 6px",
								borderRadius: "4px",
								height: "fit-content",
								marginTop: "auto",
								marginBottom: "auto",
								textWrap: "nowrap",
							}}>
							{station?.vCenter === true
								? "V center"
								: "Iz centra"}
						</span>
					)}
				</div>
				<br></br>
				<ul className="station-info">
					{station?.routes_on_stop
						?.slice(0, 6)
						.map((route, index) => (
							<li key={index}>
								<p>{route}</p>
							</li>
						))}
					{station?.routes_on_stop?.length > 6 && (
						<li>
							<p>+ {station.routes_on_stop.length - 6}</p>
						</li>
					)}
				</ul>
			</div>
			{showDistance && station?.distance && (
				<span className="distance">
					{station.distance.toFixed(1)} km
				</span>
			)}
			<button
				className={`like-btn ${isLiked ? "liked" : ""}`}
				onClick={onToggleLike}
				aria-label={
					isLiked
						? "Odstrani iz priljubljenih"
						: "Dodaj med priljubljene"
				}>
				<Heart size={20} fill={isLiked ? "currentColor" : "none"} />
			</button>
		</div>
	),
);

const StationRow = memo(
	({ index, style, stations, isStationLiked, onToggleLike, onSelect }) => {
		const station = stations[index];
		return (
			<div style={style}>
				<StationItem
					station={station}
					isLiked={isStationLiked(station)}
					onToggleLike={(e) => onToggleLike(station, e)}
					onSelect={() => onSelect(station)}
					showDistance={true}
				/>
			</div>
		);
	},
);

const LikedStationRow = memo(
	({ index, style, likedStations, onToggleLike, onSelect }) => {
		const liked = likedStations[index];
		return (
			<div style={style}>
				<StationItem
					station={liked.data}
					isLiked={true}
					onToggleLike={(e) => onToggleLike(liked.data, e)}
					onSelect={() => onSelect(liked.data)}
					showDistance={true}
				/>
			</div>
		);
	},
);

const loadLikedItems = (key) => {
	try {
		const stored = localStorage.getItem(key);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
};

const saveLikedItems = (key, items) => {
	try {
		localStorage.setItem(key, JSON.stringify(items));
	} catch {}
};

const loadSearchTerm = () => {
	try {
		return localStorage.getItem(STATION_SEARCH_KEY) || "";
	} catch {
		return "";
	}
};

const StationsTab = ({ userLocation, setActiveStation, busStops, szStops }) => {
	const [searchTerm, setSearchTerm] = useState(loadSearchTerm);
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
	const [page, setPage] = useState("nearMe"); // nearMe, all, liked
	const [likedStations, setLikedStations] = useState(() =>
		loadLikedItems(LIKED_STATIONS_KEY),
	);
	const [radius] = useState(() => {
		const stored = localStorage.getItem("stationRadius");
		return stored ? JSON.parse(stored) : { busRadius: 5, szRadius: 20 };
	});

	useEffect(() => {
		try {
			localStorage.setItem(STATION_SEARCH_KEY, searchTerm);
		} catch {
			// Storage may be unavailable in private browsing.
		}
	}, [searchTerm]);

	// Debounce search term for better performance
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchTerm(searchTerm);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchTerm]);

	// Calculate distances and create allStations in one memo
	const allStations = useMemo(() => {
		const toRadians = (degrees) => degrees * (Math.PI / 180);
		const earthRadius = 6371;

		const calculateDistance = (stop) => {
			const lat1 = userLocation[0];
			const lon1 = userLocation[1];
			const lat2 = stop.gpsLocation?.[0] ?? stop.lat;
			const lon2 = stop.gpsLocation?.[1] ?? stop.lon;
			const dLat = toRadians(lat2 - lat1);
			const dLon = toRadians(lon2 - lon1);

			const a =
				Math.sin(dLat / 2) * Math.sin(dLat / 2) +
				Math.cos(toRadians(lat1)) *
					Math.cos(toRadians(lat2)) *
					Math.sin(dLon / 2) *
					Math.sin(dLon / 2);
			const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
			return earthRadius * c;
		};

		return [
			...busStops.map((stop) => ({
				...stop,
				type: "bus",
				distance: calculateDistance(stop),
			})),
			...szStops.map((stop) => ({
				...stop,
				type: "sz",
				distance: calculateDistance(stop),
			})),
		];
	}, [busStops, szStops, userLocation]);

	// Get unique station ID for liking
	const getStationId = useCallback((station) => {
		return (
			station?.ref_id ??
			station?.gtfs_id ??
			station?.ijpp_id ??
			station?.stopId
		);
	}, []);

	const isStationLiked = useCallback(
		(station) => {
			const id = getStationId(station);
			return likedStations.some((s) => s.id === id);
		},
		[likedStations, getStationId],
	);

	const toggleLikeStation = useCallback(
		(station, e) => {
			e?.stopPropagation();
			const id = getStationId(station);
			setLikedStations((prev) => {
				const exists = prev.some((s) => s.id === id);
				const newLiked = exists
					? prev.filter((s) => s.id !== id)
					: [...prev, { id, name: station.name, data: station }];
				saveLikedItems(LIKED_STATIONS_KEY, newLiked);
				return newLiked;
			});
		},
		[getStationId],
	);

	// Filtered stations for "Near Me"
	const nearMeStations = useMemo(() => {
		return allStations
			.filter((stop) => {
				const maxDistance =
					stop.type === "bus" ? radius?.busRadius : radius?.szRadius;
				return stop.distance <= maxDistance && stop.distance > 0;
			})
			.filter((stop) =>
				stop.name
					.toLowerCase()
					.includes(debouncedSearchTerm.toLowerCase()),
			)
			.sort((a, b) => a.distance - b.distance);
	}, [allStations, debouncedSearchTerm, radius]);

	const filteredAllStations = useMemo(() => {
		if (debouncedSearchTerm.length < 3) return [];
		return allStations
			.filter((stop) =>
				stop.name
					.toLowerCase()
					.includes(debouncedSearchTerm.toLowerCase()),
			)
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [allStations, debouncedSearchTerm]);

	const filteredLikedStations = useMemo(() => {
		return likedStations.filter((liked) =>
			liked.name
				.toLowerCase()
				.includes(debouncedSearchTerm.toLowerCase()),
		);
	}, [likedStations, debouncedSearchTerm]);

	const handleStationSelect = useCallback(
		(station) => {
			setActiveStation(station);
			window.location.hash = "/lines";
			localStorage.setItem("activeStation", JSON.stringify(station));
		},
		[setActiveStation],
	);

	const listContainerRef = useRef(null);
	const [listHeight, setListHeight] = useState(400);

	useEffect(() => {
		const container = listContainerRef.current;
		if (!container) return;

		let rafId = null;
		let lastHeight = null;

		const applyHeight = (height) => {
			if (!Number.isFinite(height)) return;
			const rounded = Math.round(height);
			if (rounded === lastHeight) return;
			lastHeight = rounded;
			setListHeight(Math.max(200, rounded));
		};

		const measure = () => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				rafId = null;
				if (!container.isConnected) return;
				applyHeight(container.getBoundingClientRect().height);
			});
		};

		measure();

		let ro = null;
		if (typeof ResizeObserver !== "undefined") {
			ro = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (!entry) return;
				const height =
					entry.contentBoxSize?.[0]?.blockSize ??
					entry.contentRect?.height;
				applyHeight(height);
			});
			ro.observe(container);
		} else {
			window.addEventListener("resize", measure);
		}

		return () => {
			if (rafId) cancelAnimationFrame(rafId);
			if (ro) ro.disconnect();
			else window.removeEventListener("resize", measure);
		};
	}, []);

	const getItemHeight = useCallback((station) => {
		let height = 52;
		const routeCount = station?.routes_on_stop?.length || 0;
		if (routeCount > 0) {
			height += 26; // Route badges row
		}
		return height;
	}, []);

	const getNearMeItemSize = useCallback(
		(index) => getItemHeight(nearMeStations[index]),
		[nearMeStations, getItemHeight],
	);

	const getAllItemSize = useCallback(
		(index) => getItemHeight(filteredAllStations[index]),
		[filteredAllStations, getItemHeight],
	);

	const getLikedItemSize = useCallback(
		(index) => getItemHeight(filteredLikedStations[index]?.data),
		[filteredLikedStations, getItemHeight],
	);

	return (
		<div className="insideDiv">
			<h2>Postaje</h2>
			<input
				type="text"
				placeholder={
					page === "all"
						? "Vnesite vsaj 3 znake..."
						: "Išči postaje..."
				}
				className="search-input"
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
			/>
			<div className="top-nav">
				<button
					className={page === "nearMe" ? "active" : ""}
					onClick={() => setPage("nearMe")}>
					V bližini
				</button>
				<button
					className={page === "all" ? "active" : ""}
					onClick={() => setPage("all")}>
					Vse
				</button>
				<button
					className={page === "liked" ? "active" : ""}
					onClick={() => setPage("liked")}>
					Priljubljene
				</button>
			</div>

			<div className="results station-list" ref={listContainerRef}>
				{page === "nearMe" && (
					<>
						{nearMeStations.length === 0 && (
							<p className="empty-message">
								Ni postaj v bližini.
							</p>
						)}
						{nearMeStations.length > 0 && (
							<List
								rowCount={nearMeStations.length}
								rowHeight={getNearMeItemSize}
								rowComponent={StationRow}
								rowProps={{
									stations: nearMeStations,
									isStationLiked,
									onToggleLike: toggleLikeStation,
									onSelect: handleStationSelect,
								}}
								overscanCount={5}
								style={{ height: listHeight, width: "100%" }}
							/>
						)}
					</>
				)}

				{page === "all" && (
					<>
						{searchTerm.length < 3 && (
							<p className="empty-message">
								Vnesite vsaj 3 znake za iskanje.
							</p>
						)}
						{searchTerm.length >= 3 &&
							filteredAllStations.length === 0 && (
								<p className="empty-message">Ni rezultatov.</p>
							)}
						{filteredAllStations.length > 0 && (
							<List
								rowCount={filteredAllStations.length}
								rowHeight={getAllItemSize}
								rowComponent={StationRow}
								rowProps={{
									stations: filteredAllStations,
									isStationLiked,
									onToggleLike: toggleLikeStation,
									onSelect: handleStationSelect,
								}}
								overscanCount={5}
								style={{ height: listHeight, width: "100%" }}
							/>
						)}
					</>
				)}

				{page === "liked" && (
					<>
						{filteredLikedStations.length === 0 && (
							<p className="empty-message">
								Ni priljubljenih postaj. Kliknite na ❤️ za
								dodajanje.
							</p>
						)}
						{filteredLikedStations.length > 0 && (
							<List
								rowCount={filteredLikedStations.length}
								rowHeight={getLikedItemSize}
								rowComponent={LikedStationRow}
								rowProps={{
									likedStations: filteredLikedStations,
									onToggleLike: toggleLikeStation,
									onSelect: handleStationSelect,
								}}
								overscanCount={5}
								style={{ height: listHeight, width: "100%" }}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default StationsTab;
