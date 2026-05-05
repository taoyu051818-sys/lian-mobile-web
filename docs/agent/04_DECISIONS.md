# Architecture And Product Decisions

This numbered file is the current decision log for future Codex threads. Older root docs under `docs/agent/` are historical context and should not override this file unless a newer dated decision is added.

## Active Supersessions

- `2026-05-03: Map Development Requires Human Assistance` blocks independent Claude Code implementation for Map v2 data/editor/render/floor-plan work.
- `2026-05-03: Pro Engineering Decision - Stabilize Before Expanding` is the current route for task priority and repo split pacing.
- `2026-05-03: Map V2 Editor Phases 1A-1C And Phase 2 Complete` supersedes earlier map editor planning.
- `2026-05-02: Map V2 Is Implemented As An MVP` supersedes `2026-05-01: Map V2 Is Design-Only For Now`.
- `2026-05-02: Frontend App Split Is The New Baseline` supersedes old references to `public/app.js` as one 2,151-line frontend file.
- `2026-05-02: NodeBB Integration Boundary Is Formalized` is the current NodeBB architecture reference.
- `2026-05-02: API Contract Is Frozen For Repo Split` supersedes any assumptions about shared in-repo API knowledge.

## 2026-05-03: Pro Engineering Decision - Stabilize Before Expanding

Reference: `docs/agent/references/PRO_ENGINEERING_DECISION_2026-05-03.md`

The next engineering phase is stabilization, not feature expansion.

Priority order:

1. Fix `scripts/smoke-frontend.js` so reviewer validation is reproducible.
2. Rerun Lane F messages/notifications and update acceptance status.
3. Run Publish V2 browser/manual acceptance.
4. Run NodeBB detail/profile browser/manual acceptance.
5. Clean docs/agent baseline and file ownership.
6. Audit Audience write-side minimum enforcement.
7. Prepare backend repo bootstrap.

Do not continue expanding recommendation strategy, LLM automation, place pages, food maps, task-market concepts, complex Map v2 editor work, broad UI redesign, NodeBB rewrites, framework migration, full PostgreSQL migration, or full organization permission platform work in this phase.

Repo split direction is accepted, but destructive split is not approved yet. Bootstrap the backend repo first, keep the current repo runnable, validate backend staging, and only then remove backend ownership from `lian-mobile-web`.

## 2026-05-03: Map Development Requires Human Assistance

Map development is now human-assisted only.

Claude Code threads must not independently implement:

- Map v2 editor;
- Map v2 data assets;
- road network, junction, curve, route, asset-placement, or building hierarchy work;
- Map v2 render workflow;
- building/floor-plan view;
- location data redraw after data loss;
- tasks touching `data/map-v2-layers.json`, `data/locations.json`, `public/map-v2.js`, `public/tools/map-v2-editor.*`, or `src/server/map-v2-service.js`.

Claude Code may still document, audit, rerun validation, write review findings, and scope map work.

Before runtime or data implementation:

1. A human must provide concrete map/design input or approve the exact implementation cut.
2. The task doc must record the approved scope.
3. Intermediate editor/map output must be shown to a human before acceptance.
4. Claude Code must not invent campus geometry, road layout, building hierarchy, or asset placement independently.

Reason: Map v2 is a spatial product/design line with real campus geography, visual assets, and previous data-loss risk. It needs human map/design judgment, not autonomous implementation.

## 2026-05-03: Map V2 Bounds Must Be Single Source Of Truth

`MAP_V2_BOUNDS` was inconsistent between `map-v2-editor.js` (wider: 18.370/109.994->18.415/110.050) and `map-v2-service.js` + `validate-locations.js` (tighter: 18.373/109.995->18.414/110.036). This caused data loss - `map-v2-layers.json` was emptied with no git backup.

Fix: all three files now use the wider bounds. Future rule: **bounds must be defined in one place and imported by others**. If bounds change, all three files must be updated together.

Canonical bounds updated by human instruction on 2026-05-03 for the latest base map:

- southwest: 18.37107 / 109.98464
- northeast: 18.41730 / 110.04775

All runtime bounds constants must use south 18.37107, west 109.98464, north 18.41730, east 110.04775.

## 2026-05-03: Map V2 Editor Phases 1A-1C And Phase 2 Complete

The admin map editor at `/tools/map-v2-editor.html` now has:

- **Phase 1A**: game-engine-style road drawing (click-drag), 4 road types, point simplification, property panel
- **Phase 1B**: automatic junction detection (endpoint snap, segment snap, crossing), road splitting, junction rendering and management
- **Phase 1C**: Chaikin curve smoothing preview, bend angle classification, shuttle route `routeRef`, curve hint export
- **Phase 2**: asset placement mode with image upload (Cloudinary), click-to-place, drag-to-reposition, full property panel, `assets[]` data model

