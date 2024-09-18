import React from "react";
import { BrowserRouter as Router, Route, Link, Routes } from "react-router-dom";
import { FaBus, FaTrain, FaSearch, FaBars } from "react-icons/fa";
import "./App.css";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function App() {
	const arrivals = [
		{
			id: 1,
			type: "Bus",
			route: "42",
			destination: "Downtown",
			arrivalTime: "5 min",
		},
		{
			id: 2,
			type: "Train",
			route: "Blue Line",
			destination: "Airport",
			arrivalTime: "12 min",
		},
		{
			id: 3,
			type: "Bus",
			route: "15",
			destination: "University",
			arrivalTime: "18 min",
		},
		{
			id: 4,
			type: "Train",
			route: "Red Line",
			destination: "Suburbs",
			arrivalTime: "25 min",
		},
	];

	return (
		<Router>
			<div className="app">
				<header>
					<div className="container">
						<div className="header-content">
							<Link to="/" className="logo">
								<FaBus />
								<FaTrain />
								<span>IJPP Tracker</span>
							</Link>
							<button
								className="mobile-menu-button"
								onClick={() => {
									if (
										document.getElementById("nav").style
											.height === "0px"
									) {
										document.getElementById(
											"nav"
										).style.height = "240px";
									} else {
										document.getElementById(
											"nav"
										).style.height = "0px";
									}
								}}>
								<FaBars />
							</button>
						</div>
						<nav id="nav" style={{ height: "0px" }}>
							<Link to="/">Home</Link>
							<Link to="/routes">Routes</Link>
							<Link to="/alerts">Alerts</Link>
							<Link to="/about">About</Link>
						</nav>
					</div>
				</header>
				<main>
					<div className="container">
						<div className="main-content">
							<div className="map-section">
								<h2>Zemljevid</h2>
								<div className="map-placeholder">
									<MapContainer
										center={[45.4211, -75.6903]}
										zoom={20}
										scrollWheelZoom={true}
										attributionControl={false}
										preferCanvas={false}
										style={{
											height: "100%",
											width: "85%",
											borderRadius: "10px",
											marginTop: "10px",
										}}>
										<TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
									</MapContainer>
								</div>
							</div>
							<div className="arrivals-section">
								<h2>Prihodi</h2>
								<div className="search-bar">
									<input
										type="text"
										placeholder="Search routes..."
									/>
									<button>
										<FaSearch />
										<span className="sr-only">Search</span>
									</button>
								</div>
								<table className="arrivals-table">
									<thead>
										<tr>
											<th>Type</th>
											<th>Route</th>
											<th>Destination</th>
											<th>Arrival</th>
										</tr>
									</thead>
									<tbody>
										{arrivals.map((arrival) => (
											<tr key={arrival.id}>
												<td>
													{arrival.type === "Bus" ? (
														<FaBus />
													) : (
														<FaTrain />
													)}
												</td>
												<td>{arrival.route}</td>
												<td>{arrival.destination}</td>
												<td>{arrival.arrivalTime}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</main>
				<footer>
					<div className="container">
						<div className="footer-content">
							<p>
								&copy; 2024 IJPP Tracker. All rights reserved.
							</p>
						</div>
					</div>
				</footer>
			</div>
		</Router>
	);
}

export default App;
