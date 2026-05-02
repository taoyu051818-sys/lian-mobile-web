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

### Frontend App Split

`public/app.js` has been mechanically split into smaller classic-script files. This is now the frontend baseline.

Split files:

- `public/app-state.js`
- `public/app-utils.js`
- `public/app-auth-avatar.js`
- `public/app-feed.js`
- `public/app-legacy-map.js`
- `public/app-ai-publish.js`
- `public/app-messages-profile.js`
- `public/app.js`

Handoff: `docs/agent/handoffs/frontend-app-split.md`

### Frontend Stability Smoke

Browserless HTTP smoke test for the split frontend. 21 checks covering homepage HTML, static JS reachability, API JSON validity, frontend syntax, and CSS.

Script: `scripts/smoke-frontend.js`

Usage: `node scripts/smoke-frontend.js [URL]`

Handoff: `docs/agent/handoffs/frontend-stability-smoke.md`

### AI Publish Polish

Multi-image AI publish support, non-blocking draft saves, JSONL archive tool.

- `ai-light-publish.js`: `normalizeAiPostPayload` handles `imageUrls` array, passes all to `createNodebbTopicFromPayload`
- `app-ai-publish.js`: state uses `imageUrls[]`, multi-file upload with remove buttons, draft save is fire-and-forget
- `scripts/archive-ai-records.js`: count/list/archive commands for JSONL hygiene

Handoff: `docs/agent/handoffs/ai-publish-polish.md`

### Avatar NodeBB Fallback

Real identity avatar falls back to NodeBB `user.picture` when no Cloudinary avatar uploaded. Alias avatar stays alias-only.

Changed files: `src/server/auth-service.js`, `src/server/post-service.js`

### NodeBB Integration Audit

Verified all NodeBB endpoints, auth modes, `_uid` behavior, and failure modes. Added Failure Modes section to `NODEBB_INTEGRATION.md`.

Handoff: `docs/agent/handoffs/nodebb-integration-audit.md`

### Audience Permission Design

Designed audience model with 5 permission functions, 8 enforcement points, NodeBB mirror strategy, and 5-phase migration plan.

Handoff: `docs/agent/handoffs/audience-permission-design.md`

### Feed Ops Snapshot Diff

Added `--diff` mode to `scripts/snapshot-feed.js` for comparing two feed snapshots. Diff highlights content type distribution, location coverage, official ratio, image ratio, and changed tids with position shifts.

Handoff: `docs/agent/handoffs/feed-ops-snapshot-diff.md`

### Restore Legacy Geo Anchors To Map v2

Restored 9 real-world coordinate anchors from v1 `geoImagePairs` into `data/locations.json`. 14 total locations with GCJ-02 coordinates and legacyPoint preserved.

Changed files: `data/locations.json`, `scripts/validate-locations.js`

Handoff: `docs/agent/handoffs/map-v2-restore-legacy-geo.md`

### Static Data Expansion

Expanded `mapItems` from 10 to 17 entries, aligned with `locations.json` coordinates. Added missing schools (BUPT, UESTC), campus places (食堂, 体育场, 创新创业中心, 大墩村, 摆渡车站点). `authInstitutions` was already complete (6 schools).

Changed files: `src/server/static-data.js`

### Post Metadata Gap Check

Audited all NodeBB tids against `post-metadata.json`. Found 11 gaps (tid 98, 101-106, 139-142). tid 98 doesn't exist; tid 101-105 are 401 (private/auth-only); tid 106 is a system channel topic; tid 139/140 are test posts. Added metadata for tid 141 (campus_life) and tid 142 (campus_activity, 摆渡车站点) which are real posts visible in feed.

Changed files: `data/post-metadata.json`

Handoff: `docs/agent/handoffs/post-metadata-gap-check.md`

---

## Ready

Architecture entry point: `docs/agent/ARCHITECTURE_WORKPLAN.md`

### Task: Map v2 Data Assets

Task doc: `docs/agent/tasks/map-v2-data-assets.md`

Goal: improve Map v2 data, assets, bounds validation, and editor ergonomics without changing feed or publishing.

Affected files:

- `public/map-v2.js`
- `public/tools/map-v2-editor.*`
- `public/assets/*`
- `src/server/map-v2-service.js`
- `data/locations.json`
- `data/map-v2-layers.json`
- `scripts/validate-locations.js`

Risk: medium. Map data and editor affect location picking.

Acceptance: editor can preview assets, validate bounds, and save valid locations/routes/areas.

---

## Blocked

### Map V2 Implementation (superseded)

This blocked item is superseded by the completed Map v2 Gaode/editor work and the new `map-v2-data-assets` task.

Do not treat this as an active blocker. Use `docs/agent/ARCHITECTURE_WORKPLAN.md` and `docs/agent/tasks/map-v2-data-assets.md` for current Map v2 work.

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

Architecture/documentation refresh threads must only update `docs/agent/*`.

Do not modify:

- `server.js`
- runtime frontend files
- `data/*`

Do not commit real API keys. `MIMO_API_KEY` belongs only in `.env` or server environment variables.
