const SettingsTab = () => {
	return (
		<div>
			<h2>Settings</h2>
			<div className="setting-item">
				<label htmlFor="notifications">Enable Notifications</label>
				<input type="checkbox" id="notifications" />
			</div>
			<input
				type="text"
				placeholder="Home Address"
				className="setting-input"
			/>
			<input
				type="text"
				placeholder="Work Address"
				className="setting-input"
			/>
			<button className="save-button">Save Settings</button>
		</div>
	);
};

export default SettingsTab;
