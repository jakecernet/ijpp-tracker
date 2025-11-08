const fetch = require("node-fetch");
const IJPP_URL = "https://data.lpp.si/api/route/arrivals-on-route?trip-id=";

module.exports = async (req, res) => {
    // Allow CORS from any origin for development; adjust for production as needed
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        // Vercel will respond to preflight with these headers
        return res.status(204).end();
    }

    try {
        const upstream = await fetch(IJPP_URL);
        if (!upstream.ok) {
            return res
                .status(upstream.status)
                .json({ error: `Upstream error: ${upstream.status}` });
        }
        const json = await upstream.json();
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json(json);
    } catch (err) {
        console.error("Proxy error:", err);
        return res.status(500).json({ error: String(err) });
    }
};
