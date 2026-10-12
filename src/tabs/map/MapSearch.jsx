import { memo, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { BusFrontIcon, SearchIcon, TrainFrontIcon, XIcon } from "lucide-react";

import { buildSearchIndex, searchItems } from "./search";

const KIND_LABEL = { line: "Linija", bus: "Vozilo", train: "Vlak" };

/** Slovenski dvojinski/množinski sklon: 1 vozilo, 2 vozili, 3-4 vozila, 5+ vozil. */
const vehicleCount = (n) =>
	`${n} ${n === 1 ? "vozilo" : n === 2 ? "vozili" : n <= 4 ? "vozila" : "vozil"}`;

/** Plavajoča iskalna vrstica (kot na Google Maps) za aktivne linije, vozila in vlake. */
const MapSearch = memo(function MapSearch({
	gpsPositions,
	trains,
	busOperators,
	visibility,
	onPick,
}) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(0);
	const rootRef = useRef(null);
	const inputRef = useRef(null);
	const listId = useId();

	const deferredQuery = useDeferredValue(query);
	const hasQuery = deferredQuery.trim().length > 0;

	// Indeks gradimo šele, ko uporabnik začne tipkati (pozicije se osvežujejo pogosto).
	const index = useMemo(
		() =>
			hasQuery
				? buildSearchIndex({ gpsPositions, trains, busOperators, visibility })
				: [],
		[hasQuery, gpsPositions, trains, busOperators, visibility],
	);
	const results = useMemo(
		() => searchItems(index, deferredQuery),
		[index, deferredQuery],
	);

	useEffect(() => setHighlighted(0), [deferredQuery]);

	// Klik zunaj zapre seznam.
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event) => {
			if (!rootRef.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	const pick = (item) => {
		setOpen(false);
		inputRef.current?.blur();
		onPick(item);
	};

	const onKeyDown = (event) => {
		if (event.key === "Escape") {
			setOpen(false);
			inputRef.current?.blur();
		} else if (event.key === "ArrowDown" && results.length) {
			event.preventDefault();
			setOpen(true);
			setHighlighted((i) => (i + 1) % results.length);
		} else if (event.key === "ArrowUp" && results.length) {
			event.preventDefault();
			setHighlighted((i) => (i - 1 + results.length) % results.length);
		} else if (event.key === "Enter" && results[highlighted]) {
			event.preventDefault();
			pick(results[highlighted]);
		}
	};

	const showPanel = open && hasQuery;

	return (
		<div className="map-search" ref={rootRef}>
			<div className="map-search__field">
				<SearchIcon size={18} aria-hidden="true" />
				<input
					ref={inputRef}
					type="text"
					role="combobox"
					aria-expanded={showPanel}
					aria-controls={listId}
					aria-label="Iskanje linij, vozil in vlakov"
					placeholder="Išči linijo, registrsko, vlak..."
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					enterKeyHint="search"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
				/>
				{query && (
					<button
						type="button"
						className="map-search__clear"
						aria-label="Počisti iskanje"
						onClick={() => {
							setQuery("");
							inputRef.current?.focus();
						}}>
						<XIcon size={16} aria-hidden="true" />
					</button>
				)}
			</div>

			{showPanel && (
				<ul className="map-search__results" id={listId} role="listbox">
					{results.length === 0 ? (
						<li className="map-search__empty">
							Ni aktivnih zadetkov na zemljevidu.
						</li>
					) : (
						results.map((item, i) => (
							<li
								key={item.id}
								role="option"
								aria-selected={i === highlighted}
								className={
									i === highlighted
										? "map-search__item map-search__item--active"
										: "map-search__item"
								}
								onPointerEnter={() => setHighlighted(i)}
								onClick={() => pick(item)}>
								<span
									className="map-search__badge"
									style={{
										background: `var(--${item.brand}-color, var(--default-color))`,
									}}>
									{item.kind === "train" ? (
										<TrainFrontIcon size={16} aria-hidden="true" />
									) : (
										<BusFrontIcon size={16} aria-hidden="true" />
									)}
								</span>
								<span className="map-search__text">
									<span className="map-search__title">{item.title}</span>
									{item.subtitle && (
										<span className="map-search__subtitle">
											{item.subtitle}
										</span>
									)}
								</span>
								<span className="map-search__meta">
									{item.kind === "line"
										? vehicleCount(item.count)
										: KIND_LABEL[item.kind]}
								</span>
							</li>
						))
					)}
				</ul>
			)}
		</div>
	);
});

export default MapSearch;
