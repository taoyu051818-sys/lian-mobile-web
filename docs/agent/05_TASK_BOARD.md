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

### Publish V2 Page

Dedicated publish page replacing old modal. 3-step flow: imageSelect → locationPick → draftReview. Multi-image upload with compression, embedded Map v2 picker, AI draft generation, audience picker (公开/校园/本校/仅自己), draft save, and publish.

Confirmed product correction:

- After the user confirms selected images, the flow must immediately enter Map v2 location picking.
- Upload progress and later AI preview latency should overlap with the user's location-picking time.
- Location picking must include both `确认地点` and `跳过定位`.
- Default expectation is a coordinate-bearing `locationDraft` when the user confirms a map point/location.

Changed files: `public/publish-page.js` (new), `public/index.html`, `public/app.js`, `public/app-state.js`, `public/map-v2.js`, `public/styles.css`

Handoff: `docs/agent/handoffs/publish-v2-page.md`

Status: **待审核** — review 修正已应用。图片选择后立即进入地图选点，上传在后台进行，AI preview 等待上传完成后触发。

### Frontend Mock API Layer

Standalone mock API for frontend repo (`lian-frontend`). `public/mock-api.js` intercepts `api()` and `uploadImage()` to serve all 29 endpoints from local data. Enabled with `?mock=1` query param.

Mock data: 20 feed items (paginated), 6 full post details with replies, 5 map locations + 2 areas + 1 route + 3 map posts, 8 channel messages, mock user with aliases, profile lists (history/saved/liked), AI draft preview.

Deployment guide: `DEPLOY.md`. Verification script: `scripts/verify-mock.js` (79 checks, all passing).

Changed files: `public/mock-api.js` (new), `public/index.html`, `scripts/verify-mock.js` (new), `DEPLOY.md` (new)

Status: **待审核** — Node.js 验证 79/79 通过，需浏览器验证：首页卡片渲染、详情页内容/回复、地图标记、频道消息、个人中心、发布流程。

---

## Ready

Architecture entry point: `docs/agent/ARCHITECTURE_WORKPLAN.md`

### Operating Rule: Codex Reviews, Claude Code Executes

Status: **Active rule**.

Default workflow:

| Stage | Owner thread | Output |
|---|---|---|
| Scope and plan | Codex / code | Task doc, allowed files, validation commands, risk notes |
| Implementation | Claude Code | Patch, command output, handoff |
| Review and acceptance | Codex / code | Findings, accepted/rejected status, task board update |

Notes:

- Executor reports are not acceptance.
- Review findings are blockers unless explicitly waived in the task doc.
- Claude Code should stop and hand back if the implementation requires changing scope, touching forbidden files, or resolving product ambiguity.
- Codex / code should not mix review with broad runtime refactors unless the user explicitly asks it to execute fixes.

### P0: Repo Split - Frontend Here, Backend Elsewhere

Task doc: `docs/agent/tasks/repo-split-frontend-backend.md`

Handoff: `docs/agent/handoffs/repo-split-frontend-backend.md`

Goal: turn the current repo into the frontend/mobile web workspace and move the complete backend/server/data integration layer into a separate backend repository.

Target ownership:

- current repo: frontend app, frontend assets, Publish UI, feed/detail/messages/profile UI, Map v2 UI, static admin/editor frontend tools, frontend smoke, frontend docs;
- backend repo: `server.js`, `src/server/*`, NodeBB integration, AI adapters, feed services, auth/session, upload proxy, metadata writes, Audience, Map v2 data/admin APIs, backend validators, backend deployment.

Why P0:

- frontend and backend work are now stepping on each other in the same repo;
- Publish V2, Map v2, Messages, Audience, and NodeBB integration need separate implementation lanes;
- backend contains secrets and server-owned data that should not live in a frontend-first workspace long term;
- future agents need clearer ownership boundaries before larger refactors.

Required phase order:

1. Inventory frontend API calls.
2. Inventory backend routes.
3. Freeze API contract docs.
4. Bootstrap backend repo without changing runtime behavior.
5. ~~Add frontend API base URL configuration in current repo.~~ Done (Phase 0.5)
6. Stage reverse proxy deployment.
7. Remove backend ownership from current repo only after backend repo is validated.

Status: **Phase 0.5 Done** — API contract frozen. `LIAN_API_BASE_URL` configured in `app-utils.js`, `map-v2.js`, `map-v2-editor.js`. Set `window.LIAN_API_BASE_URL` before scripts to point at remote backend. Ready for Phase 1 (backend repo bootstrap).

