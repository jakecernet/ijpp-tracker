import { LocateFixedIcon, Heart, SquareText, BusIcon } from "lucide-react";

export default function SubTabs({ tabs, value, onChange, label }) {
	return (
		<div className="top-nav" role="tablist" aria-label={label}>
			{tabs.map(([id, text, icon, stationName]) => (
				<button
					key={id}
					type="button"
					role="tab"
					aria-selected={value === id}
					className={value === id ? "active" : ""}
					onClick={() => onChange(id)}>
                    {icon === "LocateFixedIcon" && <LocateFixedIcon size={16} />}
                    {icon === "Heart" && <Heart size={16} />}
                    {icon === "SquareText" && <SquareText size={16} />}
                    {icon === "BusIcon" && <BusIcon size={16} />}
					{text}
                    {stationName && ` ${stationName}`}
				</button>
			))}
		</div>
	);
}
