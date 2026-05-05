# Project File Index Override - 2026-05-05

This file overrides stale readings in `docs/agent/PROJECT_FILE_INDEX.md`.

The original index remains useful as split-history context, but it still lists backend/data/scripts groups that moved to `lian-platform-server` or are no longer current in the frontend repo.

## Correct source-of-truth order

1. Current code on `main`.
2. Merged GitHub PRs.
3. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`.
4. `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`.
5. This file for file-index conflict handling.
6. `docs/agent/PROJECT_FILE_INDEX.md` for split-history structure only.

## Current frontend ownership

| Area | Current owner |
|---|---|
| Frontend runtime lanes | `taoyu051818-sys/lian-mobile-web` |
| Legacy/static rehearsal lane on 4300 | `taoyu051818-sys/lian-mobile-web` |
| Vue canary lane on 4301 | `taoyu051818-sys/lian-mobile-web` |
| Frontend task-board UI | `taoyu051818-sys/lian-mobile-web` |
| Frontend assets and design docs | `taoyu051818-sys/lian-mobile-web` |
| Backend runtime/API/Redis/NodeBB | `taoyu051818-sys/lian-platform-server` |
| Historical full-stack transition material | `taoyu051818-sys/lian-mobile-web-full`, history only |

## Known stale or conflicting index statements

| Old index reading | Current correction |
|---|---|
| Source-of-truth order puts latest handoff before PRs. | Merged PRs and current code now come before handoffs. |
| `src/server/` section appears inside frontend file index. | Backend services now belong to `lian-platform-server`; use backend repo current code and docs. |
| `data/` section appears as active runtime data under frontend index. | Runtime data belongs to backend. Frontend repo should not be treated as data/API owner. |
| `scripts/` list includes backend validation and ops scripts. | Current frontend scripts are defined by frontend `package.json`; backend scripts belong to `lian-platform-server`. |
| `public/` section describes classic-script frontend as the only detailed frontend lane. | Current frontend has dual lanes: 4300 legacy/static rehearsal and 4301 Vue canary with multiple real product paths. |
| `references/RECENT_WORK_HANDOFF_2026-05-05.md` is named as active repo ownership source. | Use `PR_DERIVED_STATUS_2026-05-05.md` and merged PRs first; handoffs are context only. |

## Current frontend top-level verification entrypoints

Use frontend `package.json` as source of truth. Current important commands include:

```bash
npm start
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

## Cleanup recommendation

A future cleanup PR may rewrite `PROJECT_FILE_INDEX.md` into a frontend-only index. Until then, do not delete historical sections; use this override to prevent stale split-era statements from becoming active implementation guidance.
