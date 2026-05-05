# LIAN Pro Review Brief

Date: 2026-05-03

Purpose: this document is the handoff package for Pro-level judgment. It summarizes the current project structure, ownership boundaries, workflow rules, accepted work, blockers, and decisions that need product/architecture approval. It is intended to be readable without prior chat history.

## 1. Current Product Shape

LIAN is a campus life information platform for the Hainan Lingshui Li'an International Education Innovation Pilot Zone.

Current product model:

```text
NodeBB content system of record
-> LIAN mobile web experience layer
-> feed / detail / map / publish / messages / profile
-> LIAN metadata, audience rules, map data, recommendation rules
```

The strongest product direction is no longer "official notification aggregation". Internal feedback shows that students respond better to:

- real student photos and local campus moments;
- food, routes, useful reminders, space memories, campus weirdness/texture;
- lightweight location-aware exploration;
- feed browsing first, map exploration second;
- low-friction publishing with user-confirmed location, time, audience, and tags.

Non-negotiable current constraints:

- NodeBB remains the backend content base for topics, replies, users, tags, flags, bookmarks, and votes.
- LIAN owns recommendation, metadata, audience projection, map layer, and mobile UI.
- AI may draft and suggest metadata, but must not auto-publish.
- User must confirm before public or campus-visible publishing.
- Handoffs are not acceptance. Only reviewer validation updates the task board.

## 2. Repository Boundary

Current repo:

```text
F:/26.3.13/lian-mobile-web
```

Current repo still contains both frontend and backend:

```text
lian-mobile-web/
  server.js
  src/server/
  public/
  data/
  scripts/
  docs/agent/
  outputs/
```

Strategic decision already recorded:

```text
current repo should become frontend/mobile web workspace
complete backend/server/data integration should move to a separate backend repo
```

P0 split status:

- API contract freeze is mostly done.
- `LIAN_API_BASE_URL` has been added in frontend utilities.
- Backend repo bootstrap has not yet been completed.
- Do not remove backend files from this repo until backend repo is validated.

Out-of-scope clarification:

- `lian-frontend` is a separate frontend repo/thread.
- Frontend Mock API Layer belongs to `lian-frontend`, not this main repo.
- Missing `scripts/verify-mock.js` in `lian-mobile-web` is not a blocker for this repo.

## 3. Current Runtime Architecture

### 3.1 Server Entry

- `server.js` is the Node HTTP entry.
- `src/server/api-router.js` is the central route dispatcher.
- No Express/Fastify framework.
- Routing is manual and protected by `scripts/test-routes.js`.

Core backend modules:

```text
admin-routes.js
ai-light-publish.js
ai-post-preview.js
alias-service.js
api-router.js
audience-service.js
auth-routes.js
auth-service.js
cache.js
channel-service.js
config.js
content-utils.js
data-store.js
feed-service.js
http-response.js
image-proxy.js
map-v2-service.js
nodebb-client.js
notification-service.js
post-service.js
request-utils.js
route-matcher.js
static-data.js
static-server.js
upload.js
```

### 3.2 Frontend

Frontend is classic-script, not bundled.

Main files:

```text
public/index.html
public/styles.css
public/app-state.js
public/app-utils.js
public/app-auth-avatar.js
public/app-feed.js
public/app-legacy-map.js
public/app-ai-publish.js
public/app-messages-profile.js
public/publish-page.js
public/map-v2.js
public/app.js
```

Internal map editor:

```text
public/tools/map-v2-editor.html
public/tools/map-v2-editor.css
public/tools/map-v2-editor.js
```

Legacy/prototype files still present:

```text
public/menu-prototype*.*
public/menu-data.json
```

These need explicit lifecycle labels during documentation cleanup.

### 3.3 Data

Important `data/` files:

```text
feed-rules.json           recommendation rules and feed tabs
post-metadata.json        LIAN topic metadata, audience, map/distribution fields
locations.json            place/location records
map-v2-layers.json        Map v2 layers and geometry
auth-users.json           local LIAN auth/user state
channel-reads.json        local channel read counts
ai-post-drafts.jsonl      local AI draft records
ai-post-records.jsonl     local AI publish records
alias-pool.json           identity alias pool
clubs.json                club seed/discovery data
```

