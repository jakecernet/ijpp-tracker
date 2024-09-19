"use client";

import { useState } from "react";
import { Map, Clock, MapPin, Settings } from "lucide-react";
import { FaBus, FaTrain} from "react-icons/fa";
import "./App.css";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function Component() {
	const [activeTab, setActiveTab] = useState("map");

	return (
		<div className="mobile-container">
			<div className="header">
				<div>
					<FaBus />
					<FaTrain />
				</div>
				<div>
					<span>IJPP Tracker</span>
				</div>
			</div>
			<div className="content">
				{activeTab === "map" && (
					<div className="tab-content">
						<h2>Live Bus Map</h2>
						<div className="map-container">
							<MapContainer
								center={[46, 16]}
								zoom={13}
								style={{ height: "100%", width: "100%" }}
								attributionControl={false}
								scrollWheelZoom={true}>
								<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
							</MapContainer>
						</div>
					</div>
				)}

				{activeTab === "arrivals" && (
					<div className="tab-content">
						<h2>Arrivals</h2>
						<input
							type="text"
							placeholder="Search for a bus route"
							className="search-input"
						/>
						<div className="arrival-item">
							<h3>Route 42</h3>
							<p>Next arrival: 5 minutes</p>
						</div>
						<div className="arrival-item">
							<h3>Route 15</h3>
							<p>Next arrival: 12 minutes</p>
						</div>
					</div>
				)}

				{activeTab === "stations" && (
					<div className="tab-content">
						<h2>Stations Near You</h2>
						<div className="station-item">
							<MapPin size={24} />
							<div>
								<h3>Central Station</h3>
								<p>0.3 miles away</p>
							</div>
						</div>
						<div className="station-item">
							<MapPin size={24} />
							<div>
								<h3>Market Street Stop</h3>
								<p>0.5 miles away</p>
							</div>
						</div>
					</div>
				)}

				{activeTab === "settings" && (
					<div className="tab-content">
						<h2>Settings</h2>
						<div className="setting-item">
							<label htmlFor="notifications">
								Enable Notifications
							</label>
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
				)}
			</div>
			<nav className="bottom-nav">
				<button
					onClick={() => setActiveTab("map")}
					className={activeTab === "map" ? "active" : ""}>
					<Map size={24} />
					<span>Map</span>
				</button>
				<button
					onClick={() => setActiveTab("arrivals")}
					className={activeTab === "arrivals" ? "active" : ""}>
					<Clock size={24} />
					<span>Arrivals</span>
				</button>
				<button
					onClick={() => setActiveTab("stations")}
					className={activeTab === "stations" ? "active" : ""}>
					<MapPin size={24} />
					<span>Near You</span>
				</button>
				<button
					onClick={() => setActiveTab("settings")}
					className={activeTab === "settings" ? "active" : ""}>
					<Settings size={24} />
					<span>Settings</span>
				</button>
			</nav>
		</div>
	);
}
