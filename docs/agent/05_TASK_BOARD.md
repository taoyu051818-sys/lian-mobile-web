# Agent Task Board

This is the current task board. Each task has a goal, affected files, risk level, and acceptance criteria.

Baseline reference: `docs/agent/01_PROJECT_FACT_BASELINE.md`
Docs index: `docs/agent/README.md`

Recent GitHub update summary: `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-04.md`

Latest long-thread handoff: `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-04.md`

## Status Legend

- **Done** - implementation complete, accepted by reviewer
- **待审核** - implementation complete, awaiting first review
- **待复核** - review findings fixed, awaiting reviewer re-run
- **Blocked** - waiting on dependency or external action
- **Ready** - task spec written, can be started
- **Later** - intentionally deferred
- **Superseded** - replaced by newer task/decision

Thread workflow: Codex/code threads handle planning, review, and acceptance. Claude Code threads handle implementation. Handoffs are context transfer, not acceptance. A lane is accepted only when the reviewer records validation in this file.

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

- `POST /api/ai/post-preview` - draft generation (mock/mimo)
- `POST /api/ai/post-drafts` - silent draft save to JSONL
- `POST /api/ai/post-publish` - user-confirmed publish to NodeBB

Frontend flow:

1. User taps `+` -> simplified AI upload entry
2. Image upload -> `/api/upload/image` -> `/api/ai/post-preview`
3. User edits draft fields (title, body, tags, location)
4. Silent draft save to `/api/ai/post-drafts`
5. User clicks "发布到 LIAN" -> `/api/ai/post-publish`
6. Publish creates NodeBB topic, writes `post-metadata.json`, appends `ai-post-records.jsonl`

Both `/api/posts` and `/api/ai/post-publish` use `createNodebbTopicFromPayload()`. AI posts use the logged-in user's NodeBB account.

### Feed Observability

- `GET /api/feed-debug` exists, protected by `ADMIN_TOKEN`
- `scripts/snapshot-feed.js` generates feed snapshots
- `scripts/validate-post-metadata.js` validates metadata structure

### Map v2 Editor + Grass Base Layer

Standalone internal editor tool page at `/tools/map-v2-editor.html`. Campus grass texture as map base layer with Gaode tiles at 35% opacity. Editor has layer visibility toggles and opacity sliders for all layer groups (grass, tiles, bounds, areas, routes, locations, draft).

Backend: `PUT /api/admin/map-v2` with full bounds validation. Current base-map bounds are SW 18.37107/109.98464 to NE 18.41730/110.04775. Location icon (url/size/anchor) and card (title/subtitle/imageUrl/alwaysShow) support in `map-v2-service.js`.

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
- `canViewPost(user, post, context)` - context is `"feed"`, `"map"`, or `"detail"` (default)
- linkOnly posts: never distributed to feed/map; detail page checks base visibility
- canonical schoolId = Chinese short name (e.g., `中国传媒大学`), derived from `institution` at read time
- Organization posts use `visibility: "private"` + `orgIds` (no separate `organization` enum)
- Publish handlers write `audience` to metadata on creation (no write-side permission check yet)
- Backward compatible: old posts without `audience` default to flat `visibility` string
- Test infra: 10 users (5 schools, 3 orgs, admin, external), 15 posts, 3 scripts

Changed files: `src/server/audience-service.js` (new), `src/server/feed-service.js`, `src/server/map-v2-service.js`, `src/server/post-service.js`, `src/server/ai-light-publish.js`, `src/server/api-router.js`

Test plan: `docs/agent/tasks/audience-test-users-and-posts.md`
Handoff: `docs/agent/handoffs/audience-system-phase1-3.md`

Status: **Done / Accepted with follow-up** - read-side Audience Phase 1-3 accepted. `hydrateAudienceUser()` and `canViewPost(..., context)` are in place, linkOnly/feed/map/detail behavior is defined, and read-side follow-ups are no longer blocking this task. Write-side enforcement is split into P0 task `audience-write-side-minimum-enforcement` below.

### NodeBB Detail Actions & Profile Activity

Detail page: 收藏(save/bookmark) + 点赞(like, now with audience check) + 举报(report/flag). Profile page: 浏览记录/收藏/赞过 tabs. All action endpoints enforce `canViewPost` before calling NodeBB. Detail `bookmarked` is user-scoped. Profile thumbnails use `proxiedPostImageUrl`.

