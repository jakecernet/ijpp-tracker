import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const icons =[
	{
		src: "/icons/192x192.png",
		sizes: "192x192",
		type: "image/png",
		purpose: "any maskable",
	},
	{
		src: "/icons/512x512.png",
		sizes: "512x512",
		type: "image/png",
		purpose: "any maskable",
	},
]

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			manifest: {
				name: "IJPP Tracker",
				short_name: "IJPP Tracker",
				theme_color: "#000000",
				icons: icons,
			},
		}),
	],
	server: {
		port: 3000,
		open: true,
		proxy: {
			"/api": "http://localhost:4000",
		},
	},
	base: "./",
	build: {
		outDir: "build",
		emptyOutDir: true,
	},
});
