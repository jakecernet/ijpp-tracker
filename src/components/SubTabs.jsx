export default function SubTabs({ tabs, value, onChange, label }) {
	return (
		<div className="top-nav" role="tablist" aria-label={label}>
			{tabs.map(([id, text]) => (
				<button
					key={id}
					type="button"
					role="tab"
					aria-selected={value === id}
					className={value === id ? "active" : ""}
					onClick={() => onChange(id)}>
					{text}
				</button>
			))}
		</div>
	);
}
