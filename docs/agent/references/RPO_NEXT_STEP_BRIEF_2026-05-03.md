# RPO Next-Step Brief

Date: 2026-05-03

Purpose: give RPO enough current context to decide how LIAN should arrange the next development and refactor phase.

This brief is intentionally written in ASCII-only English because several older project docs still contain mojibake. It should be safe to copy into another reviewer or planning thread.

---

## 1. Executive Summary

LIAN is no longer a single-file prototype. It is now a NodeBB-backed campus product layer with:

- NodeBB as the content/community system of record.
- LIAN server services for feed, metadata, auth/session, AI publish, audience, Map v2, upload proxy, and NodeBB adapters.
- A split classic-script mobile frontend under `public/`.
- Internal admin tools under `public/tools/`.
- JSON/JSONL product and runtime data under `data/`.
- Agent coordination docs under `docs/agent/`.

The strongest current recommendation is:

```text
Stabilize and verify before expanding.
```

The next phase should not prioritize new product areas such as food map, errands, task market, drone, full org platform, or broad recommendation changes. The project needs a stable baseline first:

1. Finish reviewer acceptance for Publish V2, NodeBB profile actions, Messages, and frontend smoke.
2. Clean remaining mojibake and stale task-board status.
3. Decide repo split timing and backend bootstrap scope.
4. Tighten audience write-side checks without expanding to full organization administration.
5. Keep Map v2 development human-assisted only.

---

## 2. Current Architecture

Current intended architecture:

```text
NodeBB
  owns topics, posts/replies, users, tags, votes, bookmarks, flags, notifications

LIAN backend in this repo today
  owns feed ranking, metadata, audience, AI draft/publish wrappers,
  map data APIs, upload proxy, auth/session mapping, NodeBB adapters

LIAN frontend in public/
  owns mobile UI, feed/detail, publish page, messages/profile,
  Map v2 viewer/picker, internal admin tools

docs/agent/
  owns task planning, architecture decisions, handoffs, review state
```

Source-of-truth by object:

| Object | Current source of truth | Notes |
|---|---|---|
| Topic/reply body | NodeBB | LIAN should not rebuild forum storage. |
| Feed ranking | LIAN backend | `src/server/feed-service.js`, `data/feed-rules.json`. |
| Post metadata | LIAN data file | `data/post-metadata.json`; high-risk product database. |
| Audience rules | LIAN backend/data | `src/server/audience-service.js` + metadata/audience fields. |
| User/session | LIAN auth + NodeBB uid mapping | `auth-users.json` local runtime, not committed. |
| Location objects | LIAN data file | `data/locations.json`. |
| Map v2 layers | LIAN data file | `data/map-v2-layers.json`. |
| Images | Cloudinary / image proxy | LIAN stores URLs, not image binaries. |
| AI drafts/records | JSONL | `data/ai-post-drafts.jsonl`, `data/ai-post-records.jsonl`; local generated records. |

---

## 3. Current File Organization

Reference: `docs/agent/PROJECT_FILE_INDEX.md`.

Important active file groups:

| Area | Files | Split target | Risk |
|---|---|---|---|
| Backend entry | `server.js`, `src/server/*` | backend repo | high |
| Frontend app | `public/*.js`, `public/index.html`, `public/styles.css` | frontend repo | medium-high |
| Admin tools | `public/tools/*` | frontend repo | medium |
| Product data | `data/post-metadata.json`, `data/feed-rules.json`, `data/locations.json`, `data/map-v2-layers.json` | backend repo | high |
| Runtime/local data | `data/auth-users.json`, `data/channel-reads.json`, `data/user-cache.json`, JSONL records | backend runtime only | high if committed |
| Validation scripts | `scripts/*` | mostly backend repo, with frontend smoke exception | medium |
| Coordination docs | `docs/agent/*` | both during transition | medium |

Repo split direction is accepted but destructive split is not yet approved:

```text
Current repo eventually becomes frontend/mobile web workspace.
New backend repo owns server.js, src/server/*, data/*, backend scripts, deployment.
Do not delete backend files from this repo until backend staging validates Publish V2 and Messages.
```

---

## 4. Accepted / Mostly Accepted Work

These areas are substantially complete or accepted at architecture level:

| Area | Status | Notes |
|---|---|---|
| NodeBB-backed feed | Done | Feed from NodeBB, normalized by LIAN. |
| Feed optimization | Done | Hybrid curated/ranked feed; do not tune further now. |
| Feed observability | Done | `/api/feed-debug`, snapshots, metadata validation. |
| AI post preview | Done | Mock/MiMo draft generation, no auto publish. |
| AI light publish backend | Mostly done | User-confirmed publish through NodeBB path. |
| Frontend app split | Done | Classic-script split; no framework/bundler now. |
| Map v2 MVP/editor | Done at MVP level | Gaode tiles, overlays, editor; further work is human-assisted. |
| Audience read-side hydration | Accepted with follow-up | `hydrateAudienceUser()` and `canViewPost()` exist. |
| NodeBB contract smoke | Accepted | Remote endpoint smoke passed when network access allowed. |
| Channel audience filtering | Accepted with P3 follow-up | Pagination can under-fill. |
| Documentation core index cleanup | Accepted | `PROJECT_FILE_INDEX.md`, `README.md`, `03_FILE_OWNERSHIP.md` validated ASCII-only. |

