import { useCallback, useRef } from "react";

const MIN_DISTANCE = 60; // px
const MAX_DURATION = 700; // ms
const DIRECTION_RATIO = 1.5; // |dx| mora biti vsaj 1,5x večji od |dy|

// Elementi, kjer vlečenje prstu ni poteza za menjavo zavihka.
const IGNORE_SELECTOR =
	'input, textarea, select, [role="slider"], [role="switch"], [data-no-swipe]';

/**
 * Poteza levo/desno menja podzavihke; na skrajnem zavihku preide na sosednji
 * glavni zavihek (prek `onEdge`).
 *
 * @param {object} options
 * @param {string[]} options.ids - ID-ji podzavihkov po vrsti (prazno = brez podzavihkov)
 * @param {string} options.value - trenutni podzavihek
 * @param {(id: string) => void} options.onChange
 * @param {(direction: 1 | -1) => void} [options.onEdge] - 1 = naprej (levo), -1 = nazaj (desno)
 * @returns {object} props za korenski element zavihka
 */
export function useSwipeTabs({ ids, value, onChange, onEdge }) {
	const start = useRef(null);

	const onTouchStart = useCallback((event) => {
		if (event.touches.length !== 1 || event.target.closest?.(IGNORE_SELECTOR)) {
			start.current = null;
			return;
		}
		const { clientX, clientY } = event.touches[0];
		start.current = { x: clientX, y: clientY, time: Date.now() };
	}, []);

	const onTouchEnd = useCallback(
		(event) => {
			const origin = start.current;
			start.current = null;
			if (!origin || event.changedTouches.length !== 1) return;

			const dx = event.changedTouches[0].clientX - origin.x;
			const dy = event.changedTouches[0].clientY - origin.y;
			if (
				Math.abs(dx) < MIN_DISTANCE ||
				Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO ||
				Date.now() - origin.time > MAX_DURATION
			) {
				return;
			}

			const direction = dx < 0 ? 1 : -1;
			const next = ids.indexOf(value) + direction;
			if (next >= 0 && next < ids.length) onChange(ids[next]);
			else onEdge?.(direction);
		},
		[ids, value, onChange, onEdge],
	);

	const onTouchCancel = useCallback(() => {
		start.current = null;
	}, []);

	return {
		onTouchStart,
		onTouchEnd,
		onTouchCancel,
		style: { touchAction: "pan-y pinch-zoom" },
	};
}