Changed files: `src/server/post-service.js`, `src/server/api-router.js`, `src/server/feed-service.js`, `public/app-feed.js`, `public/app-messages-profile.js`, `public/app.js`, `public/styles.css`

Handoff: `docs/agent/handoffs/nodebb-detail-actions-profile-history.md`

Status: **Superseded by P0 live acceptance** - implementation work is no longer reviewed as this broad task. Remaining validation is tracked by `nodebb-detail-profile-messages-live-acceptance` and `P0: Publish/Profile/NodeBB Regression Fix`: live NodeBB like/unlike, save/unsave, saved list, liked list, history, report, and selected-identity actor display.

### Publish V2 Page

Dedicated publish page replacing old modal. 3-step flow: imageSelect -> locationPick -> draftReview. Multi-image upload with compression, embedded Map v2 picker, AI draft generation, audience picker (公开/校园/本校/仅自己), draft save, and publish.

Confirmed product correction:

- After the user confirms selected images, the flow must immediately enter Map v2 location picking.
- Upload progress and later AI preview latency should overlap with the user's location-picking time.
- Location picking must include both `确认地点` and `跳过定位`.
- Default expectation is a coordinate-bearing `locationDraft` when the user confirms a map point/location.

Changed files: `public/publish-page.js` (new), `public/index.html`, `public/app.js`, `public/app-state.js`, `public/map-v2.js`, `public/styles.css`

Handoff: `docs/agent/handoffs/publish-v2-page.md`

Status: **Done / Accepted with release checks** - product correction is accepted: image selection now immediately enters Map v2 location picking while upload/AI continue in the background. Release-level browser validation is tracked separately by `publish-v2-final-browser-acceptance`.

### Frontend Mock API Layer

Standalone mock API for frontend repo (`lian-frontend`). This is not owned or validated in the current `lian-mobile-web` main repo.

Mock data: 20 feed items (paginated), 6 full post details with replies, 5 map locations + 2 areas + 1 route + 3 map posts, 8 channel messages, mock user with aliases, profile lists (history/saved/liked), AI draft preview.

Deployment guide and verification script belong to the `lian-frontend` repo. Do not treat missing `scripts/verify-mock.js` in `lian-mobile-web` as a main-repo blocker.

Expected changed files in `lian-frontend`: `public/mock-api.js` (new), `public/index.html`, `scripts/verify-mock.js` (new), `DEPLOY.md` (new)

Status: **External** - ignore for `lian-mobile-web` review. Validate in the `lian-frontend` repo/thread. Do not restore or create `scripts/verify-mock.js` in this repo just to satisfy old review references.

### PC Task Board Web UI

Read-only PC task board viewer at `/tools/task-board.html`. Fetches `05_TASK_BOARD.md` via `GET /api/internal/task-board`, parses tasks, renders filterable table with sidebar filters, status/priority badges, human-assisted indicators, detail panel with doc/handoff links.

Changed files: `public/tools/task-board.html` (new), `public/tools/task-board.css` (new), `public/tools/task-board.js` (new), `src/server/task-board-service.js` (new), `src/server/api-router.js`, `src/server/paths.js`

Handoff: `docs/agent/handoffs/pc-task-board-webui-v1.md`

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

### Operating Rule: Map Development Requires Human Assistance

Status: **Active rule**.

Map development is no longer available for independent Claude Code implementation.

This applies to Map v2 editor, Map v2 data assets, road networks, junctions, curves, routes, asset placement, building hierarchy, render workflow, floor-plan view, location redraw, and any implementation task that edits `data/map-v2-layers.json`, `data/locations.json`, `public/map-v2.js`, `public/tools/map-v2-editor.*`, or `src/server/map-v2-service.js`.

Claude Code may still do documentation, read-only audits, validation reruns, review findings, and task scoping for map work.

Before implementation, a human must provide concrete map/design input or approve the exact implementation cut, and intermediate editor/map output must be shown to a human before acceptance. Claude Code must not independently invent campus geometry, road layout, building hierarchy, or visual asset placement.

Status label for these tasks: **Human-assisted only**.

### Pro Decision: Stabilize Before Expanding

Reference: `docs/agent/references/PRO_ENGINEERING_DECISION_2026-05-03.md`

Current decision:

```text
Stabilize validation, Publish V2, Messages, Audience boundaries, docs baseline, and repo split boundaries before adding new product scope.
```

