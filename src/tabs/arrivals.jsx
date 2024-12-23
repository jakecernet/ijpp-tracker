import { act } from "react";

const ArrivalsTab = ({ activeStation }) => {
	return (
		<div>
			<h2>Prihodi na: {activeStation}</h2>
			<input
				type="text"
				placeholder="Search for a bus route"
				className="search-input"
			/>
			<div className="arrival-item">
				<h3>6B</h3>
				<p>Naslednji prihod: 5 minut</p>
			</div>
			<div className="arrival-item">
				<h3>18L</h3>
				<p>Naslednji prihod: 10 minut</p>
			</div>
			<div className="arrival-item">
				<h3>46</h3>
				<p>Naslednji prihod: 15 minut</p>
			</div>
			<div className="arrival-item">
				<h3>48P</h3>
				<p>Naslednji prihod: 20 minut</p>
			</div>
			<div className="arrival-item">
				<h3>69</h3>
				<p>Naslednji prihod: 36 minut</p>
			</div>
		</div>
	);
};

export default ArrivalsTab;