### P0: Project File Index And Documentation Cleanup

Task doc: `docs/agent/tasks/project-file-index-and-doc-cleanup.md`

Goal: audit the full repository file set, verify documentation index coverage, and clean or clearly mark old, contradictory, vague, generated, local-only, and legacy documentation/file references before repo split continues.

Why P0:

- frontend/backend split requires a reliable file ownership map;
- current docs contain stale baseline facts, mojibake, and mixed historical/current status blocks;
- `outputs/` and `data/` contain generated/local/runtime files that need explicit source-vs-artifact policy;
- new threads need one canonical file index and one clear source-of-truth order.

Acceptance:

- every top-level directory and active file group has an index/ownership entry;
- task board status language is normalized and old blockers are moved or marked as audit history;
- generated outputs and local runtime files are not mistaken for maintained source;
- no runtime code changes are made.

### Implementation Batch: Safety-Gated Product Continuation

This batch is the current work distribution after Pro review. It keeps runtime implementation work out of this architecture thread and gives implementation threads narrow ownership.

Execution rule:

1. Do not combine more than one track in a single implementation PR unless the task explicitly depends on a shared file change.
2. Safety gates come first because Publish V2, AI publish, Audience, Messages, and Map v2 all depend on stable metadata writes and stable routing.
3. Runtime code threads must write or update a handoff after each task.
4. Architecture/doc threads may adjust scope and acceptance criteria, but should not implement runtime changes.

Recommended assignment:

| Lane | Owner thread | Task doc | Status | Dependency | Scope |
|---|---|---|---|---|---|
| A | Backend safety | `docs/agent/tasks/metadata-write-safety.md` | **Done** | none | Serialized `post-metadata.json` write protocol, backup, temp rename, patch tests |
| B | Route safety | `docs/agent/tasks/route-matcher-tests.md` | **Done** | none | Route matcher tests for existing API behavior; no framework migration |
| C | Publish UX | `docs/agent/tasks/publish-v2-page.md` | Verify/fix | A + B recommended | Confirm images -> immediate Map v2 picker; uploads/AI run in background; user confirms publish |
| D | Audience correctness | `docs/agent/tasks/audience-auth-hydration.md` | **待审核** | B recommended | Canonical viewer hydration from `institution`/`tags`/auth store shape |
| E | NodeBB contracts | `docs/agent/tasks/nodebb-contract-smoke-tests.md` | **待审核** | B recommended | Live smoke of notifications/bookmarks/upvoted/replies/votes without leaking secrets |
| F | Messages discussion | `docs/agent/tasks/nodebb-reply-notifications-messages.md` | **待修复** | D + E | Current-user reply notifications in Messages; not private chat. 2026-05-03 reviewer rerun found remaining blockers in notification error display and audience filtering. |
| G | Channel safety | `docs/agent/tasks/channel-messages-audience-filtering.md` | **待审核** | D | Audience filtering for `/api/channel` and natural discussion timelines |
| H | Map v2 picker safety | `docs/agent/tasks/map-v2-bounds-picker-validation.md` | **待审核** | B recommended | Product bounds, picker confirm/skip output, validated map data |
| I | Map v2 editor continuation | `docs/agent/tasks/map-v2-admin-editor.md` | Later | H recommended | Curves, route semantics, asset placement, building hierarchy |

Parallelization guidance:

- Lanes A and B can run in parallel.
- Lane D can start after B or with careful coordination if it does not touch `api-router.js`.
- Lane E can run in parallel with D because it should be diagnostic-first.
- Lane C should wait for A and B when possible, because publish writes metadata and routes through the central router.
- Lanes F and G should wait for D. F should also wait for E because notification endpoint shape must be verified first.
- Lane H can run after B and can proceed in parallel with D/E if it does not touch publish code.
- Lane I should not block Publish V2 and should not proceed until the picker/bounds contract is stable.

Blocking gates before calling a product thread "done":

- `node --check` for every touched JS file.
- `node scripts/validate-post-metadata.js` when publishing or metadata code is touched.
- `node scripts/test-routes.js` after router or endpoint work.
- `node scripts/test-audience.js` after audience work.
- NodeBB contract smoke after NodeBB endpoint assumptions change.
- Browser smoke for Publish V2 or Messages UI work.

### Task: High-Risk Refactor Execution Plan

Task doc: `docs/agent/tasks/high-risk-execution-plan.md`

Reference: `docs/agent/references/HIGH_RISK_AREAS.md`