Next execution order:

0. **P0** Fix manual-review regressions in Publish V2, profile activity, NodeBB like/save state, saved/liked lists, and reply discussion messages.
   - Task: `docs/agent/tasks/p0-publish-profile-nodebb-regression-fix.md`
   - Handoff: `docs/agent/handoffs/p0-publish-profile-nodebb-regression-fix.md`
1. **P0** Fix `scripts/smoke-frontend.js` so frontend smoke is reproducible in the reviewer environment.
   - Task: `docs/agent/tasks/frontend-stability-smoke.md`
2. **P0** Rerun Lane F messages/notifications after smoke is fixed; do not mark accepted before reproducible validation or explicit reviewer waiver.
   - Task: `docs/agent/tasks/lane-f-messages-review-rerun.md`
3. **P0** Run Publish V2 browser/manual acceptance for image upload, Map v2 location picking, AI draft, audience picker, publish, metadata, feed/detail.
   - Task: `docs/agent/tasks/publish-v2-browser-acceptance.md`
4. **P1** Run NodeBB detail/profile browser/manual acceptance for save, like, report, saved list, liked list, and history.
   - Task: `docs/agent/tasks/nodebb-detail-actions-profile-history.md`
5. **P1** Clean docs/agent baseline and source-of-truth order.
   - Task: `docs/agent/tasks/project-file-index-and-doc-cleanup.md`
6. **P1** Audit Audience write-side minimum enforcement.
   - Task: `docs/agent/tasks/audience-write-side-minimum-audit.md`
7. **P1/P2** Prepare backend repo bootstrap; do not delete backend files from this repo until backend staging validates.
   - Task: `docs/agent/tasks/repo-split-frontend-backend.md`

Explicitly paused for this phase:

- new recommendation strategy or personalization;
- LLM auto-publish or auto-review;
- place pages and food maps;
- complex Map v2 editor continuation;
- broad UI redesign;
- NodeBB rewrites;
- Express/Fastify migration;
- full PostgreSQL migration;
- full organization permission platform.

### RPO Decision: Release Baseline Stabilization Sprint

Reference: `docs/agent/references/RPO_NEXT_STEP_BRIEF_2026-05-03.md`

Decision source: RPO review supplied by the user on 2026-05-03.

Current one-line judgment:

```text
Stabilize acceptance, add Audience minimum write-side enforcement, then prepare non-destructive backend repo bootstrap. Do not expand product scope or start large refactors now.
```

Scope rule:

- this sprint is for acceptance, permission safety, docs/task-board consistency, and repo-split readiness;
- implementation threads must not add new product lines while these tasks are open;
- map road/raw geometry work is human-assisted only and cannot be independently implemented by Claude Code;
- backend repo bootstrap can be planned now, but copying/validation is gated by P0 acceptance.

P0 task distribution:

| Task | Status | Owner | Goal | Acceptance |
|---|---|---|---|---|
| `stabilization-canonical-review` | **Ready / P0** | Reviewer / Codex | Rerun and record one canonical validation state for frontend smoke, routes, audience hydration, metadata, locations, and project structure. | Task board has one current test report; old conflicting 13/21 vs 21/21 smoke status is resolved or explicitly waived. |
| `publish-v2-final-browser-acceptance` | **Ready / P0** | Frontend owner + Backend owner + Reviewer | Manually validate Publish V2 with real browser/session: multi-image upload, immediate Map v2 location picking, AI draft, audience picker, publish, metadata, feed/detail/map. | User-confirmed publish only; no AI auto-publish; no missing `imageUrls`, `locationDraft`, `audience`, or `visibility`; clear failure state. |
| `nodebb-detail-profile-messages-live-acceptance` | **Partially accepted / P0 remainder** | Frontend owner + Backend owner + Reviewer | Detail/Profile live acceptance passed for like/unlike, save/unsave, report, saved list, liked list, and history on 2026-05-03. Remaining scope is reply messages and current selected identity display. | Replies show as discussion/reply, not private chat/system-only; actor uses current selected identity. |
| `audience-write-side-minimum-enforcement` | **Ready / P0** | Backend implementation thread | Enforce legal audience choices at publish time for `public`, `campus`, `school`, `private`, and `linkOnly`. | Backend rejects forged audience; frontend options come from allowed choices; `linkOnly` does not naturally distribute; `private` is author/admin only; school publishing is constrained. |
| `map-road-network-policy-and-human-review` | **Ready / P0 / Human-assisted only** | Human-assisted map thread + RPO | Decide and verify road-network preview boundary. Raw imported road network preview is admin/editor only; student map may only show curated/published route layers. | Raw road overlay is not shown on normal student exploration page; any student-facing route layer is explicitly reviewed/published. |
| `active-docs-task-board-cleanup` | **Ready / P0** | Codex / docs thread | Keep active docs and task board consistent after RPO decision. Do not turn historical mojibake/audit logs into blockers unless they are active source of truth. | Active task-board, file index, README, ownership, and split notes are readable and consistent; historical logs can remain marked as audit history. |

