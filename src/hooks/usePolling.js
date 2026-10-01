import { useEffect, useRef } from "react";

/**
 * Periodično izvaja `task`, medtem ko je `enabled` in je zavihek viden.
 * - takoj zažene prvi klic in ob vrnitvi v zavihek osveži podatke,
 * - nikoli ne požene dveh klicev hkrati (počasno omrežje ne kopiči zahtev),
 * - vedno kliče najnovejšo različico `task` (brez ponovnega ustvarjanja intervala).
 */
export function usePolling(task, intervalMs, enabled = true) {
	const taskRef = useRef(task);
	useEffect(() => {
		taskRef.current = task;
	});

	useEffect(() => {
		if (!enabled) return;

		let disposed = false;
		let inFlight = false;
		let timer = null;

		const run = async () => {
			if (disposed || inFlight || document.hidden) return;
			inFlight = true;
			try {
				await taskRef.current();
			} catch (error) {
				console.error("Polling error:", error);
			} finally {
				inFlight = false;
			}
		};

		const stop = () => {
			if (timer !== null) {
				clearInterval(timer);
				timer = null;
			}
		};
		const start = () => {
			stop();
			if (!document.hidden) timer = setInterval(run, intervalMs);
		};
		const onVisibilityChange = () => {
			if (document.hidden) {
				stop();
			} else {
				run();
				start();
			}
		};

		run();
		start();
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			disposed = true;
			stop();
			document.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
		};
	}, [enabled, intervalMs]);
}
