// Vercel Edge Function: Proxy LPP stops with CORS and basic caching
export const config = {
    runtime: "edge",
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", // Adjust to your domain if you need stricter CORS
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body, init = {}) {
    return new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json; charset=utf-8",
            ...CORS_HEADERS,
            ...(init.headers || {}),
        },
        status: init.status || 200,
    });
}

export default async function handler(req) {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    try {
        const url = new URL(req.url);
        const latitude = url.searchParams.get("latitude");
        const longitude = url.searchParams.get("longitude");
        const radius = url.searchParams.get("radius");

        if (!latitude || !longitude || !radius) {
            return jsonResponse(
                {
                    error: "Missing required query params: latitude, longitude, radius",
                },
                { status: 400 }
            );
        }

        const upstream = new URL(
            "https://data.lpp.si/api/station/stations-in-range"
        );
        upstream.searchParams.set("latitude", latitude);
        upstream.searchParams.set("longitude", longitude);
        upstream.searchParams.set("radius", radius);

        const resp = await fetch(upstream.toString(), {
            // Pass-through GET
            headers: {
                // Optional: identify your app; some APIs require User-Agent
                "User-Agent": "ijpp-tracker/edge-proxy",
                Accept: "application/json",
            },
            cache: "no-store", // Prevent Edge caching of the upstream request body
        });

        if (!resp.ok) {
            return jsonResponse(
                { error: "Upstream error", status: resp.status },
                { status: 502 }
            );
        }

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "content-type": "application/json; charset=utf-8",
                // Cache at the CDN for a bit; stops don't change often
                "cache-control":
                    "public, s-maxage=1800, stale-while-revalidate=300",
                ...CORS_HEADERS,
            },
        });
    } catch (err) {
        return jsonResponse(
            { error: "Proxy error", message: String(err) },
            { status: 500 }
        );
    }
}
