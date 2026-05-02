# Architecture Workplan

Date: 2026-05-02

This document is the current architect-level work assignment for the next LIAN threads. It replaces ad hoc continuation in the current chat. Future coding threads should start from this file, then read the specific task doc assigned to them.

## Current System State

LIAN is now organized around these product layers:

```text
NodeBB content backend
  -> LIAN server services
  -> feed / map / AI publish / auth adapters
  -> mobile web frontend
  -> internal map editor tools
```

Recent completed work:

- Feed optimization and feed observability are complete enough for operation.
- AI light publish MVP is implemented: image upload, AI draft, silent draft save, user-confirmed publish.
- Map v2 MVP is implemented with Gaode tiles, LIAN overlays, Map v2 location drafts, and a standalone internal editor.
- `public/app.js` has been mechanically split into smaller classic-script files, without changing the build system.
- NodeBB integration has a dedicated domain document: `docs/agent/domains/NODEBB_INTEGRATION.md`.

Important stale docs to keep in mind:

- Older decisions saying "Map v2 is design-only" are superseded by the Map v2 Gaode/editor handoffs.
- Older task-board text saying Map v2 is blocked is stale and should not stop Map v2 data/tooling work.

## Architecture Principles For The Next Phase

1. Keep NodeBB as the content system of record.
2. Keep LIAN-owned metadata, map layers, AI drafts, and feed logic outside NodeBB.
3. Do not mix feed ranking changes with map, publish, or auth changes.
4. Do not use AI to automatically publish or automatically approve content.
5. Prefer additive validation scripts before schema-heavy refactors.
6. Treat `public/app.js` split files as feature boundaries. Do not merge them back into one file.
7. Keep Map v2 data and editor work separate from user-facing publish flow polish.
8. Do not add multi-school or organization visibility until the LIAN audience model is designed.

## Workstream Ownership

### Workstream A: Map v2 Data Assets

Task doc: `docs/agent/tasks/map-v2-data-assets.md`

Immediate subtask:

- `docs/agent/tasks/map-v2-restore-legacy-geo.md`

Goal:

- Turn the Map v2 shell into a usable campus map data layer.
- Integrate real art/icon assets.
- Improve editor validation without changing the product feed or publish backend.

Primary files:

- `public/map-v2.js`
- `public/tools/map-v2-editor.html`
- `public/tools/map-v2-editor.css`
- `public/tools/map-v2-editor.js`
- `public/assets/*`
- `src/server/map-v2-service.js`
- `data/locations.json`
- `data/map-v2-layers.json`
- `scripts/validate-locations.js`

Do not touch:

- `src/server/feed-service.js`
- `data/feed-rules.json`
- `src/server/post-service.js`
- AI publish route logic

### Workstream B: Frontend Stability And Smoke Tests

Task doc: `docs/agent/tasks/frontend-stability-smoke.md`

Goal:

- Protect the newly split frontend files from loading-order regressions and HTML encoding corruption.
- Add lightweight smoke checks that can run before deployment.

Primary files:

- `scripts/smoke-frontend.js` or similar
- `public/index.html`
- split frontend files only when a smoke test exposes a bug

Do not touch:

- feed scoring
- NodeBB publishing helpers
- map data files unless the smoke test only reads them

### Workstream C: AI Publish Polish

Task doc: `docs/agent/tasks/ai-publish-polish.md`

Goal:

- Move AI light publish from MVP to reliable daily use.
- Add multi-image support and better draft/record hygiene.

Primary files:

- `src/server/ai-light-publish.js`
- `src/server/ai-post-preview.js`
- `public/app-ai-publish.js`
- `public/app-utils.js` only if upload helper changes are needed
- `scripts/archive-ai-records.js`

Do not touch:

- feed scoring
- Map v2 editor
- `src/server/post-service.js` except for a clearly reviewed shared publish bug

### Workstream D: Feed Operations

Task doc: `docs/agent/tasks/feed-ops-snapshot-diff.md`

Goal:

- Make feed tuning observable and repeatable without changing recommendation behavior by accident.

Primary files:

- `scripts/snapshot-feed.js`
- `outputs/*`
- `docs/agent/domains/FEED_SYSTEM.md`

Do not touch:

- `src/server/feed-service.js` unless a new feed-ranking task is explicitly approved.
- `data/feed-rules.json` unless the task includes before/after snapshots.

### Workstream E: Architecture Docs Reconciliation

Goal:

- Keep `04_DECISIONS.md`, `05_TASK_BOARD.md`, `03_FILE_OWNERSHIP.md`, and domain docs synchronized with the real code state.

Primary files:

- `docs/agent/04_DECISIONS.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/03_FILE_OWNERSHIP.md`
- `docs/agent/domains/*`
- `docs/agent/tasks/*`
- `docs/agent/handoffs/*`

Do not touch runtime code in this workstream.

### Workstream F: NodeBB Integration And Audience Planning

Domain doc: `docs/agent/domains/NODEBB_INTEGRATION.md`

Goal:

- Audit the current NodeBB integration boundary.
- Design how future school/org audience rules will use LIAN permissions plus NodeBB groups/categories.
- Avoid leaking private school/org content through raw NodeBB topic access.

Near-term tasks:

- `nodebb-integration-audit`
- `audience-permission-design`
- `nodebb-groups-sync-plan`
- `nodebb-restricted-category-plan`

Do not implement these in one code thread. Start with design and endpoint audit.

## Required Handoff Format

Every implementation thread must end by creating or updating a handoff in `docs/agent/handoffs/`.

The handoff must include:

- files changed;
- behavior changed;
- validation commands and results;
- what was intentionally not done;
- risks;
- rollback plan;
- next suggested task.

## Merge Discipline

No PR should combine more than one of these:

- feed scoring;
- publish/NodeBB topic creation;
- Map v2 data/editor;
- auth/session;
- AI preview/publish;
- HTML/app shell loading.

If a task needs to cross one of those boundaries, stop and create a new task doc first.
