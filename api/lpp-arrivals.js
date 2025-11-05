// Vercel Edge Function: Proxy LPP arrivals with CORS and lightweight caching
export const config = {
    runtime: "edge",
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", // Adjust for production if desired
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    "Access-Control-Expose-Headers": "cache-control, content-type",
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
        const stationCode =
            url.searchParams.get("station-code") ||
            url.searchParams.get("station_code") ||
            url.searchParams.get("code");

        if (!stationCode) {
            return jsonResponse(
                { error: "Missing required query param: station-code" },
                { status: 400 }
            );
        }

        // Build the upstream URL exactly as required
        const upstream = new URL("https://data.lpp.si/api/station/arrival");
        upstream.searchParams.set("station-code", stationCode);

        const resp = await fetch(upstream.toString(), {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if (!resp.ok) {
            return jsonResponse(
                { error: "Upstream error", status: resp.status },
                { status: 502 }
            );
        }

        // Stream upstream response directly to avoid parsing/serialization issues
        const contentType =
            resp.headers.get("content-type") ||
            "application/json; charset=utf-8";

        return new Response(resp.body, {
            status: 200,
            headers: {
                "content-type": contentType,
                "cache-control":
                    "public, s-maxage=15, stale-while-revalidate=15",
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
