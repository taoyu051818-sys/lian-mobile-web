# Map v2 Gaode Handoff

## Scope

Implemented the first Map v2 skeleton with Gaode as the base map and LIAN-owned overlay data.

## Changed Files

- `public/index.html`
- `public/map-v2.js`
- `public/app.js`
- `public/styles.css`
- `src/server/map-v2-service.js`
- `src/server/api-router.js`
- `src/server/admin-routes.js`
- `src/server/paths.js`
- `src/server/post-service.js`
- `src/server/ai-light-publish.js`
- `src/server/ai-post-preview.js`
- `data/locations.json`
- `data/map-v2-layers.json`
- `docs/agent/MAP_V2_TECH_PLAN.md`
- `docs/agent/domains/MAP_SYSTEM.md`

## New APIs

- `GET /api/map/v2/items`
  - Returns `locations`, `layers.areas`, `layers.routes`, and coordinate-backed post cards.
- `GET /api/admin/map-v2`
  - Returns editable Map v2 JSON data.
- `PUT /api/admin/map-v2`
  - Saves normalized `locations.json` and `map-v2-layers.json`.
  - Requires the existing admin auth path.

## Data Files

- `data/locations.json`
  - Canonical Map v2 location objects with `id`, `name`, `type`, `lat`, `lng`, `coordSystem`, and optional `legacyPoint`.
- `data/map-v2-layers.json`
  - Map center, zoom, polygon areas, and route polylines.

## Frontend Behavior

- The map tab initializes `window.MapV2`.
- Gaode tiles render as the base map.
- LIAN overlays render:
  - area polygons;
  - route polylines;
  - location icons;
  - post floating cards when post metadata has coordinates or a matched `locationId`.
- Publishing location picking uses Map v2 and writes:
  - `locationDraft.source = "map_v2"`;
  - `lat` / `lng`;
  - `mapVersion = "gaode_v2"`.

## Admin Editing

The first editor is intentionally lightweight:

- open the map tab;
- click the layer editor button;
- edit locations JSON or layer JSON;
- save with admin token.

Future editor work should replace raw JSON editing with drawing tools for:

- polygon add/edit/delete;
- route polyline add/edit/delete;
- location icon placement;
- style controls.

## Publishing Integration

Regular `/api/posts` and AI `/api/ai/post-publish` both preserve Map v2 coordinates in post metadata after NodeBB publish succeeds.

AI publish still uses the current user's NodeBB UID through the existing publishing path.

## Validation

Commands run:

```bash
"C:\Program Files\nodejs\node.exe" --check server.js
"C:\Program Files\nodejs\node.exe" --check public/app.js
"C:\Program Files\nodejs\node.exe" --check public/map-v2.js
"C:\Program Files\nodejs\node.exe" --check src/server/map-v2-service.js
"C:\Program Files\nodejs\node.exe" --check src/server/post-service.js
"C:\Program Files\nodejs\node.exe" --check src/server/ai-light-publish.js
"C:\Program Files\nodejs\node.exe" scripts/validate-post-metadata.js
```

Smoke tested:

- `GET /api/map/v2/items`
- static serving of `/map-v2.js`
- home HTML includes Map v2 and Leaflet assets.

## Known Gaps

- The admin editor is JSON-based, not a drawing UI yet.
- Current location data is seeded with initial approximate GCJ-02 coordinates and should be field-checked.
- Existing old posts without `lat/lng` or `locationId` will not render as exact Map v2 pins.
- Browser visual QA still needs a desktop/mobile pass after the dev server is opened in a browser.

## Rollback

Rollback is straightforward:

- remove `public/map-v2.js`;
- remove Map v2 shell and Leaflet script/style references from `public/index.html`;
- switch `switchView("map")` back to `initMap()`;
- remove `/api/map/v2/items` and `/api/admin/map-v2` route wiring;
- keep `data/locations.json` and `data/map-v2-layers.json` if future work will resume.
