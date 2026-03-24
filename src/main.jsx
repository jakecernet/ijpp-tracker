import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Capacitor } from "@capacitor/core";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

// Log platform info for debugging
if (Capacitor.isNativePlatform()) {
	console.log("Running on native platform:", Capacitor.getPlatform());
} else {
	console.log("Running on web platform");
}