Data model additions to `data/map-v2-layers.json`: `roads[]`, `junctions[]`, `assets[]`. Server normalization in `map-v2-service.js` handles all three.

Remaining editor work: Phase 3 (building group hierarchy). This should not block Publish V2, feed work, or audience enforcement.

Handoffs: `docs/agent/handoffs/road-draw-mvp.md`, `docs/agent/handoffs/road-junctions-phase1b.md`, `docs/agent/handoffs/curves-route-semantics-phase1c.md`, `docs/agent/handoffs/asset-placement-phase2.md`

## 2026-05-02: API Contract Is Frozen For Repo Split

Phase 0 of the P0 repo split produced a frozen API contract at `docs/agent/contracts/api-contract.md`.

48 endpoints inventoried: 29 frontend-required, 11 admin-only, 2 backend-only, 6 deprecated (no frontend caller). Frontend uses 32 call sites across 13 files. All calls use `api()` helper or direct `fetch()`.

The contract is the source of truth for the API surface between frontend and backend repos. Any endpoint shape change must update the contract first.

## 2026-05-01: NodeBB Remains The Content Backend

NodeBB continues as the content backend and system of record for topics, posts, replies, users, tags, categories, permissions, and moderation primitives.

LIAN should not rebuild forum/content infrastructure. LIAN remains the campus experience layer.

## 2026-05-01: LIAN Owns Campus Experience Layer

LIAN is responsible for recommendation, map experience, local metadata, and AI-assisted lightweight posting.

These are product-specific layers that NodeBB does not provide in a student-campus-native way.

## 2026-05-01: AI Suggestions Are Draft-Only

AI may generate titles, body drafts, tags, location suggestions, content type guesses, and risk/privacy hints, but it must only produce drafts or suggestions.

The AI post preview endpoint must not publish, must not call NodeBB post creation, and must not write `data/post-metadata.json`.

## 2026-05-01: AI Post Preview Backend Is Completed

`POST /api/ai/post-preview` has been implemented and tested in both mock and MiMo modes. The endpoint includes MiMo adapter logic, prompt construction, JSON parsing, normalization, and `imageBase64` length limits.

The endpoint can accept Cloudinary/public image URLs and returns normalized preview output with `mode=mimo` when MiMo succeeds.

Real `MIMO_API_KEY` values are allowed only in `.env` or server environment variables. They must never be committed.

## 2026-05-01: `locationId` Is The Formal Place Key

`locationId` is the formal stable key for known places. It should connect feed, map, metadata, search, future place pages, and analytics without depending on display text.

## 2026-05-01: `locationArea` Is Legacy Compatibility Text

`locationArea` is compatibility/display text for old or fuzzy data. It is not the formal place key.

Existing data may only have area strings, but new structured workflows should move toward `locationId` plus optional precision fields.

## 2026-05-01: Leaflet Handles Precise Maps

Leaflet is the preferred precise web map layer for calibration, location picking, and coordinate verification.

It should not be added for Map v2 until the design-only technical plan is accepted.

## 2026-05-01: Illustrated Map Handles Visual Exploration

The illustrated campus map remains the default exploration surface.

Students can understand landmarks, memories, routes, and campus vibes faster through a simplified visual map than through a generic GIS-like interface.

## 2026-05-01: Feed Optimization Is Completed

`feedEditions` is no longer an all-page lock for recommendation pages. Recommendation page 1 now combines a small curated entry area with ranked rest:

- `curatedSlotsPerPage: 3`
- `rankedRestOnCuratedPages: true`

Scoring now includes `contentTypeWeights` and `missingLocationAreaPenalty`. Moment scoring now includes `momentContentTypeWeights` and `momentMissingLocationAreaPenalty`.

## 2026-05-01: `feedEditions` Stays But Must Not Lock The Homepage

`feedEditions` remains available for operator control, but it must not permanently lock the entire homepage into curated batches.

Manual curation is useful for launch and operations, but feed quality also needs ranked, observable, local content.

## 2026-05-01: Map V2 Is Design-Only For Now

Map v2 should not be directly implemented yet. First produce and review `MAP_V2_TECH_PLAN.md`.

Until that plan is approved, do not change `public/app.js`, do not add Leaflet, and do not change locations API behavior.

## 2026-05-01: Task Market, Errands, And Drones Are Deferred

Task market, errand/runner workflows, and drone workflows are paused.

The current priority is feed observability, metadata quality, AI draft preview, publishing basics, and map foundations.

## 2026-05-01: AI Light Publish Flow Is Active

The AI light publish flow is roughly complete on both frontend and backend.

