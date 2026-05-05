# Documentation Review Findings - 2026-05-05

This review follows the new source-of-truth rule: current code and merged GitHub PRs override older task-board, handoff, and baseline docs.

## Review scope

- `docs/agent/README.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-05.md`
- `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-05.md`
- `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
- Recent merged frontend PRs #23-#38
- Current `package.json`
- Current `scripts/serve-frontend-runtimes.js`

## Current accepted facts from PRs and code

- `lian-mobile-web` is the active frontend/mobile web repo.
- `lian-platform-server` is the active backend/API/runtime repo.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane:
  - legacy/static rehearsal on 4300;
  - Vue canary on 4301.
- Vue canary already has real Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor paths from PRs #27-#36.
- Task-board UI has progress, structure, and architecture-diagram upgrades from PRs #30, #33, and #38.

## Files with stale or risky interpretation

| File | Issue | Action |
|---|---|---|
| `docs/agent/05_TASK_BOARD.md` | Contains long older P0/P1 task distribution that predates the Vue canary PR burst and may overstate old acceptance blockers. | Do not use as first source of truth. Compare every active task against `PR_DERIVED_STATUS_2026-05-05.md` and current PRs before implementation. |
| `docs/agent/references/GITHUB_RECENT_UPDATES_2026-05-05.md` | Useful repo-split note, but it does not fully reflect PRs #35-#38 and the final dual-lane runtime interpretation. | Prefer `PR_DERIVED_STATUS_2026-05-05.md` for current frontend runtime and Vue canary state. |
| `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-05.md` | Useful handoff, but still describes some local checkout details and older head snapshots. | Treat as handoff context only, not current GitHub state. |
| Older handoffs and task docs | Some describe frontend as classic-script-first or backend bootstrap as future work. | Historical only unless verified against merged PRs. |

## Recommended next doc cleanup

1. Add a compact `Current PR-Derived Status` block at the top of `05_TASK_BOARD.md`.
2. Move old P0 acceptance items that were superseded by PRs #27-#36 into an audit/history section.
3. Keep the task-board UI workstream current with PRs #30, #33, and #38.
4. Keep frontend runtime wording consistent: `4300 legacy/static rehearsal + 4301 Vue canary`.
5. Do not delete historical docs unless a separate cleanup PR is opened; add supersession notes first.

## Safe implementation rule

Before starting any frontend task, check:

1. `package.json` scripts;
2. `scripts/serve-frontend-runtimes.js`;
3. latest merged PRs;
4. `PR_DERIVED_STATUS_2026-05-05.md`;
5. only then read older task docs and handoffs.
