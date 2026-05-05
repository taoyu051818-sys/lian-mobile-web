# Architecture Workplan Override - 2026-05-05

This file overrides stale active-planning readings in `docs/agent/ARCHITECTURE_WORKPLAN.md`.

The original workplan remains useful as architecture history, but it predates the merged frontend Vue canary PR burst and the completed backend repo split.

## Current architecture facts

- `lian-mobile-web` is the active frontend/mobile web repository.
- `lian-platform-server` is the active backend/API/runtime repository.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane:
  - 4300 legacy/static rehearsal;
  - 4301 Vue canary.
- Vue canary already has real product paths for Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor.
- Task-board UI has progress, structure, and architecture diagram work from recent PRs.

## Known stale architecture readings

| Old architecture reading | Current correction |
|---|---|
| Future threads should start from `ARCHITECTURE_WORKPLAN.md`. | Start from `PR_DERIVED_STATUS_2026-05-05.md`, task-board override, file-index override, and doc review findings first. |
| Repository split is an active P0 workstream with phase order. | Backend repo split is complete at repo-ownership level; remaining work is cleanup, validation, and docs alignment. |
| Current frontend baseline is classic `public/app.js` split files. | Current frontend has dual runtime lanes, with Vue canary containing real page/product paths. |
| Publish V2 is planned as a dedicated page. | Publish and Map location draft work have landed in Vue canary PRs; check current code before planning. |
| PC task-board first cut is only planned/read-only. | Task-board dashboard, structure panel, and architecture diagram have landed. |
| Primary files include backend `src/server/*` and `data/*` under this repo. | Backend files/data belong to `lian-platform-server`; frontend work should not edit backend runtime from this repo. |

## Current frontend architecture guidance

1. Treat 4300 legacy/static as compatibility and smoke lane.
2. Treat 4301 Vue canary as the active migration lane.
3. Do not plan a feature as missing until checking merged PRs and current Vue files.
4. Keep frontend tasks scoped by product surface: Feed, Detail, Profile, Messages, Auth, Publish, Map, Task-board.
5. Keep backend/API/data changes in `lian-platform-server`.
6. Keep map geometry/data changes human-assisted.
7. Use `npm run verify`, `npm run test`, and `npm run test:vue-canary` as current top-level validation entrypoints.

## Still-valid principles from the original workplan

- Do not use AI to automatically publish or approve content.
- Do not mix feed ranking changes with map, publish, or auth changes.
- Keep Map data/editor work human-assisted.
- Keep high-risk changes narrow and validated.
- End implementation threads with clear handoffs when runtime behavior changes.
