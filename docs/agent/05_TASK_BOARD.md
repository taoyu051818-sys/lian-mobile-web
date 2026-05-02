# Agent Task Board

This is the current task board. Each task has a goal, affected files, risk level, and acceptance criteria.

Baseline reference: `docs/agent/01_PROJECT_FACT_BASELINE.md`

---

## Done

### NodeBB-Backed Mobile Web Feed

Feed reads from NodeBB, normalizes topics, serves via `GET /api/feed`. Tabs include 推荐, 此刻, and category tabs.

### Feed Optimization

Hybrid curated/ranked recommendation page completed.

- `curatedSlotsPerPage: 3`, `rankedRestOnCuratedPages: true`
- Scoring includes `contentTypeWeights`, `missingLocationAreaPenalty`, vibe/scene weights
- Moment feed has independent scoring with `momentContentTypeWeights`
- Diversity limits: `maxSameContentType: 2`, `maxSameLocationArea: 2`
- Metadata filled for tids 91-100

Changed files: `src/server/feed-service.js`, `data/feed-rules.json`, `data/post-metadata.json`

Snapshots: `outputs/feed-snapshot-20260501-161614.md`, `outputs/feed-snapshot-20260501-162140.md`

### AI Light Publish Flow

Frontend and backend roughly complete. Currently single image only.

Backend APIs:

- `POST /api/ai/post-preview` — draft generation (mock/mimo)
- `POST /api/ai/post-drafts` — silent draft save to JSONL
- `POST /api/ai/post-publish` — user-confirmed publish to NodeBB

Frontend flow:

1. User taps `+` → simplified AI upload entry
2. Image upload → `/api/upload/image` → `/api/ai/post-preview`
3. User edits draft fields (title, body, tags, location)
4. Silent draft save to `/api/ai/post-drafts`
5. User clicks "发布到 LIAN" → `/api/ai/post-publish`
6. Publish creates NodeBB topic, writes `post-metadata.json`, appends `ai-post-records.jsonl`

Both `/api/posts` and `/api/ai/post-publish` use `createNodebbTopicFromPayload()`. AI posts use the logged-in user's NodeBB account.

### Feed Observability

- `GET /api/feed-debug` exists, protected by `ADMIN_TOKEN`
- `scripts/snapshot-feed.js` generates feed snapshots
- `scripts/validate-post-metadata.js` validates metadata structure

### Map v2 Editor + Grass Base Layer

Standalone internal editor tool page at `/tools/map-v2-editor.html`. Campus grass texture as map base layer with Gaode tiles at 35% opacity. Editor has layer visibility toggles and opacity sliders for all layer groups (grass, tiles, bounds, areas, routes, locations, draft).

Backend: `PUT /api/admin/map-v2` with full bounds validation (SW 18.373050/109.995380, NE 18.413856/110.036262). Location icon (url/size/anchor) and card (title/subtitle/imageUrl/alwaysShow) support in `map-v2-service.js`.

Also fixed Chinese encoding corruption in index.html (commit 3340f65 double-encoded UTF-8).

Changed files: `public/tools/map-v2-editor.*`, `public/assets/campus-grass.png`, `public/map-v2.js`, `public/styles.css`, `public/index.html`

Handoff: `docs/agent/handoffs/map-v2-editor.md`

---

## Ready

### Task: AI Publish Multi-Image Support

Goal: allow AI publish flow to handle multiple images instead of only the first one.

Affected files:

- `src/server/ai-light-publish.js` — `normalizeAiPostPayload` currently only passes first image to `createNodebbTopicFromPayload`
- `src/server/ai-post-preview.js` — may need to accept multiple image inputs

Risk: low. `post-service.js:51-57` already iterates `imageUrls` array. The plumbing exists; AI flow just needs to pass all images through.

Acceptance:

- Upload 2+ images via AI flow, verify all appear in the published NodeBB topic
- `node --check src/server/ai-light-publish.js`
- `node --check src/server/ai-post-preview.js`

### Task: Create `validate-locations.js` Placeholder

Goal: create a placeholder script referenced in task board but not yet existing. Location model is a sketch; script should validate whatever shape exists.

Affected files:

- `scripts/validate-locations.js` (new)

