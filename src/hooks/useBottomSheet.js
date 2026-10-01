import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DISMISS_THRESHOLD = 90;
const SNAP_THRESHOLD = 60;

export function useBottomSheet({ peekHeight = 160, onDismiss } = {}) {
	const ref = useRef(null);
	const [isOpen, setIsOpen] = useState(false);
	const [snap, setSnap] = useState("peek");
	const [height, setHeight] = useState(0);
	const [dragY, setDragY] = useState(null);
	const drag = useRef({ active: false, startY: 0, startOffset: 0, y: 0 });
	const onDismissRef = useRef(onDismiss);
	useEffect(() => {
		onDismissRef.current = onDismiss;
	});

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setHeight(el.offsetHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const peekOffset = Math.max(0, height - peekHeight);
	const restingOffset = snap === "full" ? 0 : peekOffset;

	const open = useCallback(() => {
		setSnap("peek");
		setIsOpen(true);
	}, []);
	const close = useCallback(() => {
		setIsOpen(false);
		setDragY(null);
	}, []);

	const onPointerDown = useCallback(
		(event) => {
			drag.current = {
				active: true,
				startY: event.clientY,
				startOffset: restingOffset,
				y: restingOffset,
			};
			event.currentTarget.setPointerCapture?.(event.pointerId);
		},
		[restingOffset],
	);

	const onPointerMove = useCallback((event) => {
		const d = drag.current;
		if (!d.active) return;
		d.y = Math.max(0, d.startOffset + (event.clientY - d.startY));
		setDragY(d.y);
	}, []);

	const endDrag = useCallback(
		(event) => {
			const d = drag.current;
			if (!d.active) return;
			d.active = false;
			event.currentTarget.releasePointerCapture?.(event.pointerId);
			setDragY(null);

			if (d.y > peekOffset + DISMISS_THRESHOLD) {
				close();
				onDismissRef.current?.();
			} else if (snap === "full" && d.y > SNAP_THRESHOLD) {
				setSnap("peek");
			} else if (snap === "peek" && d.y < peekOffset - SNAP_THRESHOLD) {
				setSnap("full");
			}
		},
		[close, peekOffset, snap],
	);

	const dragHandlers = useMemo(
		() => ({
			onPointerDown,
			onPointerMove,
			onPointerUp: endDrag,
			onPointerCancel: endDrag,
		}),
		[onPointerDown, onPointerMove, endDrag],
	);

	const style = isOpen
		? {
				transform: `translateY(${dragY ?? restingOffset}px)`,
				transition: dragY != null ? "none" : undefined,
			}
		: undefined;

	return {
		ref,
		isOpen,
		style,
		open,
		close,
		dragHandlers,
	};
}
