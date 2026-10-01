import { useCallback } from "react";
import { usePersistentState } from "./usePersistentState";

const normalize = (stored, fallback) =>
	Array.isArray(stored) ? stored : fallback;

export function useLikedList(storageKey) {
	const [items, setItems] = usePersistentState(storageKey, [], { normalize });

	const toggle = useCallback(
		(id, createEntry) => {
			setItems((prev) =>
				prev.some((item) => item.id === id)
					? prev.filter((item) => item.id !== id)
					: [...prev, { id, ...createEntry() }],
			);
		},
		[setItems],
	);

	return [items, toggle];
}
