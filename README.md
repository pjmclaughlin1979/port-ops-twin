# Port of Cork · Operations Twin

React 19 + Vite app on the ArcGIS Maps SDK for JavaScript 5.1 (map components + Calcite),
built on the Cork Harbour WebScene (`ef2c4525126a4a26a5310b8ff90f8aba`).

## Setup

```bash
npm install
npm run dev     # http://localhost:5173 (fixed — see below)
npm run build
```

`.env.local` (gitignored) needs:

- `VITE_ARCGIS_OAUTH_CLIENT_ID` — ArcGIS Online OAuth app (browser/PKCE). The WebScene is not
  public, so sign-in is required. Every URL the app is served from must be registered as a
  redirect URI on that app; `http://localhost:5173/` is, which is why the dev port is fixed.
- `VITE_GOOGLE_MAPS_API_KEY` — for the Google Photorealistic 3D Tiles in the scene's basemap.

## Tools

**Operations** — Live traffic (AIS counts, type breakdown, speed / silent-AIS alerts, search) ·
Arrivals & departures (schedule, pilot-station demand) · Berth planner (per-berth occupancy
timeline derived from the schedule, flags shared berth windows) · Marine conditions (gusts,
visibility, waves vs. configurable limits, 24 h gust outlook, tide curve, live weather mirrored
into the scene) · Safety zone (exclusion radius around a point or a moving vessel, vessels inside).

**Analysis** (ArcGIS components) — distance/area measurement, stockpile volume (preview), line of
sight, daylight + shadow cast, weather simulation, slice, elevation profile, markup (sketch).

**Map** — layer list, legend, basemap gallery, saved views (WebScene slides), vessel attribute table.

Operating thresholds in `src/config.js` are placeholders, editable in the Marine conditions panel.
