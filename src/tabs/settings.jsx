import { useEffect } from "react";

const SettingsTab = ({ setActiveOperators, activeOperators, radius, setRadius, busRadius, setBusRadius }) => {
	const saveSettings = () => {
		const checkboxes = document.querySelectorAll("input[type=checkbox]");
		const activeOperators = [];
		checkboxes.forEach((checkbox) => {
			if (checkbox.checked) {
				activeOperators.push(checkbox.id);
			}
		});
		setActiveOperators(activeOperators);
		localStorage.setItem(
			"activeOperators",
			JSON.stringify(activeOperators)
		);
		localStorage.setItem("radius", radius);
		localStorage.setItem("busRadius", busRadius);
		document.location.href = "/#/map";
		document.location.reload();
	};

	useEffect(() => {
		const stored = activeOperators || localStorage.getItem("activeOperators");
		stored.forEach((id) => {
			const checkbox = document.getElementById(id);
			if (checkbox) checkbox.checked = true;
		});
	}, []);

	return (
		<div className="settings">
			<div className="setting-item">
				<h2>Prikaži samo avtobuse ponudnika:</h2>
				<ul>
					<div>
						<input type="checkbox" id="arriva" name="arriva" />
						<label for="arriva">Arriva</label>
					</div>
					<div>
						<input type="checkbox" id="nomago" name="nomago" />
						<label for="nomago">Nomago</label>
					</div>
					<div>
						<input type="checkbox" id="lpp" name="lpp" />
						<label for="lpp">LPP</label>
					</div>
					<div>
						<input type="checkbox" id="murska" name="murska" />
						<label for="murska">
							Avtobusni promet Murska Sobota
						</label>
					</div>
				</ul>
			</div>
			<div className="setting-item">
				<h2>Prikaži samo postaje v radiju {radius} km.</h2>
				<input
					type="range"
					min="10"
					max="400"
					value={radius}
					onChange={(e) => setRadius(e.target.value)}
				/>
			</div>
			<div className="setting-item">
				<h2>Prikaži samo avtobuse v radiju {busRadius} km.</h2>
				<input
					type="range"
					min="10"
					max="400"
					value={busRadius}
					onChange={(e) => setBusRadius(e.target.value)}
				/>
			</div>
			<button className="save-button" onClick={saveSettings}>
				Save Settings
			</button>
		</div>
	);
};

export default SettingsTab;