---

## 5. Work Still Waiting For Review Or Manual Acceptance

The following should not be called product-complete until manual/reviewer checks pass:

| Area | Current issue | Required RPO/reviewer decision |
|---|---|---|
| Publish V2 Page | User later confirmed main transition passed, but task board may still show pending status. | Decide if accepted after one final browser pass. |
| NodeBB Detail Actions & Profile Activity | Like/save/report/profile lists depend on live NodeBB/user sessions; user previously saw empty saved/liked lists and toggle issues. | Require live browser test with logged-in user. |
| Messages / reply notifications | Replies should appear as discussion/reply items, not private chat. Backend/frontend fixes reported, but smoke/review state is mixed. | Decide whether to run a focused Lane F rerun. |
| Frontend smoke harness | Recent summary says 21/21 passed, but older task-board audit still says 13/21. | Re-run and update task board to one canonical result. |
| Map v2 road network preview | Implementation reportedly renders road network in exploration page and editor, but task scope said admin/editor preview only. | RPO must decide whether student exploration page should show raw road overlay. |
| Remaining docs mojibake | Core docs are clean, but `00_AGENT_RULES.md` and some task-board historical sections still contain mojibake. | Decide whether to run a broader docs cleanup pass before repo split. |

---

## 6. Current High-Risk Areas

These should not be refactored casually:

1. `data/post-metadata.json`
   - Acts as product database for feed, metadata, map linkage, images, AI publish trace, visibility, and distribution.
   - Requires validator, backup, and patch-only discipline.

2. `src/server/post-service.js`
   - Shared by normal `/api/posts` and AI publish.
   - NodeBB topic creation, HTML body construction, like/save/report, reply handling are coupled.

3. `src/server/feed-service.js`
   - Ranking, diversity, curated pages, moment feed, debug output.
   - Do not combine feed scoring changes with product fixes.

4. `src/server/audience-service.js`
   - Read-side exists; write-side enforcement is not fully wired.
   - Risk: writing audience a user should not be allowed to choose.

5. `src/server/api-router.js`
   - Route table/dispatcher is central.
   - Route tests exist; framework migration is deferred.

6. Frontend classic script order
   - `public/index.html` load order is still architecture.
   - Do not convert to ESM/framework in same phase as product work.

7. Map v2 spatial data
   - Previous bounds/data-loss risk.
   - Human-assisted only for geometry, roads, assets, building hierarchy, render workflow.

---

## 7. Product/Architecture Decisions Already Made

Active decisions:

- NodeBB remains the content/community backend.
- LIAN owns the campus experience layer: feed, map, metadata, AI draft, audience.
- AI suggestions are draft-only. No AI auto-publish, no AI auto-review.
- Publish V2 is a dedicated page named "Publish", not "AI light publish".
- Publish V2 should support multi-image upload, immediate Map v2 location picking, user-confirmed audience.
- Map v2 is implemented as MVP and evolves into a spatial asset system.
- Map development requires human assistance.
- Repo split direction accepted, but destructive split is gated.
- Stabilize before expanding.

Explicitly paused for this phase:

- new recommendation strategy or personalization;
- LLM auto-publish or auto-review;
- place pages and food maps;
- task market, errands, delivery, drones;
- complex Map v2 editor continuation without human review;
- broad UI redesign;
- NodeBB rewrite;
- Express/Fastify migration;
- full PostgreSQL migration;
- full organization permission platform.

---

## 8. Main Options For Next Phase

### Option A: Stabilization Sprint

Focus: verify and fix the current product baseline.

Work:

- Re-run frontend smoke, route tests, audience hydration tests, metadata validation.
- Browser test Publish V2, like/save/report/profile, reply messages.
- Clean remaining mojibake in active docs/task board.
- Update task-board statuses to match actual reviewer results.
- Fix only blocking runtime bugs found by those checks.

Pros:

- Lowest risk.
- Makes current work shippable.
- Makes repo split safer.

Cons:

- Less visible new product scope.

Recommended if RPO wants a stable release baseline.

### Option B: Repo Split Bootstrap

Focus: create backend repo while keeping current repo runnable.

Work:

- Freeze/verify API contract.
- Copy backend files to new repo.
- Configure frontend API base URL.
- Validate backend staging against Publish V2, feed, detail, messages, map.
- Do not delete backend files from current repo yet.

