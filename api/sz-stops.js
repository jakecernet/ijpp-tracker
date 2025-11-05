// Vercel Edge Function: Proxy SŽ stops with CORS and basic caching
export const config = {
    runtime: "edge",
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*", // Tighten for production if needed
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
        const upstream = "https://api.modra.ninja/sz/postaje";
        const resp = await fetch(upstream, {
            headers: {
                "User-Agent": "ijpp-tracker/edge-proxy",
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

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "content-type": "application/json; charset=utf-8",
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