Risk: `data/` mixes committed product data, local runtime state, generated records, and backups. This is a P0 documentation cleanup item before repo split.

## 4. Current Feature State

### Feed

Status: implemented and accepted at feature level.

Current flow:

```text
NodeBB recent/topics
-> normalize topic
-> merge post-metadata.json
-> apply feed-rules.json
-> curated slots + ranked rest
-> eligibility/filtering/scoring/diversity
-> hydrate details
-> mobile feed
```

Supported:

- "此刻" and recommendation/category tabs.
- Feed debug API.
- Snapshot/diff tooling.
- Metadata validation.

Known direction:

- Do not add more recommendation strategy until observability/docs are stable.
- Future personalization should be event/profile based, but not now.

### Publish

Status: implemented, still needs browser/manual acceptance.

Current behavior:

```text
select images
-> immediately enter Map v2 location pick
-> image upload continues in background
-> AI preview waits for upload result
-> user edits title/body/tags/audience
-> user confirms publish
-> NodeBB topic + LIAN metadata
```

Important accepted product correction:

- Image selection must lead to map picking before AI drafting.
- Upload and AI latency should overlap with user choosing location.

Remaining validation:

- multi-image success/failure path;
- audience picker survives AI preview/regenerate;
- final payload writes correct metadata;
- browser check required.

### Audience

Status: Lane D accepted for hydration/read-side correctness.

Current accepted subset:

- `hydrateAudienceUser()`
- `canViewPost()`
- `canReplyToPost()`
- `canModeratePost()`
- `canCreatePostWithAudience()`
- `canSeeAudienceOption()`

Validation:

- `node scripts/test-audience-hydration.js` passed 61/61.

Important limitation:

- Full integration setup `node scripts/setup-audience-test.js && node scripts/test-audience.js` was not run in review because setup mutates local/remote test data.
- Write-side permission enforcement is not fully wired. Phase 4 remains future work.

### NodeBB Detail/Profile Actions

Status: implemented, still needs browser/manual acceptance.

Implemented:

- detail save/bookmark;
- detail like/upvote;
- report/flag;
- profile history/saved/liked lists;
- audience check before action endpoints.

Validation:

- NodeBB contract smoke passed 4/4 with remote network access:
  - notifications;
  - topic detail;
  - user bookmarks;
  - user upvoted.

Remaining validation:

- manual browser check for actual save/like/report/profile behavior.

### Messages

Status: Lane F blocked.

Implemented intent:

- Messages page has channel and notification tabs.
- Channel is timeline discussion, not private chat.
- Notification service fetches NodeBB notifications with Bearer auth.
- Guests get empty notifications.
- Topic-tied notifications are audience-filtered.

Reviewer result:

- Backend error state exists.
- Metadata-missing notification audience branch exists.
- Route tests pass.
- But `scripts/smoke-frontend.js` still fails 13/21 in reviewer environment due harness shell invocation.

Blocking item:

```text
Fix smoke-frontend syntax checks to avoid shell exec.
Recommended: spawnSync(process.execPath, ["--check", fullPath], { shell: false })
```

### Channel

Status: Lane G accepted with follow-up.

Current behavior:

- `/api/channel` resolves optional viewer.
- Filters topic visibility with `canViewPost(viewer, post, "map")`.

Follow-up:

- It slices topics before audience filtering, so a page can under-fill if hidden topics are skipped.
- P3, not current blocker.

### Map v2

Status: bounds/picker safety accepted.

Current:

- Map v2 layers/data in `data/map-v2-layers.json`.
- Approved product bounds:

```text
SW 18.373050 / 109.995380
NE 18.413856 / 110.036262
```

Validation:

- `node scripts/validate-locations.js` returned `ok: true`, 0 errors.

Map editor:

- internal tool exists;
- grass/tiles/layers/asset placement work exists;
- editor continuation is later, not blocking Publish.

## 5. Validation Status

Reviewer commands already run:

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

Results:

| Check | Result | Notes |
|---|---|---|
| Audience hydration | Pass | 61/61 |
| NodeBB contract smoke | Pass | 4/4 with network access |
| Location validation | Pass | 0 errors, warnings only for unknown `location` type |
| Route tests | Pass | 61/61 |
| Direct frontend syntax checks | Pass | all checked files pass |
| `scripts/smoke-frontend.js` | Fail | 13/21 due shell `execSync` syntax-check harness |

## 6. Current Task Board Summary

Accepted:

- Lane D Audience correctness
- Lane E NodeBB contracts
- Lane G Channel safety, with P3 pagination follow-up
- Lane H Map v2 picker safety

Blocked:

- Lane F Messages discussion, blocked by smoke harness reproducibility.

Verify/fix:

- Lane C Publish UX, browser/manual checks still required.

External:

- Frontend Mock API Layer, belongs to `lian-frontend`.

P0 Ready:

- Repo split frontend/backend.
- Project file index and documentation cleanup.

## 7. Workflow Rules

The project uses a split-thread workflow:

| Stage | Owner | Output |
|---|---|---|
| Product/architecture planning | Codex/code | task doc, scope, allowed files, validation commands |
| Runtime implementation | Claude Code | patch, command output, handoff |
| Review/acceptance | Codex/code | findings, accepted/rejected status, task board update |

Rules:

- Claude Code handoff is not acceptance.
- Codex/code review must rerun commands or explicitly state why not run.
- If a task touches forbidden files or expands scope, executor must stop and return to planning.
- Documentation must distinguish current truth from historical blocker logs.
- Do not mix large refactors with feature fixes unless Pro explicitly approves.

## 8. Immediate Engineering Risks

### P1: Smoke Harness Blocks Review

`scripts/smoke-frontend.js` still shells out with `execSync("node --check ...")`.

Impact:

- false 13/21 failure;
- blocks Lane F acceptance;
- makes frontend validation unreliable.

Decision needed:

- approve a tiny fix to use `spawnSync(process.execPath, ["--check", fullPath], { shell: false })`.

### P1: Repo Split Not Yet Executed

The repo still contains frontend, backend, runtime data, docs, outputs, prototypes, and deployment scripts.

Impact:

- agents step on unrelated files;
- hard to reason about ownership;
- frontend/backend deployment and secrets boundaries remain blurred.

Decision needed:

- proceed with backend repo bootstrap as next P0, or first finish docs cleanup.

### P1: Documentation Cleanup Still Needed

Docs still contain stale/historical sections and mojibake in some rendered PowerShell output. The task board has been partially corrected, but full file ownership/index cleanup is not complete.

Decision needed:

- whether to do docs cleanup before repo split, or as part of repo split.

### P2: Audience Write-Side Enforcement

Read-side audience checks are accepted. Write-side `canCreatePostWithAudience()` is not fully enforced in all publish paths.

Decision needed:

- whether Phase 4 must happen before broader internal testing.

### P3: Channel Pagination Under-Fill

`/api/channel` slices before filtering.

Decision needed:

- can defer; not a release blocker unless channel becomes primary surface.

## 9. Pro Decisions Requested

Please decide:

1. Should the next executor task be the minimal `smoke-frontend.js` harness fix?
2. Should repo split proceed before full documentation cleanup?
3. Should `lian-mobile-web` remain temporarily full-stack until backend repo is live, or should new backend work immediately move to a new repo?
4. Is Publish V2 browser/manual acceptance the next product blocker after smoke harness?
5. Should audience write-side enforcement be P1 before internal test, or P2 after Publish V2 stabilizes?
6. Should Channel pagination under-fill be fixed now or tracked as a deferred P3?

## 10. Recommended Next Step

Recommended order:

```text
1. Fix smoke-frontend harness only.
2. Rerun smoke, route, audience hydration, NodeBB contract smoke.
3. Mark Lane F accepted or keep only real runtime blockers.
4. Browser-test Publish V2 and NodeBB detail/profile actions.
5. Complete docs/file ownership cleanup.
6. Bootstrap backend repo.
7. Continue audience write-side enforcement and repo split.
```

Rationale:

- The smoke harness fix is small and removes a false blocker.
- Publish V2 and detail/profile acceptance depend on reliable frontend smoke.
- Repo split should not proceed while docs still confuse current vs historical ownership, unless Pro accepts the risk.
