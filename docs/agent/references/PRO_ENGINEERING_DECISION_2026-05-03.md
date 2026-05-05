# Pro Engineering Decision - 2026-05-03

This document records the current Pro-level engineering decision. Use it as the priority reference for the next implementation threads.

## Executive Decision

LIAN should first stabilize validation, Publish V2, Messages, Audience boundaries, documentation baseline, and repository boundaries.

Do not continue expanding recommendation strategy, LLM automation, place pages, food maps, task-market concepts, or complex Map v2 editor work until the current baseline is reproducible and accepted.

Current engineering theme:

```text
Make existing features reviewable, reproducible, distributable across threads, and ready for repo split.
```

## Architecture Judgment

The architecture direction is valid:

```text
NodeBB: topics, replies, users, tags, flags, bookmarks, votes, categories, moderation primitives
LIAN mobile web: feed, detail, map, publish, messages, profile
LIAN server layer: metadata, audience projection, map data, recommendation rules, NodeBB adaptation
```

The current issue is baseline stability:

1. Some implemented tasks still lack reproducible reviewer validation.
2. Some docs and task states do not match current code.
3. Repo split direction is correct, but destructive backend removal is premature.
4. Audience read-side works, but write-side and real campus validation are not closed.
5. Publish V2 is near the core product path and needs browser/manual acceptance.

## Priority Decisions

| Item | Priority | Decision |
|---|---:|---|
| Fix `scripts/smoke-frontend.js` | P0 | Must happen first. The harness must be reproducible in reviewer environment. |
| Lane F messages/notifications | P0 | Code can be re-reviewed, but do not mark accepted until smoke is reproducible or explicitly waived by reviewer. |
| Publish V2 manual browser acceptance | P0 | Next main product validation after smoke. |
| NodeBB detail/profile browser acceptance | P1 | Validate after Publish V2 or in parallel if a separate reviewer is available. |
| Docs/agent cleanup | P1 | Required for multi-thread work and repo split, but should not block smoke or Publish validation. |
| Repo split | P1/P2 | Bootstrap backend repo first. Do not delete backend files from this repo until backend staging validates. |
| Audience write-side minimum audit | P1 | Do a small audit and minimum enforcement plan. Do not build full organization permission platform now. |
| Feed strategy expansion | P3 / paused | Do not add new ranking or personalization strategy now. Observability-only fixes are allowed. |
| Channel pagination under-fill | P3 | Record as follow-up. Not a current blocker. |

## Next Execution Order

1. Fix frontend smoke harness.
   - Task: `docs/agent/tasks/frontend-stability-smoke.md`
2. Rerun Lane F and update task board.
   - Task: `docs/agent/tasks/lane-f-messages-review-rerun.md`
3. Run Publish V2 browser/manual acceptance.
   - Task: `docs/agent/tasks/publish-v2-browser-acceptance.md`
4. Run NodeBB detail/profile browser/manual acceptance.
   - Task: `docs/agent/tasks/nodebb-detail-actions-profile-history.md`
5. Clean docs/agent baseline and source-of-truth order.
   - Task: `docs/agent/tasks/project-file-index-and-doc-cleanup.md`
6. Audit Audience write-side minimum enforcement.
   - Task: `docs/agent/tasks/audience-write-side-minimum-audit.md`
7. Prepare backend repo bootstrap.
   - Task: `docs/agent/tasks/repo-split-frontend-backend.md`

## Allowed Next Tasks

### Task 1: Fix `scripts/smoke-frontend.js`

Goal: remove shell-dependent syntax checks. Prefer:

```js
spawnSync(process.execPath, ["--check", fullPath], { shell: false })
```

Do not touch runtime frontend or server code in this task.

### Task 2: Lane F Reviewer Rerun

Goal: re-check messages/notifications after smoke is fixed.

Acceptance:

- route tests pass;
- frontend smoke status is reproducible or explicitly waived by reviewer;
- guest `/api/messages` returns safe empty items;
- authenticated API failures return safe error state;
- metadata-missing notification topics still run `canViewPost()`.

### Task 3: Publish V2 Browser Acceptance

Goal: verify the real creation path:

```text
image select -> Map v2 location pick -> AI draft -> audience picker -> publish -> NodeBB topic -> metadata -> feed/detail
```

Do not add new UI scope during acceptance.

### Task 4: Docs Baseline Consistency

Goal: normalize:

- task statuses;
- file ownership;
- source-of-truth order;
- `lian-frontend` external scope;
- missing/renamed architecture docs;
- generated/runtime/local data policy.

### Task 5: Audience Write-Side Minimum Audit

Goal: check whether publish paths write safe audience/visibility metadata and whether user-selected audience survives preview/regenerate.

Do not implement full organization permission platform.

## Repo Split Decision

Repo split direction is accepted, but destructive split is not approved yet.

Required phase:

```text
bootstrap backend repo
keep current repo runnable
freeze API contract
validate backend staging
then remove backend ownership from current repo
```

Do not remove `server.js`, `src/server/*`, or server-owned data from `lian-mobile-web` until backend staging can run Publish V2 and Messages.

## Things Not To Do Now

- Do not add more recommendation strategy.
- Do not add LLM auto-publish or auto-review.
- Do not build place pages or food maps.
- Do not continue complex Map v2 editor work.
- Do not do broad UI redesign.
- Do not rewrite NodeBB capabilities in LIAN.
- Do not migrate to Express/Fastify.
- Do not migrate all JSON data to PostgreSQL now.
- Do not build a full organization permission platform.

## Source Of Truth

Use this document together with:

- `docs/agent/PRO_REVIEW_BRIEF.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/04_DECISIONS.md`
- `docs/agent/ARCHITECTURE_WORKPLAN.md`
- `docs/agent/00_AGENT_RULES.md`

If these conflict, prefer the newest dated decision and the current code.
