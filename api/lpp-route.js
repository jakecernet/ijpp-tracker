const IJPP_URL = "https://data.lpp.si/api/route/arrivals-on-route?trip-id=";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }

    if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const requestUrl = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
    );
    const tripId =
        requestUrl.searchParams.get("tripId") ||
        requestUrl.searchParams.get("trip-id");

    if (!tripId) {
        res.status(400).json({ error: "Missing tripId query parameter" });
        return;
    }

    try {
        const upstream = await fetch(
            `${IJPP_URL}${encodeURIComponent(tripId)}`
        );
        if (!upstream.ok) {
            res.status(upstream.status).json({
                error: `Upstream error: ${upstream.status}`,
            });
            return;
        }

        const json = await upstream.json();
        res.setHeader("Content-Type", "application/json");
        res.status(200).json(json);
    } catch (err) {
        console.error("Proxy error:", err);
        res.status(500).json({ error: String(err) });
    }
}