Risk: low. New file, no impact on existing code.

Acceptance:

- `node --check scripts/validate-locations.js`
- `node scripts/validate-locations.js` runs without error
- Script is read-only, does not modify data

### Task: JSONL Archive/Cleanup Tool

Goal: create a script to archive or clean up `data/ai-post-drafts.jsonl` and `data/ai-post-records.jsonl`.

Affected files:

- `scripts/archive-ai-records.js` (new, or similar name)

Risk: low. New file, append-only data.

Acceptance:

- `node --check scripts/archive-ai-records.js`
- Script can list, count, and optionally archive records
- Does not corrupt existing JSONL on partial failure

### Task: Feed Snapshot Diff

Goal: add diff capability to `scripts/snapshot-feed.js` so two snapshots can be compared programmatically.

Affected files:

- `scripts/snapshot-feed.js`

Risk: low. Existing script, additive change.

Acceptance:

- `node --check scripts/snapshot-feed.js`
- `node scripts/snapshot-feed.js --diff outputs/snapshot-a.md outputs/snapshot-b.md` produces readable diff

### Task: Static Data Expansion

Goal: add entries to `mapItems` or `authInstitutions` in `static-data.js`.

Affected files:

- `src/server/static-data.js`

Risk: low. Pure data, no logic changes.

Acceptance:

- `node --check src/server/static-data.js`
- `GET /api/map/items` returns new items
- New institutions appear in auth rules

### Task: Polish AI Light Publish Flow

Goal: fix rough edges in the AI publish flow. Specific issues need per-item confirmation before fixing.

Affected files: to be determined per issue.

Risk: low to medium. Depends on the specific fix.

Acceptance: per-issue verification. General:

- `node --check src/server/ai-light-publish.js`
- `node --check src/server/ai-post-preview.js`
- End-to-end: upload → preview → edit → save draft → publish succeeds

---

## Blocked

### Map V2 Implementation

Goal: replace legacy static map with interactive map using AMap (高德地图).

Blocked by: `MAP_V2_TECH_PLAN.md` must be produced and reviewed first.

Current constraints (until plan is approved):

- Do not modify `public/app.js`
- Do not add Leaflet or AMap SDK
- Do not change `/api/map/items` behavior

Affected files (when unblocked): `public/app.js`, `src/server/static-data.js`, potentially new map service module.

Risk: high. Touches high-conflict `app.js`, adds external dependency.

Acceptance (when unblocked):

- Interactive map renders campus POIs
- Location picker works for post creation
- `node --check server.js`
- Manual browser test on mobile viewport

---

## Risky

These areas are not recommended for refactoring without a dedicated task, snapshot baseline, and rollback plan.

### `public/app.js` Refactoring

2,151 lines, single file, all frontend logic. No automated tests. Splitting requires full regression testing.

Source: `CLAUDE.md` high-conflict files.

### `feed-service.js` Scoring Refactoring

787 lines, scoring weights tuned through measured snapshot comparisons. Changes affect all users immediately.

Source: `docs/agent/handoffs/feed-optimization.md`

### NodeBB Integration Layer Refactoring

`createNodebbTopicFromPayload()` is the unified entry for both manual and AI publishing. Refactoring affects both paths.

Source: `post-service.js:87` shared by `handleCreatePost` and `handleAiPostPublish`

### Auth System Refactoring

335 lines, password hashing, email verification, session management, NodeBB uid mapping, invite codes are tightly coupled.

Source: `auth-service.js` depended on by all authenticated APIs

### `post-metadata.json` Format Change

2,314 lines, read by `loadMetadata()` and written by `patchPostMetadata()` in multiple files. Format change requires syncing all consumers.

Source: `data-store.js` used by `feed-service.js`, `post-service.js`, `ai-light-publish.js`, `admin-routes.js`

### `api-router.js` Route Structure Change

Currently if-else chain with uniform `async (req, reqUrl, res)` signature. Switching to framework routing requires changing all handlers.

Source: `api-router.js:27-94`

---

## Current Rule

Documentation refresh threads must only update `docs/agent/*`.

Do not modify:

- `server.js`
- `public/app.js`
- `data/*`

Do not commit real API keys. `MIMO_API_KEY` belongs only in `.env` or server environment variables.