- `POST /api/ai/post-preview` generates editable drafts (mock or MiMo).
- `POST /api/ai/post-drafts` silently saves drafts to `data/ai-post-drafts.jsonl`.
- `POST /api/ai/post-publish` publishes after explicit user confirmation.
- Both `/api/posts` and `/api/ai/post-publish` use `createNodebbTopicFromPayload()`.
- AI posts are published as the logged-in user's NodeBB account, not as `NODEBB_UID`.
- Currently single image only. Flow has rough edges.

## 2026-05-01: Location Model Is A Sketch

The location model is currently a sketch. `locationId` remains empty in most data. Plan to introduce AMap (高德地图) for precise map workflows. Do not create `data/locations.json` or `scripts/validate-locations.js` until the location model is formally designed.

## 2026-05-02: Map V2 Is Implemented As An MVP

The older "Map V2 Is Design-Only For Now" decision is superseded by later Map v2 implementation work.

Map v2 now exists as a Gaode-tile-based campus map with LIAN overlays, location drafts, and a standalone internal editor. Follow-up Map v2 work should focus on data quality, asset integration, validation, and editor ergonomics.

Map v2 work must not change feed ranking, NodeBB publishing, or AI publish semantics unless a new task explicitly authorizes that boundary crossing.

## 2026-05-02: Frontend App Split Is The New Baseline

`public/app.js` has been mechanically split into feature-scoped classic scripts:

- `public/app-state.js`
- `public/app-utils.js`
- `public/app-auth-avatar.js`
- `public/app-feed.js`
- `public/app-legacy-map.js`
- `public/app-ai-publish.js`
- `public/app-messages-profile.js`
- `public/app.js`

This is a conflict-reduction split, not a product behavior change. Future frontend work should modify the narrowest split file instead of adding new logic back into `public/app.js`.

Do not convert to ES modules, bundlers, TypeScript, or a framework in the same thread as product work.

## 2026-05-02: Architect Workstreams Are The Coordination Layer

`docs/agent/ARCHITECTURE_WORKPLAN.md` is the current entry point for assigning next work.

Implementation threads should take one task at a time:

- `map-v2-data-assets`
- `frontend-stability-smoke`
- `ai-publish-polish`
- `feed-ops-snapshot-diff`

Do not combine feed scoring, publishing, map editor/data, auth, and frontend shell loading in one PR.

## 2026-05-02: NodeBB Integration Boundary Is Formalized

NodeBB is the durable content/community backend for topics, replies, users, tags, categories, notifications, and future moderation primitives.

LIAN remains responsible for campus product state: feed ranking, Map v2 data, AI drafts/records, post metadata, audience rules, and school/org membership.

The current integration details live in `docs/agent/domains/NODEBB_INTEGRATION.md`.

Future multi-school and organization visibility must use a LIAN-owned audience model first. NodeBB groups/categories may mirror LIAN permissions for hard boundaries, but NodeBB should not become the only source of truth for LIAN-specific audience state.

## 2026-05-02: Publish V2 Uses A Dedicated Page

The user-facing flow is named **发布 / Publish**, not "AI light publish".

Publish V2 should move out of modal-style UI into a dedicated page.

The V2 flow starts with multi-image selection, applies simple frontend compression, uploads all confirmed images, immediately moves to Map v2 location picking, then generates one editable AI draft from all image URLs and context.

AI may suggest a visibility/audience option, but the user must make the final confirmation before publishing.

Legacy map/location picking is in retirement. New publish location work should target Map v2.

## 2026-05-02: Map V2 Becomes A Spatial Asset System

Map v2 should evolve from a map display into an editable campus spatial asset system.

The natural base layer already covers broad environmental context such as ocean, beach, grass, and terrain-like areas. Next work should add editable roads, routes, environment elements, buildings, building groups, entrances, clickable icons, and post/card overlays.

Detailed visual rendering may be done by external AI/design tools. LIAN should own the structured map data, render specs, render job records, preview/approval workflow, and published map versions. Rendered images must not replace editable structured layers as the source of truth.

Campus overview can link into a higher-precision 2D building/floor/room view. Clicking building icons or building polygons should open a planar view where users can inspect floors, room functions, and related posts.

Do not implement 3D, live indoor positioning, or automatic room recognition in the first version.

## 2026-05-02: NodeBB Native Features Require Product Cuts

NodeBB has native capabilities that LIAN has not fully connected yet, including likes/upvotes, bookmarks/favorites, read state/history, reports/flags, edit/delete/hide, groups, and category privileges.

These should not be connected all at once. Each capability needs a narrow product cut, endpoint verification against the installed NodeBB version, failure-mode notes, and audience/privacy checks where relevant.

Good first candidates are report/flag, save/favorite, like/useful, and read-state browsing history. Feed ranking must not change in the same PR as the first like/useful integration.
