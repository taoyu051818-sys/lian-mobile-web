# Agent Task Board

This is the current task board. Each task has a goal, affected files, risk level, and acceptance criteria.

Baseline reference: `docs/agent/01_PROJECT_FACT_BASELINE.md`
Docs index: `docs/agent/README.md`

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

### NodeBB Like Feed Card First Cut

Started after the NodeBB native capability inventory.

Behavior:

- homepage feed cards replace the old right-side time label with a like control;
- empty heart means not liked;
- filled red heart means liked;
- like count is shown next to the heart;
- first cut must not change feed ranking.

Handoff: `docs/agent/handoffs/nodebb-like-feed-card.md`

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

### NodeBB Native Capability Inventory

Audited all 6 candidate NodeBB native capabilities (Like, Save/Bookmark, Read State, Report/Flag, Topic Edit/Delete, Groups/Categories) against the 8-point checklist. Results added to `NODEBB_INTEGRATION.md`. Runtime smoke tests documented but not yet run.

Handoff: `docs/agent/handoffs/nodebb-native-capability-inventory.md`

### Audience System Phase 1-3

Read-side audience enforcement. Write-side (`canCreatePostWithAudience`) is Phase 4, not yet wired.

- New module: `src/server/audience-service.js` with 7 permission functions
- `canViewPost(user, post, context)` — context is `"feed"`, `"map"`, or `"detail"` (default)
- linkOnly posts: never distributed to feed/map; detail page checks base visibility
- canonical schoolId = Chinese short name (e.g., `中国传媒大学`), derived from `institution` at read time
- Organization posts use `visibility: "private"` + `orgIds` (no separate `organization` enum)
- Publish handlers write `audience` to metadata on creation (no write-side permission check yet)
- Backward compatible: old posts without `audience` default to flat `visibility` string
- Test infra: 10 users (5 schools, 3 orgs, admin, external), 15 posts, 3 scripts

Changed files: `src/server/audience-service.js` (new), `src/server/feed-service.js`, `src/server/map-v2-service.js`, `src/server/post-service.js`, `src/server/ai-light-publish.js`, `src/server/api-router.js`

Test plan: `docs/agent/tasks/audience-test-users-and-posts.md`
Handoff: `docs/agent/handoffs/audience-system-phase1-3.md`

Status: **待审核** — 二次修正完成。linkOnly+private 泄漏已修复，回复权限已接入，测试期望已更正，文档已更新。需运行 `node scripts/setup-audience-test.js && node scripts/test-audience.js` 验证。

### NodeBB Detail Actions & Profile Activity

Detail page: 收藏(save/bookmark) + 点赞(like, now with audience check) + 举报(report/flag). Profile page: 浏览记录/收藏/赞过 tabs. All action endpoints enforce `canViewPost` before calling NodeBB. Detail `bookmarked` is user-scoped. Profile thumbnails use `proxiedPostImageUrl`.

Changed files: `src/server/post-service.js`, `src/server/api-router.js`, `src/server/feed-service.js`, `public/app-feed.js`, `public/app-messages-profile.js`, `public/app.js`, `public/styles.css`

Handoff: `docs/agent/handoffs/nodebb-detail-actions-profile-history.md`

Status: **待审核** — 实现完成，review 修复已应用。需 smoke test NodeBB `/:slug/bookmarks` 和 `/:slug/upvoted` 端点，验证中文标签无乱码。

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

### Task: Map v2 Admin Editor

Task doc: `docs/agent/tasks/map-v2-admin-editor.md` (revised 2026-05-02)

Handoffs: `docs/agent/handoffs/admin-editor-v1.md`, `docs/agent/handoffs/road-draw-mvp.md`

Goal: expand the internal map editor. V1 backend/data model is implemented (new normalizers for buildings/environment/entrances/groups, extended load/save/API, validation, property panels, vertex editing, export). Phase 1A road draw MVP completed: game-engine-style click-drag road drawing, 4 road types, properties panel, point simplification, save/reload/export, bounds validation.

Remaining phases:
- Phase 1B: road editing + junctions (auto-snapping, crossing detection, segment splitting)
- Phase 1C: curves + route semantics
- Phase 2: asset placement mode
- Phase 3: building group hierarchy

