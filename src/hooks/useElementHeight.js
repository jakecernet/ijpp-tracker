import { useEffect, useRef, useState } from "react";

export function useElementHeight(initial = 0) {
	const ref = useRef(null);
	const [height, setHeight] = useState(initial);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const update = () => setHeight(Math.round(el.getBoundingClientRect().height));
		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return [ref, height];
}
