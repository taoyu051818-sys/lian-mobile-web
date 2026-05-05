# Recent Work Handoff - 2026-05-05

This handoff supersedes the 2026-05-04 handoff for GitHub/repo-split orientation.

## Top-Level Correction

The backend is already in:

```text
https://github.com/taoyu051818-sys/lian-platform-server
```

The full-stack repository is stopped/decommissioned as an active runtime source. Treat `lian-mobile-web-full` only as historical transition context and rollback reference.

## Current State

Two remotes are still present in this local checkout, but only one is active for frontend work:

```text
full   -> taoyu051818-sys/lian-mobile-web-full   # historical / retired full-stack transition repo
origin -> taoyu051818-sys/lian-mobile-web        # active frontend repo
```

Backend repository:

```text
lian-platform-server -> taoyu051818-sys/lian-platform-server
main HEAD verified on 2026-05-05: 4de844b
```

Important heads after fetch:

```text
full/main   cab0ec7 Merge pull request #20 from cleanup/frontend-only-repo
origin/main 5f86490 chore: ignore frontend generated artifacts
local main  currently has uncommitted docs updates and may not be fast-forwarded
```

## Repo Split Status

The first cleanup PR is complete at the code-layer level:

- `server.js` removed from mobile web cleanup branch.
- `src/server/*` removed from mobile web cleanup branch.
- Backend route/export scripts removed.
- Backend regression tests that depended on `src/server` removed.
- Frontend static rehearsal server added.
- Frontend-only structure validation added.

`data/*` was intentionally not removed in the first cleanup and remains second cleanup PR scope.

Backend runtime is `lian-platform-server` responsibility. Frontend runtime is `lian-mobile-web` responsibility. Do not plan new backend deployment work from `lian-mobile-web-full`.

## Validation Recorded

Local validation during cleanup:

```text
npm run check -> 40 passed, 0 failed
4300 static rehearsal -> starts and serves / as 200
local smoke -> 28 passed, 2 failed because local 4200/4201 backend staging was not running
```

Expected server validation when backend staging is alive:

```text
backend staging: http://127.0.0.1:4200
image proxy staging: http://127.0.0.1:4201
frontend static rehearsal: http://127.0.0.1:4300
smoke-frontend: expected 30 passed, 0 failed
```

## GitHub PR Orientation

Frontend repository `lian-mobile-web` currently shows:

```text
0 open PRs
34 closed PRs
```

Recent frontend work includes Vue canary/runtime fast paths, task-board progress/structure panels, frontend CI verification, ops observability, and generated-artifact ignore rules.

Historical full/split repository `lian-mobile-web-full` recently merged PRs #16-20, ending with frontend-only cleanup on `full/main`. This is transition history, not an active backend deployment lane.

## Documentation Updates In Progress

Uncommitted local docs currently include:

- `docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md`
- `docs/agent/README.md`
- `docs/agent/PROJECT_FILE_INDEX.md`
- this 2026-05-05 GitHub/docs alignment pass

The UI/UX guideline now defines:

- LIAN product principles.
- Google/Apple/LIAN design synthesis.
- card system.
- identity and tag rules.
- glass hierarchy.
- feed color rule: `统一卡片底色，轻量类型色，结构优先，颜色辅助`.
- motion, state, feedback, accessibility, and data trust rules.

## Next Recommended Actions

1. Commit the docs alignment separately from runtime code.
2. If creating a docs PR, target the repository that will own product/frontend docs after split.
3. Run backend validation in `lian-platform-server`, not `lian-mobile-web-full`.
4. Start the second cleanup PR only after confirming `data/*` ownership and rollback plan.
