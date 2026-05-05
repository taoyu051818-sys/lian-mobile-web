# Task Board Override - 2026-05-05

This file overrides stale active-status readings in `docs/agent/05_TASK_BOARD.md`.

Use this file before the long task board. The task board remains useful as history, but it contains old P0/P1 statements that predate the merged PR burst.

## Source of truth

1. Current code on `main`.
2. Merged GitHub PRs.
3. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`.
4. This override file.
5. `docs/agent/05_TASK_BOARD.md` for historical context only.

## Frontend current state

- Frontend repo: `taoyu051818-sys/lian-mobile-web`.
- Backend repo: `taoyu051818-sys/lian-platform-server`.
- Historical full-stack repo: `taoyu051818-sys/lian-mobile-web-full`.
- Current frontend runtime has two lanes:
  - 4300 legacy/static rehearsal;
  - 4301 Vue canary.
- `npm start` launches both lanes.
- `npm run test` targets 4300.
- `npm run test:vue-canary` targets 4301.
- `npm run verify` runs check, ops guard, and build.

## Superseded task-board readings

Do not treat these old readings as current without PR/code recheck:

- backend repo bootstrap as future planning;
- `lian-mobile-web-full` as active runtime source;
- frontend as classic-script-only;
- Vue canary pages as placeholder-only;
- old P0 acceptance blockers that were addressed or partially superseded by PRs #27-#38.

## Current frontend workstreams from merged PRs

| Area | Current status |
|---|---|
| Runtime | Dual lane: 4300 legacy/static and 4301 Vue canary. |
| Feed | Vue canary has real `/api/feed` read path. |
| Detail | Vue canary has detail loading plus like/save/report/reply actions. |
| Profile | Vue canary has account/profile lists, auth panel, and profile editor. |
| Messages | Vue canary has channel/messages API integration. |
| Publish | Vue canary has manual publish and Map V2 location draft support. |
| Map | Vue canary renders real Map V2 items and opens post details. |
| Task-board | Dashboard, structure panel, and architecture diagram have landed. |

## Current frontend follow-ups

These are the safest follow-ups to use for new work:

1. Pull latest `main` and run `npm run verify`.
2. Run `npm run test` for 4300 and `npm run test:vue-canary` for 4301.
3. Sync detail action state back into feed cards after Vue detail actions.
4. Continue Publish AI draft preview/regenerate parity only after checking PR #36 code.
5. Continue Map Leaflet/pan/zoom or richer place drawer only as separate scoped work.
6. Keep task-board unauthenticated shell useful when internal API is unauthorized.

## Rule for future edits

If `05_TASK_BOARD.md` and this file disagree, use this file and current PRs for active planning. Keep the long task board as historical audit context until a dedicated cleanup PR rewrites it safely.
