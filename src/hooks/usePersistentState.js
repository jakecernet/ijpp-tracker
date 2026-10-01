import { useEffect, useState } from "react";
import { readJSON, readString, writeJSON, writeString } from "../utils/storage";

/**
 * useState, ki se sinhronizira z localStorage.
 *
 * @param {string} key
 * @param {*|(() => *)} initial - privzeta vrednost (ali funkcija, ki jo vrne)
 * @param {object} [options]
 * @param {boolean} [options.raw] - shrani navaden niz (brez JSON), npr. za "theme"
 * @param {(stored: *) => *} [options.normalize] - popravi/združi shranjeno vrednost s privzeto
 */
export function usePersistentState(
	key,
	initial,
	{ raw = false, normalize } = {},
) {
	const [value, setValue] = useState(() => {
		const fallback = typeof initial === "function" ? initial() : initial;
		const stored = raw ? readString(key, null) : readJSON(key, null);
		if (normalize) return normalize(stored, fallback);
		return stored ?? fallback;
	});

	useEffect(() => {
		if (raw) writeString(key, value);
		else writeJSON(key, value);
	}, [key, value, raw]);

	return [value, setValue];
}