Pros:

- Aligns with long-term ownership.
- Reduces future conflict between frontend/backend work.

Cons:

- Doubles debugging surfaces if current baseline is still unstable.
- Requires deployment discipline.

Recommended only after Option A smoke/manual checks are green or explicitly waived.

### Option C: Product Expansion

Focus: new product surface, such as food map, place pages, merchants, delivery/rider, task market.

Pros:

- Visible progress.

Cons:

- High risk now.
- Builds on unstable publish/messages/audience/map foundations.

Not recommended for the next immediate phase.

### Option D: Structural Refactor

Focus: framework migration, database migration, TypeScript/Vite, route framework, PostgreSQL.

Pros:

- Long-term maintainability.

Cons:

- Too broad for current state.
- Can break product flows before baseline acceptance.

Not recommended now. Consider only after release baseline and repo split staging are stable.

---

## 9. Recommended Next Two Weeks

### Week 1: Acceptance And Cleanup

1. Re-run:
   - `node scripts/validate-project-structure.js`
   - `node scripts/test-routes.js`
   - `node scripts/test-audience-hydration.js`
   - `node scripts/smoke-frontend.js http://localhost:4100`
   - `node scripts/validate-post-metadata.js`
   - `node scripts/validate-locations.js`

2. Manual browser tests:
   - Publish V2 multi-image path.
   - Publish V2 choose/skip location.
   - Publish V2 final metadata and detail/feed visibility.
   - Like/unlike persistence.
   - Save/unsave persistence.
   - Saved/liked/history profile lists.
   - Reply messages actor identity and discussion label.

3. Docs:
   - Clean remaining active mojibake in `00_AGENT_RULES.md` and task-board current sections.
   - Mark task-board items accepted/rejected based on actual review.
   - Keep historical audit logs but stop letting them override current status.

4. Fix only blockers discovered by the above.

### Week 2: Controlled Backend Repo Bootstrap

Only start if Week 1 is green or explicitly waived:

1. Create backend repo skeleton.
2. Copy backend runtime files without behavior changes.
3. Keep current repo runnable.
4. Point frontend to backend staging via API base URL.
5. Validate feed, detail, publish, messages, auth/me, upload, map.
6. Do not migrate database, framework, or frontend build system yet.

---

## 10. Decisions RPO Should Make

RPO should answer these before assigning the next implementation batch:

1. Is the immediate priority release stabilization or backend repo bootstrap?
2. Can Publish V2 be marked accepted after one final browser pass?
3. Should NodeBB profile saved/liked lists rely on NodeBB endpoints only, or keep LIAN `data/user-cache.json` as fallback?
4. Should reply actor display use the user's current selected identity at reply time as the durable source?
5. Should road-network preview appear only in admin editor, or also on student exploration map?
6. Is it acceptable to leave historical mojibake in audit logs, or should all active docs be ASCII/UTF-8 cleaned before repo split?
7. Should audience write-side minimum enforcement be implemented before any new product surface?
8. When repo split begins, who owns deployment/reverse-proxy validation?
9. Should frontend stay classic-script until after repo split, or start a separate frontend modernization plan later?
10. What is the next public product demo target: Publish baseline, Map v2, Messages/discussion, or repo split infrastructure?

---

## 11. Suggested RPO Decision

Recommended decision:

```text
Run one stabilization sprint first.
Do not expand product scope.
Do not destructively split repos yet.
Accept only reviewer-verified tasks.
Then bootstrap backend repo as a copy-and-validate phase.
```

Rationale:

- The core product loop is close: upload images -> pick location -> AI draft -> user publish -> NodeBB topic -> metadata -> feed/detail/map.
- The remaining problems are not new-feature gaps; they are verification, identity, persistence, message semantics, docs cleanliness, and repo-boundary risks.
- A stable baseline will make every later product line cheaper: place pages, food map, audience platform, merchant/customer-service, delivery, and map asset system.

---

## 12. Minimal Task Batch To Assign Next

If RPO accepts the recommendation, assign these narrow tasks:

1. `stabilization-final-review`
   - Owner: reviewer/Codex.
   - Output: accepted/rejected status for Publish V2, NodeBB detail/profile, Messages.

2. `docs-active-mojibake-cleanup`
   - Owner: docs thread.
   - Scope: active docs only, no runtime code.

3. `audience-write-side-minimum-audit`
   - Owner: backend implementation thread.
   - Scope: audit first, implement only public/campus/school/private defaults if approved.

4. `backend-repo-bootstrap-plan`
   - Owner: architecture/devops.
   - Scope: copy-and-validate plan, no deletion.

5. `map-road-network-human-review`
   - Owner: human-assisted map thread.
   - Scope: decide admin-only vs student-facing road overlay and alignment workflow.

