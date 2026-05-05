# Task Docs Override - 2026-05-05

This file overrides stale active-task readings in `docs/agent/tasks/*`.

Task docs remain useful for scope, risks, acceptance ideas, and historical intent. They must not be used as current status without checking merged PRs and current code.

## Current authority

1. Current code on `main`.
2. Merged GitHub PRs.
3. `PR_DERIVED_STATUS_2026-05-05.md`.
4. This override file.
5. Individual task docs as scope/history.

## Cross-task current facts

- `lian-mobile-web` is the active frontend/mobile web repo.
- `lian-platform-server` is the active backend/API/runtime repo.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane: 4300 legacy/static rehearsal and 4301 Vue canary.
- Vue canary already has real Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor paths.
- Task-board dashboard, structure panel, and architecture diagram have landed.

## Known stale task readings

| Task doc | Stale reading | Current correction |
|---|---|---|
| `tasks/repo-split-frontend-backend.md` | Backend repo bootstrap and destructive split are pending. | Repo ownership split is complete. Use this task as split-history only. |
| `tasks/repo-split-frontend-backend.md` | Frontend repo should be only `public/` + smoke + contract. | Current frontend repo also has Vue/Vite source, runtime supervisor, frontend checks, task-board UI, and docs. |
| `tasks/repo-split-frontend-backend.md` | Initial split must avoid framework migration. | Vue canary migration has already landed as a dual-lane canary; do not use this old prohibition to block current Vue work. |
| `tasks/publish-v2-page.md` | Publish V2 is pending old browser smoke and classic-static implementation. | Recent Vue canary PRs added publish flow and Map V2 location draft support. Recheck current Vue code before treating old blockers as current. |
| `tasks/frontend-stability-smoke.md` and similar smoke docs | Legacy/static smoke is the only frontend validation. | Current frontend has both `npm run test` for 4300 and `npm run test:vue-canary` for 4301. |
| Map task docs | Map data/editor implementation may be scoped from task text alone. | Map geometry/data/editor work remains human-assisted and must be explicitly approved. |
| Backend/API task docs mirrored in frontend repo | Frontend repo may edit backend runtime files. | Backend/API/runtime implementation belongs in `lian-platform-server`. |

## Current frontend task guidance

Before starting a frontend task:

1. Check current `package.json` and runtime scripts.
2. Check merged PRs.
3. Check `PR_DERIVED_STATUS_2026-05-05.md`.
4. Check this override.
5. Then use task docs for scope/history.

Current safe frontend follow-up lanes:

- Verify current dual-lane runtime: `npm run verify`, `npm run test`, `npm run test:vue-canary`.
- Vue Feed/Detail: sync detail action state back into feed cards if current code still lacks it.
- Vue Publish: only continue AI draft/regenerate parity after checking PR #36/current code.
- Vue Map: Leaflet pan/zoom parity or richer place drawer as a separate scoped task.
- Vue Profile: avatar crop polish/shared avatar display as a separate scoped task.
- Task-board: keep unauthenticated shell and architecture view useful when internal API is unauthorized.

## Do not start from stale task docs

Do not start new implementation directly from old P0 task docs unless the task is revalidated against current PRs and code. Create a fresh task or add an explicit dated addendum when resuming old scope.
