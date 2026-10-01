const DAY_S = 24 * 3600;

export const pad2 = (n) => String(n).padStart(2, "0");

/** Date | ISO niz → "HH:mm" (lokalni čas) ali "N/A". */
export function formatHHmm(value) {
	if (value == null || value === "") return "N/A";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "N/A";
	return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Lokalni datum kot "YYYY-MM-DD" (toISOString bi vrnil UTC datum). */
export function localDateKey(date = new Date()) {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Sekunde od polnoči → "HH:MM:SS". Ure so lahko ≥ 24 (GTFS nočne vožnje). */
export function secondsToClock(seconds) {
	if (!Number.isFinite(seconds)) return null;
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	return `${pad2(h)}:${pad2(m)}:${pad2(total % 60)}`;
}

/** "HH:MM[:SS]" (ure smejo biti ≥ 24) → sekunde od polnoči, ali null. */
export function clockToSeconds(clock) {
	if (typeof clock !== "string") return null;
	const m = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(clock);
	if (!m) return null;
	return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}

/**
 * Sekunde od polnoči (GTFS) → Date.
 * Vrednosti ≥ 24 h pripadajo nočnim vožnjam včerajšnjega voznega dne, zato
 * poskusimo najprej včeraj; če je tako dobljen čas že mimo, vzamemo današnji dan.
 */
export function secondsToDate(seconds, now = new Date()) {
	if (!Number.isFinite(seconds)) return null;
	const at = (dayOffset) => {
		const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
		d.setSeconds(seconds);
		return d;
	};
	if (seconds >= DAY_S) {
		const yesterday = at(-1);
		if (yesterday.getTime() >= now.getTime() - 5 * 60000) return yesterday;
	}
	return at(0);
}

/** "HH:MM[:SS]" → Date (glej `secondsToDate`), ali null. */
export function clockToDate(clock, now = new Date()) {
	return secondsToDate(clockToSeconds(clock), now);
}

/** Minute do `date` (zaokroženo, nikoli negativno). */
export function minutesUntil(date, now = Date.now()) {
	return Math.max(0, Math.round((date.getTime() - now) / 60000));
}

/** 75 → "1h 15m", 5 → "5 min". Drugi element je URA v "HH:mm" (lahko "N/A"). */
export function formatEta(etaMinutes, timeLabel) {
	const eta =
		typeof etaMinutes === "number" && etaMinutes >= 60
			? `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`
			: `${etaMinutes ?? "?"} min`;
	return `${eta}\n(${timeLabel ?? "N/A"})`;
}