P0 implementation/review breakdown:

1. `stabilization-canonical-review`
   - run: `node scripts/validate-project-structure.js`;
   - run: `node scripts/test-routes.js`;
   - run: `node scripts/test-audience-hydration.js`;
   - run: `node scripts/validate-post-metadata.js`;
   - run: `node scripts/validate-locations.js`;
   - run frontend smoke once against the active local server and record the canonical result;
   - update this board with one current result instead of keeping old contradictory smoke results as active blockers.

2. `publish-v2-final-browser-acceptance`
   - verify one-image and multi-image upload;
   - verify immediate Map v2 location picking starts as soon as images are selected/confirmed;
   - verify upload and AI draft generation continue in the background;
   - verify confirm location and skip location;
   - verify audience selection survives AI preview/regenerate;
   - verify final publish creates NodeBB topic and writes `imageUrls`, `locationDraft`, `audience`, `visibility`, and distribution metadata;
   - verify feed/detail/map behavior after publish.

3. `nodebb-detail-profile-messages-live-acceptance`
   - accepted 2026-05-03: like/unlike, save/unsave, report, saved list, liked list, and history;
   - remaining: replies enter messages as discussion/reply items;
   - remaining: reply actor uses the user's current selected identity;
   - superseded checks below are kept as historical detail only.
   - accepted detail/profile checks are no longer blockers;
   - verify replies enter messages as discussion/reply items;
   - verify reply actor uses the user's current selected identity.

4. `audience-write-side-minimum-enforcement`
   - add/verify backend allowed audience options;
   - ensure Publish V2 does not hard-code unavailable audience choices;
   - enforce `public`, `campus`, `school`, `private`, and `linkOnly` on publish;
   - reject forged school/org/private/linkOnly payloads server-side;
   - keep organization audience disabled or admin-only unless membership rules are proven.

5. `map-road-network-policy-and-human-review`
   - open the admin/editor preview;
   - confirm road-network alignment controls and export;
   - confirm no write to official `data/map-v2-layers.json`;
   - confirm raw road overlay is not shown to normal student users;
   - create a separate future task for curated/published student route layers.

6. `active-docs-task-board-cleanup`
   - keep only current blockers in active sections;
   - move old review records to Audit Log;
   - keep paused product lines marked Later, not Ready;
   - keep human-assisted map tasks out of independent implementation queues.

P1 task distribution:

| Task | Status | Owner | Goal | Acceptance |
|---|---|---|---|---|
| `backend-repo-bootstrap-readiness-plan` | **Ready / P1** | Architecture / DevOps | Write the non-destructive backend repo bootstrap plan: file boundary, runtime-data policy, API base URL, staging validation, rollback, owners. | Plan exists; no backend files are deleted from this repo; execution is gated by P0 acceptance. |
| `backend-repo-bootstrap-copy-and-validate` | **Blocked / P1 gated** | DevOps + backend owner | Copy backend runtime into separate repo and validate staging without cutting over current repo. | Only starts when P0 is green or explicitly waived by RPO; current repo remains runnable. |
| `db-migration-rfc` | **Ready / P1** | Architecture / backend | Design future DB migration without implementing it. Cover users, schools, orgs, memberships, post audience, post metadata, audit logs, AI drafts. | RFC explains migration order and what remains JSON/JSONL for now. |
| `frontend-modernization-rfc` | **Later / P2 planning** | Frontend architecture | Plan but do not implement a future frontend modernization path. | RFC only; no framework migration in this sprint. |

Explicit go/no-go for backend repo split:

Go only if:

- canonical validation state is recorded;
- Publish V2 browser acceptance passes;
- NodeBB detail/profile/messages live acceptance passes;
- Audience write-side minimum enforcement is implemented or explicitly waived by RPO;
- Map road raw-preview policy is resolved;
- active docs/task-board are consistent;
- current repo remains runnable;
- secrets and local runtime data are not included in split outputs.

No-go if:

- Publish V2 has blocking bugs;
- saved/liked/messages fail in a live NodeBB session;
- audience can be forged from the frontend;
- smoke status remains contradictory without a reviewer waiver;
- raw map road preview appears on the student-facing map;
- backend staging and rollback ownership are unclear.

Paused until this sprint closes:

- place pages;
- food map;
- merchant objects;
- delivery / errands;
- task market;
- drone / low-altitude delivery;
- points / rewards / redemption;
- full organization admin platform;
- full PostgreSQL migration implementation;
- frontend framework migration implementation;
- Express/Fastify migration;
- Map v2 building/floor editor;
- recommendation strategy redesign.

### LLM 客服对接商家接单模块 + 美术资源处理

Scope: 开发 LLM 作为客服对接商家接单的模块；处理美术资源。

Status: **Later / Paused by RPO** - not part of the Release Baseline Stabilization Sprint. Keep as future product planning only; do not implement until Publish/Audience/Messages/Map baseline and repo split readiness are accepted.

### 外卖配送骑手模块

Scope: 增加外卖配送场景下骑手端的模块，包括骑手注册/接单/配送状态流转/轨迹/结算等。

Status: **Later / Paused by RPO** - delivery/rider work is explicitly paused. Do not design or implement until food/place/merchant foundations, governance, and transaction-risk policy exist.

### P0: Publish/Profile/NodeBB Regression Fix

Task doc: `docs/agent/tasks/p0-publish-profile-nodebb-regression-fix.md`

Handoff: `docs/agent/handoffs/p0-publish-profile-nodebb-regression-fix.md`

Source: manual browser review reported by the user on 2026-05-03.

Goal: fix runtime regressions in the already-implemented Publish V2, profile activity, NodeBB like/save, saved/liked lists, and reply messages flows.

Observed bugs:

- Publish page topbar/back button remains visible after leaving or completing publish.
- Publish V2 still waits on a visible `下一步` button after images instead of immediately entering Map v2 location picking.
- Profile `浏览记录` appears or expands without click and pushes away `我的收藏` / `赞过`.
- Detail like UI does not match the feed-card red-heart pattern.
- Feed-card like state is not durable/toggle-safe; second click attempts to like again.
- Bookmark toggle can return `You have already bookmarked this post`.
- Profile `我的收藏` and `赞过` return empty even though saved/liked content exists.
- Replies should enter messages as discussion/reply items, not generic system messages.

Status: **Partially accepted / P0 remainder** - user browser validation passed for like/unlike, save/unsave, report, profile saved list, profile liked list, and browsing history on 2026-05-03. Remaining validation is reply discussion messages and actor identity using the user's current selected identity. Publish flow is tracked separately by `publish-v2-final-browser-acceptance`.

Acceptance: see the task doc and handoff. This task requires browser/manual validation with a logged-in user and a reachable NodeBB instance; `node --check` alone is not enough.

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

Status: **Phase 0.5 Done / gated for Phase 1** - API contract frozen. `LIAN_API_BASE_URL` configured in `app-utils.js`, `map-v2.js`, `map-v2-editor.js`. Set `window.LIAN_API_BASE_URL` before scripts to point at remote backend. Ready for backend repo bootstrap, but do not remove `server.js`, `src/server/*`, or server-owned data from this repo until backend staging validates Publish V2 and Messages.

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

Changed files: `docs/agent/03_FILE_OWNERSHIP.md`, `docs/agent/05_TASK_BOARD.md`, `CLAUDE.md`, `.gitignore`, `docs/agent/references/DOC_CLEANUP_AUDIT_2026-05-03.md` (new), `docs/agent/PROJECT_FILE_INDEX.md` (new), `docs/agent/README.md`

Status: **Done / Accepted** - reviewer validation completed on 2026-05-03.

Validation:

