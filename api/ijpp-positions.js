const IJPP_URL = "https://ijpp.nikigre.si/getData";

const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
]);

export default async function handler(req, res) {
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
            globalThis.fetch ?? (await import("node-fetch")).default;

        // Forward some client headers to upstream (avoid copying everything blindly)
        const upstreamHeaders = {
            Accept:
                req.headers["accept"] ||
                "application/json, text/*;q=0.9, */*;q=0.1",
            "User-Agent": req.headers["user-agent"] || "ijpp-tracker-proxy/1.0",
        };

        const upstream = await runtimeFetch(IJPP_URL, {
            method: "GET",
            headers: upstreamHeaders,
        });

        // Copy upstream headers to the response (skip hop-by-hop headers)
        upstream.headers.forEach((value, key) => {
            if (!HOP_BY_HOP.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // Ensure our CORS header stays set
        res.setHeader("Access-Control-Allow-Origin", "*");

        // Read raw body and forward it unchanged
        const ab = await upstream.arrayBuffer();
        const buffer = Buffer.from(ab);

        // Return status from upstream so client can inspect it
        res.status(upstream.status).end(buffer);
    } catch (err) {
        console.error("Proxy error:", err?.stack || err);
        return res
            .status(500)
            .json({ error: "Internal server error in ijpp-positions proxy" });
    }
}
