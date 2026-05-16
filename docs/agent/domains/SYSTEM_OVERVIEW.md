# System Overview

Consolidated from domain docs on 2026-05-16. Original files: FEED_SYSTEM.md, MAP_SYSTEM.md, AUDIENCE_SYSTEM.md.

---

## Feed

NodeBB topics + LIAN metadata → mobile feed cards.

- Source: NodeBB topics/replies/users/tags + `data/post-metadata.json` + `data/feed-rules.json`
- Flow: normalize → metadata merge → eligibility → tab selection → curated slots → ranking → diversify → hydrate → response
- Scoring: `contentTypeWeights`, `missingLocationAreaPenalty`
- Debug: `/api/feed-debug`, `scripts/snapshot-feed.js`, `scripts/validate-post-metadata.js`

## Map

Campus exploration with Gaode tiles + LIAN overlays.

- Layers: areas, routes, roads, junctions, buildings, environmentElements, buildingGroups, assets
- Locations: `data/locations.json` (GCJ-02 coordinates)
- Admin editor: `/tools/map-v2-editor.html`
- Canonical bounds: south 18.3700734, west 109.9940365, north 18.4149043, east 110.0503482
- Bounds defined in 3 places: `map-v2-editor.js`, `map-v2-service.js`, `validate-locations.js` — must match

## Audience

Multi-school content visibility model.

- Fields: `visibility` (public/campus/school/linkOnly/private), `distribution` (home/search/detail/map)
- User fields: `institution`, `tags`, `status` (active/limited)
- Enforcement: read-side via `canViewPost`; write-side enforcement planned