- `PROJECT_FILE_INDEX.md`, `README.md`, and `03_FILE_OWNERSHIP.md` are ASCII-only.
- Mojibake pattern search returned no matches for the reviewed docs.
- Source-of-truth order is consistent between `README.md` and `PROJECT_FILE_INDEX.md`.
- `public/tools/` repo split ownership is consistent: frontend repo, backend provides API only.
- `data/user-cache.json` is classified as local runtime cache / never commit and is listed in `.gitignore`.
- `hard-review` conflict level is defined.
- `node scripts/validate-project-structure.js` passed: 43 passed, 0 failed.

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
| C | Publish UX | `docs/agent/tasks/publish-v2-page.md` | **P0 Browser acceptance required** | A + B recommended | Confirm images -> immediate Map v2 picker; uploads/AI run in background; user confirms publish |
| D | Audience correctness | `docs/agent/tasks/audience-auth-hydration.md` | **Done** | B recommended | Accepted in reviewer rerun 2026-05-03. `test-audience-hydration` passed 61/61. Full integration setup is still separate because it mutates NodeBB/data. |
| E | NodeBB contracts | `docs/agent/tasks/nodebb-contract-smoke-tests.md` | **Done** | B recommended | Accepted in reviewer rerun 2026-05-03. Remote smoke passed 4/4 with network access. |
| F | Messages discussion | `docs/agent/tasks/lane-f-messages-review-rerun.md` | **P0 pending reviewer rerun** | D + E + frontend smoke | Runtime findings appear fixed, but acceptance is blocked until frontend smoke is reproducible or explicitly waived by reviewer. |
| G | Channel safety | `docs/agent/tasks/channel-messages-audience-filtering.md` | **Done / P3 follow-up** | D | Accepted. Follow-up: `/api/channel` slices topics before audience filtering, so pages may under-fill when hidden topics are skipped. Do not fix in the current P0 batch. |
| H | Map v2 picker safety | `docs/agent/tasks/map-v2-bounds-picker-validation.md` | **Done** | B recommended | Accepted in reviewer rerun 2026-05-03. Bounds validation passes with 0 errors. |
| I | Map v2 editor continuation | `docs/agent/tasks/map-v2-admin-editor.md` | **Human-assisted only / Later** | H + human approval | Claude Code may not independently develop this line. Requires human map/design input and intermediate human review. |

Deferred follow-up:

- **P3 Channel pagination under-fill**: `handleChannel()` currently slices topics before audience filtering. This can return fewer than `limit` visible messages when hidden topics are skipped. Do not fix in the current P0 batch; schedule a narrow backend task later to over-fetch before filtering.
- **External Frontend Mock API Layer**: belongs to `lian-frontend`. Do not create `scripts/verify-mock.js` in `lian-mobile-web` just to satisfy stale references.

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

Status: **Human-assisted only**.

Risk: medium-high. Map data and editor affect location picking, and previous map-data loss shows this line needs human-supervised changes.

Acceptance: editor can preview assets, validate bounds, and save valid locations/routes/areas.

### Task: Map v2 Road Network Import Preview

Task doc: `docs/agent/tasks/map-v2-road-network-import-preview.md`

Handoff: `docs/agent/handoffs/map-v2-road-network-import-preview.md`

Goal: render the exported public-map road network as a Map v2 admin/editor preview layer, then let the human drag-align it against the Gaode/base map.

Human input provided:

- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/junctions.csv`
- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lane_nodes.csv`
- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lanes.csv`
- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lanes.geojson`
- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/road_network_summary.json`
- `F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/roads.csv`

Required behavior:

- preview road/lane/junction overlay in `/tools/map-v2-editor.html`;
- drag-align the whole road network as one group;
- expose transform controls or at least export transform values;
- export a draft preview JSON;
- do not automatically overwrite `data/map-v2-layers.json`.

Status: **Human-assisted only / policy review required** - imported road preview must be reviewed by a human. RPO policy: raw road-network preview is admin/editor only; normal student exploration must not show raw road overlay. Implementation must be adjusted or explicitly accepted against that policy.

Acceptance: road-network preview is visible in `/tools/map-v2-editor.html`, can be dragged/aligned/exported, and does not write official map data. Student-facing `/` must not show raw road overlay unless a separate curated/published route layer is approved.

### Task: Map v2 Admin Editor

Task doc: `docs/agent/tasks/map-v2-admin-editor.md` (revised 2026-05-02)

Handoffs: `docs/agent/handoffs/admin-editor-v1.md`, `docs/agent/handoffs/road-draw-mvp.md`, `docs/agent/handoffs/road-junctions-phase1b.md`, `docs/agent/handoffs/curves-route-semantics-phase1c.md`, `docs/agent/handoffs/asset-placement-phase2.md`

Goal: expand the internal map editor. V1 backend/data model is implemented. Phase 1A road draw MVP completed. Phase 1B junctions completed. Phase 1C curves completed. Phase 2 asset placement completed: "放置" mode, image upload (Cloudinary), click-to-place, drag-to-reposition, asset properties panel, `assets[]` data model with server normalization.

Remaining phases:
- Phase 3: building group hierarchy

Human-assistance rule: Phase 3 and any further Map editor implementation must not be independently implemented by Claude Code. A human must provide/approve the building hierarchy scope and review intermediate editor output.

Status: **Done / Phase 2 accepted; Phase 3 human-assisted later** - road draw, junctions, curves, and asset placement phases are accepted as completed work. Building group hierarchy and any further editor/map implementation are not Ready for independent development and require human-assisted scope approval and review.

Risk: medium-high. It changes admin tooling and map data shape, but should not affect feed or publishing if kept isolated.

Acceptance: admin can draw roads by click-drag, place external assets, manage building group hierarchy, edit properties, and export render spec.

### Task: Map v2 Render Workflow

Task doc: `docs/agent/tasks/map-v2-render-workflow.md`

Goal: support export of structured map specs to external AI/design renderers, upload/bind rendered outputs, preview with live overlays, and publish/rollback map versions.

Status: **Human-assisted only / Later**.

Risk: medium. This is mostly admin/data workflow, but versioning mistakes can break map display.

Acceptance: render spec exports valid JSON without secrets/private user data; rendered output can be previewed and bound to a map version without flattening interactive overlays.

### Task: Map v2 Building And Floor Plan View

Task doc: `docs/agent/tasks/map-v2-building-floor-plan.md`

Goal: let users click a building/building group on the campus map and enter a higher-precision 2D floor/room view with related function posts.

Status: **Human-assisted only / Later**.

Risk: high. This touches frontend map navigation, map data model, post association, and future audience filtering.

Acceptance: overview building click opens a building view, floor selector works, room polygons are clickable, and related posts respect future visibility rules.

### Task: NodeBB Like Feed Card Validation

Task doc: `docs/agent/tasks/nodebb-like-feed-card-validation.md`

Goal: validate the started feed-card like integration against the actual NodeBB instance, confirm endpoint behavior, and decide whether to finish, adjust endpoint fallback, or revert.

Risk: medium. It touches `post-service.js`, `feed-service.js`, `api-router.js`, and frontend card rendering.

Acceptance: clicking the heart toggles NodeBB vote state for the topic's first post, count updates correctly after refresh, and feed ranking remains unchanged.

Status: **Superseded by P0 live acceptance** - this is covered by `nodebb-detail-profile-messages-live-acceptance` and `P0: Publish/Profile/NodeBB Regression Fix`; do not keep a separate Ready task unless a new feed-card-only regression appears.

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

Status: **Superseded by P0 live acceptance** - implementation scope and product semantics are now covered by `nodebb-detail-profile-messages-live-acceptance` and `P0: Publish/Profile/NodeBB Regression Fix`. Keep this section as the product contract, not as a separate Ready implementation task.

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
| Frontend smoke | Not accepted | Reviewer rerun still reports 13/21. Direct `node --check` for each frontend file passes; failure is caused by the smoke harness invoking `node --check` through `execSync()`/shell in this environment. |
| Map validator bounds drift | Fixed | `scripts/validate-locations.js` now uses current base-map bounds `18.37107/109.98464` to `18.41730/110.04775`. Must remain identical to `map-v2-service.js`. |

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

---

## Audit Log

Historical review records. For current status, see "Review Fix Pass" above and per-lane status in the task board.

### Review Blockers: Audience, NodeBB Detail/Profile, Publish V2 (2026-05-03)

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

### Review Blockers: Completed Lanes D/E/G/H (2026-05-03)

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
| H Map v2 Bounds | Accepted | Bounds constants must match between `map-v2-service.js`, `validate-locations.js`, `public/map-v2.js`, and `public/tools/map-v2-editor.js` using current base-map bounds `18.37107/109.98464` to `18.41730/110.04775`. |

Shared validation issue (current reviewer result):

- `node scripts/smoke-frontend.js` still reports 13/21 in the reviewer environment. Direct frontend `node --check` commands pass. Treat this as an open smoke-harness issue until fixed or explicitly scoped.

Related task docs:

- `docs/agent/tasks/audience-auth-hydration.md`
- `docs/agent/tasks/nodebb-contract-smoke-tests.md`
- `docs/agent/tasks/channel-messages-audience-filtering.md`
- `docs/agent/tasks/map-v2-bounds-picker-validation.md`
- `docs/agent/tasks/frontend-stability-smoke.md`

### Reviewer Rerun: Pending Items (2026-05-03)

Scope reviewed:

- Lane D Audience Auth Hydration
- Lane E NodeBB Contract Smoke
- Lane F Messages Discussion / Notifications
- Lane G Channel Audience Filtering
- Lane H Map v2 Bounds
- top-level Frontend Mock API Layer status (confirmed external to `lian-mobile-web`)

Commands run:

```bash
node scripts/test-audience-hydration.js
node scripts/smoke-nodebb-contracts.js
node scripts/validate-locations.js
node scripts/test-routes.js
node scripts/smoke-frontend.js http://localhost:4100
node --check public/app-state.js
node --check public/app-utils.js
node --check public/app-auth-avatar.js
node --check public/app-feed.js
node --check public/app-legacy-map.js
node --check public/app-ai-publish.js
node --check public/app-messages-profile.js
node --check public/app.js
```

Result:

| Item | Review result | Notes |
|---|---|---|
| Lane D Audience Auth Hydration | Accepted | `test-audience-hydration` passed 61/61. Full `setup-audience-test && test-audience` was not run because setup creates remote/local test data. |
| Lane E NodeBB Contract Smoke | Accepted | Passed 4/4 against remote NodeBB when network access was allowed. |
| Lane F Messages Discussion | Not accepted | Backend error state and metadata-missing audience branch are present, but frontend smoke still fails due harness shell invocation. |
| Lane G Channel Audience Filtering | Accepted with follow-up | Filtering exists; pagination may under-fill because slicing happens before filtering. |
| Lane H Map v2 Bounds | Accepted | `validate-locations` returned `ok: true`, 0 errors. |
| Frontend Mock API Layer | Out of scope | Confirmed as `lian-frontend` repo work; missing `scripts/verify-mock.js` is not a blocker for `lian-mobile-web`. |

Open blockers:

1. Fix `scripts/smoke-frontend.js` so syntax checks do not rely on shell execution that fails in the reviewer environment. Prefer `spawnSync(process.execPath, ["--check", fullPath], { shell: false })`.
2. Browser/manual checks still remain for Publish V2 and NodeBB detail/profile actions.

### Review Blockers: Lane F Messages Discussion (2026-05-03)

Scope reviewed:

- `src/server/notification-service.js`
- `scripts/smoke-frontend.js`
- `docs/agent/tasks/nodebb-reply-notifications-messages.md`
- `docs/agent/handoffs/nodebb-reply-notifications-messages.md`

Current decision: historical blocker record. See "Reviewer Rerun: Pending Items (2026-05-03)" above for current status.

Findings:

| Finding | Severity | Status | Required fix |
|---|---|---|---|
| `/api/messages` silently returns `{ items: [] }` for NodeBB/auth/API failures | P2 | Fixed in code / pending smoke | Backend returns `{ items: [], error: "notification_fetch_failed" }`, and `public/app-messages-profile.js` now displays a safe notification-load failure state. |
| Notifications tied to topics without metadata bypass audience filtering | P2 | Fixed in code / pending smoke | `notification-service.js` now calls `canViewPost()` for metadata-missing topics using legacy-public defaults. |
| Frontend smoke claim is not reproducible in reviewer environment | P2 | Open | Smoke harness still reports 13/21 because syntax checks shell through `execSync`. Direct `node --check` passes. |

Notes:

- Direct frontend syntax checks pass, so the smoke failure appears harness/environment-specific, but the Lane F handoff's 21/21 claim is not accepted in this reviewer environment.
- Guest `/api/messages` returns `{ items: [] }`, which is acceptable for guests.
- `node scripts/test-routes.js` passes 61/61.
- Do not close Lane F until the smoke status is reproducible or explicitly scoped as a known harness limitation.
- Executor thread should fix only the smoke documentation/path or smoke harness. Do not add private chat, mark-read, push notifications, reply highlight, or notification type redesign in this lane.
- Reviewer thread should re-check guest behavior, route tests, and the smoke-script limitation before moving Lane F out of `Blocked`.

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