Status: **Phase 1A 完成** — 路网绘制引擎 MVP 已实现，等待 Phase 1B。

Risk: medium-high. It changes admin tooling and map data shape, but should not affect feed or publishing if kept isolated.

Acceptance: admin can draw roads by click-drag, place external assets, manage building group hierarchy, edit properties, and export render spec.

### Task: Map v2 Render Workflow

Task doc: `docs/agent/tasks/map-v2-render-workflow.md`

Goal: support export of structured map specs to external AI/design renderers, upload/bind rendered outputs, preview with live overlays, and publish/rollback map versions.

Risk: medium. This is mostly admin/data workflow, but versioning mistakes can break map display.

Acceptance: render spec exports valid JSON without secrets/private user data; rendered output can be previewed and bound to a map version without flattening interactive overlays.

### Task: Map v2 Building And Floor Plan View

Task doc: `docs/agent/tasks/map-v2-building-floor-plan.md`

Goal: let users click a building/building group on the campus map and enter a higher-precision 2D floor/room view with related function posts.

Risk: high. This touches frontend map navigation, map data model, post association, and future audience filtering.

Acceptance: overview building click opens a building view, floor selector works, room polygons are clickable, and related posts respect future visibility rules.

### Task: Publish V2 Page

Task doc: `docs/agent/tasks/publish-v2-page.md`

Goal: replace the modal-style publish MVP with a dedicated page that supports multi-image upload, simple frontend compression, automatic transition to Map v2 location picking, editable AI draft review, and user-confirmed audience selection.

Current baseline: modal-era multi-image publish support already exists from `AI Publish Polish`. This task should migrate the product flow to a dedicated page, reuse existing `imageUrls[]` behavior where practical, and add Map v2 picker plus user-confirmed audience handling.

Affected files:

- `public/index.html`
- `public/publish-page.js`
- `public/app.js`
- `public/app-state.js`
- `public/app-ai-publish.js`
- `public/app-utils.js`
- `public/map-v2.js`
- `public/styles.css`
- `src/server/ai-post-preview.js`
- `src/server/ai-light-publish.js`

Risk: high. This touches the main publish entry, image upload, Map v2 picking, AI preview, final NodeBB publish, and draft recovery.

Acceptance: main `+` opens the dedicated Publish page; user can select multiple images, confirm them once, move directly to Map v2 location picking, pick or skip location, receive one AI draft based on all images, edit audience/location/content, save draft, and publish only after explicit confirmation. Failed publish must not write `post-metadata.json`.

Handoff: `docs/agent/handoffs/publish-v2-page.md`

Status: **Ready** — plan reconciled with current multi-image baseline, 8-phase execution order defined, failure paths documented.

### Task: NodeBB Like Feed Card Validation

Task doc: `docs/agent/tasks/nodebb-like-feed-card-validation.md`

Goal: validate the started feed-card like integration against the actual NodeBB instance, confirm endpoint behavior, and decide whether to finish, adjust endpoint fallback, or revert.

Risk: medium. It touches `post-service.js`, `feed-service.js`, `api-router.js`, and frontend card rendering.

Acceptance: clicking the heart toggles NodeBB vote state for the topic's first post, count updates correctly after refresh, and feed ranking remains unchanged.

---

## Blocked

### Map V2 Implementation (superseded)

This blocked item is superseded by the completed Map v2 Gaode/editor work and the new `map-v2-data-assets` task.

Do not treat this as an active blocker. Use `docs/agent/ARCHITECTURE_WORKPLAN.md` and `docs/agent/tasks/map-v2-data-assets.md` for current Map v2 work.

---

## Risky

These areas are not recommended for refactoring without a dedicated task, snapshot baseline, and rollback plan.

### Frontend Script Load Order

`public/app.js` has been split into classic-script modules. The old single-file bottleneck is gone, but the frontend still relies on browser globals and script order in `index.html`. Any refactor must run the frontend smoke test and check the app in a browser.

Source: `docs/agent/handoffs/frontend-app-split.md`

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
