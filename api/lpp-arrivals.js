export const config = { runtime: "nodejs", regions: ["fra1"] };

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    "Access-Control-Expose-Headers": "cache-control, content-type",
};

const cache = new Map(); // key -> { data, ts }

function sendJson(res, body, status = 200, extraHeaders = {}) {
    const headers = {
        "content-type": "application/json; charset=utf-8",
        ...CORS_HEADERS,
        ...extraHeaders,
    };
    // Use Node's response methods compatible with Vercel runtime
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchUpstream(url, { attempts = 4, timeoutMs = 8000 } = {}) {
    let lastErr;
    for (let i = 1; i <= attempts; i++) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                signal: ctrl.signal,
                headers: {
                    Accept: "application/json",
                    "User-Agent": "ijpp-tracker/1.0",
                },
            });
            clearTimeout(t);

            if (res.ok) {
                // try parse json, but surface parse errors
                try {
                    return await res.json();
                } catch (parseErr) {
                    lastErr = new Error(
                        `Upstream ${res.status} (invalid JSON)`
                    );
                    lastErr.body = await res.text().catch(() => "");
                    throw lastErr;
                }
            }

            // read body for debugging (truncate to avoid huge logs)
            let body = "";
            try {
                body = await res.text();
                if (body.length > 2000)
                    body = body.slice(0, 2000) + "...(truncated)";
            } catch {}

            lastErr = new Error(
                `Upstream ${res.status}: ${body ? body.slice(0, 200) : ""}`
            );
            lastErr.status = res.status;
            lastErr.body = body;

            // Retry on 429 and 5xx
            if (
                res.status === 429 ||
                (res.status >= 500 && res.status <= 599)
            ) {
                await sleep(200 * i + Math.random() * 200);
                continue;
            }

            throw lastErr;
        } catch (e) {
            clearTimeout(t);
            lastErr = e;
            // Retry on network/abort errors
            if (
                e &&
                (e.name === "AbortError" ||
                    /ECONN|ETIMEDOUT|RESET|TIMEOUT/i.test(String(e?.message)))
            ) {
                await sleep(250 * i + Math.random() * 250);
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

export default async function handler(req, res) {
    try {
        if (req.method === "OPTIONS") {
            res.writeHead(204, CORS_HEADERS);
            res.end();
            return;
        }
        if (req.method !== "GET") {
            sendJson(res, { error: "Method not allowed" }, 405);
            return;
        }

        // parse query params from req.url (safe for plain Node/Vercel functions)
        const base = `http://${req.headers.host || "localhost"}`;
        const url = new URL(req.url || "/", base);
        const q = url.searchParams;

        const stationCode =
            q.get("station-code") || q.get("station_code") || q.get("code");

        if (!stationCode) {
            sendJson(
                res,
                { error: "Missing required query param: station-code" },
                400
            );
            return;
        }

        const key = `arr:${stationCode}`;
        const now = Date.now();
        const ttlMs = 15_000;

        const cached = cache.get(key);
        if (cached && now - cached.ts < ttlMs) {
            sendJson(res, cached.data, 200, {
                "Cache-Control":
                    "public, s-maxage=15, stale-while-revalidate=60",
            });
            return;
        }

        const upstream = new URL("https://data.lpp.si/api/station/arrival");
        upstream.searchParams.set("station-code", stationCode);

        try {
            const data = await fetchUpstream(upstream.toString(), {
                attempts: 3,
                timeoutMs: 6000,
            });
            cache.set(key, { data, ts: now });
            sendJson(res, data, 200, {
                "Cache-Control":
                    "public, s-maxage=15, stale-while-revalidate=60",
            });
        } catch (err) {
            if (cached) {
                sendJson(res, { ...cached.data, stale: true }, 200, {
                    "Cache-Control": "public, max-age=0, must-revalidate",
                });
                return;
            }
            console.error("upstream error:", err);
            sendJson(
                res,
                {
                    error: "Upstream error",
                    detail: String(err?.message || err),
                },
                502
            );
        }
    } catch (err) {
        // unexpected error — log and return 500
        console.error("handler error:", err);
        sendJson(
            res,
            {
                error: "Internal server error",
                detail: String(err?.message || err),
            },
            500
        );
    }
}
