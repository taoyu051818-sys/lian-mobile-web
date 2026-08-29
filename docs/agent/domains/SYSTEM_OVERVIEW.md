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

Campus exploration rendered by the Vue 3 + vue-konva + Konva scene engine.

- Runtime: `MapView.vue` → `MapCanvas.vue` → `mapScene.ts`
- Data source: same-origin `/api/map/v2/items`; the renderer does not own business records
- Scene: background + areas + roads + routes + assets + linked place/post entities
- Interaction: pan, bounded zoom, marker selection, publish/errand picker long-press
- Editable assets: `MapCanvas` exposes `editable` and `object-change`; editing UI must live inside the authenticated Vue admin surface
- Retired: Leaflet runtime adapter and public standalone map editor/georeference pages

## Audience

Multi-school content visibility model.

- Fields: `visibility` (public/campus/school/linkOnly/private), `distribution` (home/search/detail/map)
- User fields: `institution`, `tags`, `status` (active/limited)
- Enforcement: read-side via `canViewPost`; write-side enforcement planned
