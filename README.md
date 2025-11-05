# IJPP Tracker

Built project: https://github.com/jakecernet/ijpp-tracker/tree/gh-pages

## Backend proxy for CORS (optional)

If the public data sources block the browser with CORS, you can deploy tiny serverless proxy endpoints. This repo includes two Vercel-ready endpoints under `api/`:

-   `api/lpp-stops.js` — proxies LPP stations-in-range
-   `api/sz-stops.js` — proxies SŽ train stops

They add permissive CORS headers and CDN caching. You can tighten `Access-Control-Allow-Origin` to your domain in production.

### Deploy to Vercel

1. Create a Vercel project and import this repository.
2. Use the default settings (Framework: Other / Vite static build). No special env vars are required.
3. Deploy. Your functions will be available at:

-   `https://<your-project>.vercel.app/api/lpp-stops?latitude=46.05&longitude=14.5&radius=300000`
-   `https://<your-project>.vercel.app/api/sz-stops`

### Run locally with Vercel CLI

Install deps and Vercel CLI, then run the dev server to test `api/` endpoints locally alongside Vite. Use a different port than Vite (this repo uses 3000 for Vite):

```cmd
npm install
npm i -g vercel
vercel dev --listen 4000
```

This starts a local server exposing `/api/*` on port 4000. If you also want the Vite frontend, run in a separate terminal:

```cmd
npm run dev
```

### Use the proxy in the frontend

Replace direct fetches in `src/App.jsx` with the `/api/*` URLs, for example:

-   LPP stops

    -   From: `https://data.lpp.si/api/station/stations-in-range?...`
    -   To: `/api/lpp-stops?latitude=46.043904&longitude=14.503119&radius=300000`

-   SŽ stops
    -   From: `https://api.modra.ninja/sz/postaje`
    -   To: `/api/sz-stops`

Because the site is static, using relative `/api/*` paths lets it work both locally and on Vercel.

Notes:

-   The proxies are GET/OPTIONS only and return JSON.
-   Basic CDN caching headers are set; tweak `cache-control` if you need fresher data.
-   If upstream rate limits are a concern, consider adding server-side caching keyed by params or moving to a scheduled build-time cache.

### Troubleshooting 404 locally

-   If you see `404: NOT_FOUND ... ID: dev1::...`, you’re likely opening the Vercel dev server directly without a frontend. Use the steps above: run `vercel dev -p 4000`, then open `http://localhost:3000` for the Vite UI. The UI calls `/api/*`, which Vite proxies to `http://localhost:4000`.
-   If you see `404: NOT_FOUND ... ID: dev1::...`, you’re likely opening the Vercel dev server directly without a frontend. Use the steps above: run `vercel dev --listen 4000`, then open `http://localhost:3000` for the Vite UI. The UI calls `/api/*`, which Vite proxies to `http://localhost:4000`.
-   Ensure `vite.config.js` contains a `server.proxy` entry for `/api` pointing to `http://localhost:4000`.
