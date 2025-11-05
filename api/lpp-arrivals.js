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
    res.status(status)
        .set({
            "content-type": "application/json; charset=utf-8",
            ...CORS_HEADERS,
            ...extraHeaders,
        })
        .send(JSON.stringify(body));
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function fetchUpstream(url, { attempts = 3, timeoutMs = 6000 } = {}) {
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
            if (res.ok) return await res.json();

            lastErr = new Error(`Upstream ${res.status}`);
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
            if (
                e.name === "AbortError" ||
                /ECONN|ETIMEDOUT|RESET|TIMEOUT/i.test(String(e?.message))
            ) {
                await sleep(200 * i + Math.random() * 200);
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

export default async function handler(req, res) {
    if (req.method === "OPTIONS") {
        res.status(204).set(CORS_HEADERS).end();
        return;
    }
    if (req.method !== "GET") {
        sendJson(res, { error: "Method not allowed" }, 405);
        return;
    }

    const stationCode =
        req.query["station-code"] ||
        req.query["station_code"] ||
        req.query["code"];

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
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
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
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
        });
    } catch (err) {
        if (cached) {
            sendJson(res, { ...cached.data, stale: true }, 200, {
                "Cache-Control": "public, max-age=0, must-revalidate",
            });
            return;
        }
        sendJson(
            res,
            { error: "Upstream error", detail: String(err?.message || err) },
            502
        );
    }
}
