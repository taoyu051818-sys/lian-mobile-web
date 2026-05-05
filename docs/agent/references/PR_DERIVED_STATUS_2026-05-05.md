# PR-Derived Status - 2026-05-05

This file records the current project state from merged GitHub PRs, not from older task-board text.

## Frontend repo

Repository: `taoyu051818-sys/lian-mobile-web`

Current state checked from recent merged PRs:

- 0 open PRs.
- Latest merged PR is #38.
- `npm start` runs `scripts/serve-frontend-runtimes.js`.
- The runtime now has two lanes: legacy/static rehearsal on port 4300 and Vue canary on port 4301.
- `npm run test` smokes 4300.
- `npm run test:vue-canary` smokes 4301.
- `npm run verify` runs check, ops guard, and build.

## Recent frontend PR meaning

| PR | Meaning |
|---|---|
| #38 | Task-board architecture diagram. |
| #37 | Docs alignment. |
| #36 | Map V2 publish location drafts in Vue canary. |
| #35 | Real Map V2 data rendering in Vue canary. |
| #34 | Profile editor canary path. |
| #33 | Task-board structure panel. |
| #32 | Detail like/save/report/reply actions in Vue canary. |
| #31 | Fast manual publish path in Vue canary. |
| #30 | Task-board progress dashboard and workstream visualization. |
| #29 | Auth panel in Vue profile guest state. |
| #28 | Profile and Messages canary paths. |
| #27 | Feed read path and detail panel in Vue canary. |
| #26 | Start script launches both 4300 and 4301. |
| #25 | Isolated Vue canary port. |
| #24 | Runtime inventory and ops guard. |
| #23 | Earlier Vue default move; later runtime PRs and current code define the current dual-lane runtime. |

## Current interpretation

Older docs that still describe the project as classic-script-only or backend-owned from this repo are stale. The current frontend repo owns the frontend lanes and task-board UI. Backend/API work belongs in `taoyu051818-sys/lian-platform-server`.