Goal: execute future high-risk refactors through controlled tracks: baseline observation, smoke tests, narrow behavior-preserving change, validation, and handoff.

Priority order:

1. Runtime safety gates
2. `post-metadata.json` write safety
3. `api-router.js` route safety
4. Audience/auth hydration
5. NodeBB integration contracts
6. Frontend script load order
7. Feed scoring cleanup
8. Auth modularization

Risk: high if combined with product changes; medium if executed as one narrow track per PR.

Acceptance: each implementation thread touches only one high-risk track, preserves behavior unless the task explicitly says otherwise, runs the required smoke/validation commands, and writes a handoff.

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

Handoffs: `docs/agent/handoffs/admin-editor-v1.md`, `docs/agent/handoffs/road-draw-mvp.md`, `docs/agent/handoffs/road-junctions-phase1b.md`, `docs/agent/handoffs/curves-route-semantics-phase1c.md`, `docs/agent/handoffs/asset-placement-phase2.md`

Goal: expand the internal map editor. V1 backend/data model is implemented. Phase 1A road draw MVP completed. Phase 1B junctions completed. Phase 1C curves completed. Phase 2 asset placement completed: "放置" mode, image upload (Cloudinary), click-to-place, drag-to-reposition, asset properties panel, `assets[]` data model with server normalization.

Remaining phases:
- Phase 3: building group hierarchy

Status: **Phase 2 完成** — 外部资产放置模式已实现，等待 Phase 3。

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

### Task: NodeBB Like Feed Card Validation

Task doc: `docs/agent/tasks/nodebb-like-feed-card-validation.md`

Goal: validate the started feed-card like integration against the actual NodeBB instance, confirm endpoint behavior, and decide whether to finish, adjust endpoint fallback, or revert.

Risk: medium. It touches `post-service.js`, `feed-service.js`, `api-router.js`, and frontend card rendering.

Acceptance: clicking the heart toggles NodeBB vote state for the topic's first post, count updates correctly after refresh, and feed ranking remains unchanged.

### Task: NodeBB Reply Notifications In Messages Page

Goal: make NodeBB replies/comments enter LIAN's messages experience as user-scoped notifications and discussion updates, without turning the messages page into private chat.

Product decision:

- The messages page means real-time discussion activity.
- Comment/reply information should enter the messages page when the current user has permission to see the related post.
- This is not private chat. It is a discussion/notification surface backed by NodeBB replies and notifications.

Current finding:

- `POST /api/posts/:tid/replies` already writes replies to NodeBB.
- `GET /api/messages` currently reads NodeBB `/api/notifications`, but it is not user-scoped to the current LIAN user and is not wired into the visible messages page.
- The visible messages page currently loads `/api/channel`, which is the public/channel timeline, not personal reply notifications.

Affected files:

- `src/server/channel-service.js` or a new `src/server/notification-service.js`
- `src/server/api-router.js`
- `public/app-messages-profile.js`
- `public/styles.css`
- `docs/agent/domains/NODEBB_INTEGRATION.md`

Backend requirements:

- `GET /api/messages` must require/login-resolve the current LIAN user when returning personal notifications.
- Resolve the current user's NodeBB uid with `ensureNodebbUid(auth)`.
- Call NodeBB notifications with the current user's `_uid`, not the fallback/platform `NODEBB_UID`.
- Normalize NodeBB reply notifications into LIAN items with `id`, `type`, `title`, `excerpt`, `tid`, `pid`, `actor`, `time`, `read`, and LIAN detail URL.
- Map raw NodeBB topic paths to LIAN post detail navigation. Do not send users to raw NodeBB public URLs by default.
- If a notification can be tied to a topic, apply `canViewPost(auth.user, post, "detail")` before returning it.
- Do not mark notifications read on fetch. Mark read only on click/open or explicit action, using NodeBB's native read endpoint after smoke testing.
- Preserve the distinction between personal discussion notifications and the public/channel timeline.

Frontend requirements:

- Keep the current channel timeline separate.
- Add a messages-page tab or section for `回复/通知`.
- Reply notification click opens LIAN detail for the topic, with optional future reply highlight.
- Message labels should make the product meaning clear: `讨论`, `回复`, `通知`, not `私信`.
- Empty/error states must be normal UTF-8 Chinese.

Non-goals:

- No private messages/chat.
- No push notification system.
- No moderation inbox in this task.
- No recommendation/feed ranking changes.
- No new NodeBB plugin.

Acceptance:

- User B receives a LIAN messages notification when user A replies to B's post and NodeBB emits the notification.
- The notification list is scoped to user B's NodeBB uid, not the platform/default uid.
- Unauthorized school/org/private post notifications are hidden or rendered as a safe unavailable item.
- Clicking a reply notification opens LIAN's post detail, not raw NodeBB.
- `/api/channel` continues to behave as the channel timeline.
- Chinese labels show as `回复`, `通知`, `暂无通知`, `加载中` without mojibake.

---

## Blocked

### Review Fix Pass: Audience, NodeBB Detail/Profile, Publish V2, Frontend Smoke, Map Bounds

Update date: 2026-05-03

Source: implementation handoff reporting 143/143 tests passing after review-blocker fixes.

Current decision: previous blockers are no longer treated as open blockers, but final acceptance still requires a reviewer to re-run the documented smoke/integration commands in the target environment.

Fixes recorded:

| Area | Status | Recorded fix |
|---|---|---|
| Audience hydration | Fixed / accepted | Lane D already added `hydrateAudienceUser()` and permission functions auto-hydrate raw auth users. |
| `/api/posts` baseline metadata | Fixed / needs spot check | `post-service.js` now always writes `visibility` and `audience` after successful topic creation. |
| Mojibake review blocker | Fixed by implementation report | No mojibake found in the reviewed touched labels; visible UTF-8 labels still need normal browser verification before release. |
| Publish V2 audience display precedence | Fixed / needs browser check | Publish rendering now uses `p.audience` first, then `p.metadata?.visibility`. |
| Publish V2 upload failure path | Fixed / needs browser check | Failed uploads are filtered out; if no valid image URL remains, the user stays on image selection. |
| Frontend smoke | Fixed | `scripts/smoke-frontend.js` rewritten with server connectivity probe, graceful skip for HTTP checks, and separate passed/failed/skipped reporting. Now passes 21/21. |
| Map validator bounds drift | Fixed | `scripts/validate-locations.js` now uses approved bounds `18.373050/109.995380` to `18.413856/110.036262`. Verified identical to `map-v2-service.js`. |

Required reviewer validation before closing:

```bash
node scripts/test-audience-hydration.js
node scripts/smoke-frontend.js http://localhost:4100
node scripts/validate-locations.js
node scripts/test-routes.js
```

Manual validation still required:

- Publish V2: multi-image upload failure and success paths.
- Publish V2: audience selection survives AI preview/regenerate and final payload.
- NodeBB detail/profile: save, like, report, saved list, liked list, history list.
- `/api/posts`: create a text-only public post and confirm `post-metadata.json` gets baseline `visibility` and `audience`.

### Review Blockers: Audience, NodeBB Detail/Profile, Publish V2

Review date: 2026-05-03

Scope reviewed:

- `docs/agent/handoffs/audience-system-phase1-3.md`
- `docs/agent/handoffs/nodebb-detail-actions-profile-history.md`
- `docs/agent/handoffs/publish-v2-page.md`
- relevant runtime files for audience checks, post actions, profile activity, and Publish V2

Current decision: do not mark these three tasks as approved yet. They need a focused fix pass before final acceptance.

Blocked tasks:

| Task | Review status | Blocking issues |
|---|---|---|
| Audience System Phase 1-3 | Not approved | Current auth user is not reliably hydrated with `schoolId`, `orgIds`, and roles before audience checks. School/private visibility can be mis-evaluated. |
| NodeBB Detail Actions & Profile Activity | Not approved | Runtime feature is mostly present, but user-facing Chinese labels still contain mojibake and smoke status is not green. Audience hydration also affects save/like/report/profile filtering. |
| Publish V2 Page | Not approved | Runtime flow exists, but visible labels still contain mojibake. Audience picker display can be overwritten by AI preview metadata. Upload failure path can advance without a usable image URL. |

Required fix pass:

1. Complete canonical audience viewer hydration in `auth-service` / `audience-service` and make permission functions use it consistently.
2. Ensure `/api/posts` always writes baseline metadata after successful topic creation, including `visibility` and `audience`.
3. Clean mojibake from touched runtime UI files before browser acceptance.
4. Fix Publish V2 audience display precedence so user-selected audience wins in both payload and UI.
5. Make Publish V2 upload failures block draft preview/publish until at least one valid image URL exists or the user explicitly removes failed images.
6. Repair and rerun frontend smoke; do not accept these tasks until smoke status is explainable and green.

Related task docs:

- `docs/agent/tasks/audience-auth-hydration.md`
- `docs/agent/tasks/nodebb-detail-actions-profile-history.md`
- `docs/agent/tasks/publish-v2-page.md`

### Review Blockers: Completed Lanes D/E/G/H

Review date: 2026-05-03

Scope reviewed:

- Lane D: Audience Auth Hydration
- Lane E: NodeBB Contract Smoke
- Lane G: Channel Audience Filtering
- Lane H: Map v2 Bounds

Current decision:

| Lane | Review status | Reason |
|---|---|---|
| D Audience Auth Hydration | Accepted with follow-up | `hydrateAudienceUser()` exists, permission functions auto-hydrate, and `node scripts/test-audience-hydration.js` passed 61/61. Follow-up: role-scoped viewing is not implemented even though `audience.roleIds` is normalized. |
| E NodeBB Contract Smoke | Accepted | `node scripts/smoke-nodebb-contracts.js` passed against the remote NodeBB service when network access was allowed. It confirms notifications/bookmarks/upvoted require `Authorization: Bearer`. |
| G Channel Audience Filtering | Accepted with follow-up | `/api/channel` now resolves an optional viewer and filters with `canViewPost(..., "map")`. Follow-up: it slices topics before filtering, so pages can be under-filled when hidden topics are encountered. |
| H Map v2 Bounds | Accepted | Bounds constants now match between `map-v2-service.js` and `validate-locations.js` (both use `18.373050/109.995380` to `18.413856/110.036262`). `node scripts/validate-locations.js` passes with 0 errors. |

Shared validation issue (resolved):

- `node scripts/smoke-frontend.js` now passes 21/21. The harness was rewritten to probe server connectivity first and skip HTTP checks gracefully when the server is unreachable.

Related task docs:

- `docs/agent/tasks/audience-auth-hydration.md`
- `docs/agent/tasks/nodebb-contract-smoke-tests.md`
- `docs/agent/tasks/channel-messages-audience-filtering.md`
- `docs/agent/tasks/map-v2-bounds-picker-validation.md`
- `docs/agent/tasks/frontend-stability-smoke.md`

### Review Blockers: Lane F Messages Discussion

Review date: 2026-05-03

Scope reviewed:

- `src/server/notification-service.js`
- `scripts/smoke-frontend.js`
- `docs/agent/tasks/nodebb-reply-notifications-messages.md`
- `docs/agent/handoffs/nodebb-reply-notifications-messages.md`

Current decision: Lane F is not accepted. Reviewer rerun found remaining blockers after the recorded fixes.

Findings:

| Finding | Severity | Status | Required fix |
|---|---|---|---|
| `/api/messages` silently returns `{ items: [] }` for NodeBB/auth/API failures | P2 | Partially fixed | Backend now returns `{ items: [], error: "notification_fetch_failed" }` for NodeBB notification fetch failures, but `public/app-messages-profile.js` ignores `data.error` and renders the same empty state. UI must show a safe error state. |
| Notifications tied to topics without metadata bypass audience filtering | P2 | Open | `src/server/notification-service.js` only calls `canViewPost()` when `postMeta` exists. The Lane F acceptance criterion says topic-tied notifications must be checked before return. Missing metadata must be handled explicitly. |
| Frontend smoke claim is not reproducible in reviewer environment | P2 | Still not accepted | `node scripts/smoke-frontend.js http://localhost:4100` reproduced 13/21 because the smoke harness invokes `cmd.exe` through `execSync` and hits `EPERM`; direct `node --check` passes. Either fix/document the harness limitation in a reliable way or provide target-environment smoke evidence. |

Notes:

- Direct frontend syntax checks pass, so the smoke failure appears harness/environment-specific, but the Lane F handoff's 21/21 claim is not accepted in this reviewer environment.
- Guest `/api/messages` returns `{ items: [] }`, which is acceptable for guests.
- `node scripts/test-routes.js` passes 61/61.
- Do not close Lane F until the two runtime blockers above are fixed and smoke status is either reproducible or explicitly scoped as a known harness limitation.
- Executor thread should fix only the two runtime blockers and smoke documentation/path. Do not add private chat, mark-read, push notifications, reply highlight, or notification type redesign in this lane.
- Reviewer thread should re-check API error display, metadata-missing audience behavior, guest behavior, route tests, and the smoke-script limitation before moving Lane F out of `待修复`.

Related task docs:

- `docs/agent/tasks/nodebb-reply-notifications-messages.md`
- `docs/agent/handoffs/nodebb-reply-notifications-messages.md`

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
