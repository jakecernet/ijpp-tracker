const IJPP_URL = "https://ijpp.nikigre.si/getData";

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
        const runtimeFetch =
            globalThis.fetch || (await import("node-fetch")).default;
        const upstream = await runtimeFetch(IJPP_URL);
        if (!upstream.ok) {
            return res
                .status(upstream.status)
                .json({ error: `Upstream error: ${upstream.status}` });
        }
        // Defensive parsing: try JSON, fallback to text if not JSON
        const contentType = upstream.headers.get?.("content-type") || "";
        let body;
        if (contentType.includes("application/json")) {
            body = await upstream.json();
        } else {
            body = await upstream.text();
        }
        res.setHeader("Content-Type", "application/json");
        return res.status(200).json({ data: body });
    } catch (err) {
        console.error("Proxy error:", err?.stack || err);
        return res
            .status(500)
            .json({ error: "Internal server error in ijpp-positions proxy" });
    }
};
