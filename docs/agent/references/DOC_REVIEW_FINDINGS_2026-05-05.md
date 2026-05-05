# Documentation Review Findings - 2026-05-05

This file records the 2026-05-05 documentation review and cleanup pass for `lian-mobile-web`.

Current code and merged GitHub PRs override older task-board, handoff, domain, contract, and baseline docs. Dated override files and directory notices now exist to prevent stale split-era documents from being used as active implementation truth.

## Review scope

Reviewed and/or marked:

- root `README.md`
- `docs/agent/README.md`
- `docs/agent/00_AGENT_RULES.md`
- `docs/agent/03_FILE_OWNERSHIP.md`
- `docs/agent/04_DECISIONS.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/ARCHITECTURE_WORKPLAN.md`
- `docs/agent/PROJECT_FILE_INDEX.md`
- `docs/agent/domains/*`
- `docs/agent/tasks/*`
- `docs/agent/handoffs/*`
- `docs/agent/contracts/*`
- `docs/agent/references/*`
- `docs/agent/templates/*`
- current `package.json`
- current frontend runtime supervisor and PR-derived status notes

## Current accepted facts

- `lian-mobile-web` is the active frontend/mobile web repository.
- `lian-platform-server` is the active backend/API/runtime repository.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane:
  - legacy/static rehearsal on port 4300;
  - Vue canary on port 4301.
- `npm start` starts both frontend lanes through the runtime supervisor.
- `npm run test` targets the 4300 legacy/static rehearsal lane.
- `npm run test:vue-canary` targets the 4301 Vue canary lane.
- `npm run verify` currently runs frontend check, ops guard, and build.
- Vue canary already has real Feed, Detail, Profile, Messages, Auth, Publish, Map V2, and Profile Editor paths.
- Task-board UI has progress, structure, and architecture-diagram upgrades.

## Source-of-truth chain now established

Use this order when docs disagree:

1. Current code on `main`.
2. Merged GitHub PRs, especially newest PRs.
3. Root `README.md` and current `package.json`.
4. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`.
5. Dated override files in `docs/agent/references/`.
6. Directory notices and current `docs/agent/README.md`.
7. Older numbered docs, domain docs, task docs, handoffs, and contracts as historical/context material only.

## Override files created or integrated

| File | Purpose |
|---|---|
| `references/DECISIONS_OVERRIDE_2026-05-05.md` | Supersedes stale active-decision readings in `04_DECISIONS.md`. |
| `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` | Supersedes old architecture-planning entrypoint and repo split assumptions. |
| `references/TASK_BOARD_OVERRIDE_2026-05-05.md` | Supersedes stale active task-board interpretation. |
| `references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md` | Supersedes stale file ownership boundaries. |
| `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` | Supersedes stale split-era project index readings. |
| `references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md` | Supersedes stale domain-doc implementation status. |
| `references/TASK_DOCS_OVERRIDE_2026-05-05.md` | Supersedes stale active-task readings. |
| `references/HANDOFFS_OVERRIDE_2026-05-05.md` | Clarifies handoffs are context, not acceptance records. |
| `references/CONTRACTS_OVERRIDE_2026-05-05.md` | Supersedes split-era API contract status/port/caller assumptions. |

## Directory notices added

These directory-level notices were added so future readers see the warning before opening individual old files:

| Directory | Notice file | Meaning |
|---|---|---|
| `domains/` | `00_DIRECTORY_NOTICE_2026-05-05.md` | Domain docs are business intent/history unless revalidated. |
| `tasks/` | `00_DIRECTORY_NOTICE_2026-05-05.md` | Task docs are scope/history, not active-work proof. |
| `handoffs/` | `00_DIRECTORY_NOTICE_2026-05-05.md` | Handoffs are context-transfer notes, not durable acceptance. |
| `contracts/` | `00_DIRECTORY_NOTICE_2026-05-05.md` | Contracts are split-era API inventory unless revalidated. |
| `references/` | `00_DIRECTORY_NOTICE_2026-05-05.md` | References are mixed; use current PR-derived/override files first. |

## File-level or sidecar superseded markers

| File or notice | Status |
|---|---|
| `ARCHITECTURE_WORKPLAN.md` | File-level warning banner added. |
| `04_DECISIONS.md` | File-level warning banner added. |
| `03_FILE_OWNERSHIP.md` | File-level warning banner added. |
| `PROJECT_FILE_INDEX.md` | File-level warning banner added. |
| `contracts/api-contract.md` | File-level warning banner added. |
| `05_TASK_BOARD_SUPERSEDED_NOTICE_2026-05-05.md` | Sidecar notice added because the task board is long and unsafe to whole-file replace through truncated tool output. |

## Rules and templates updated

| File | Update |
|---|---|
| `00_AGENT_RULES.md` | Updated to require current code, PRs, root README/package, PR-derived status, and override chain before old docs. |
| `templates/TASK_TEMPLATE.md` | Updated to include current source check, repo ownership scope, API/contract checks, and current validation commands. |
| `templates/HANDOFF_TEMPLATE.md` | Updated to state handoffs are not durable acceptance and must record override/source checks. |
| `handoffs/README.md` | Updated to route readers through PR-derived status and override files before individual handoffs. |

## Stale/risky interpretations now explicitly covered

| Old or risky reading | Current correction |
|---|---|
| `ARCHITECTURE_WORKPLAN.md` is the current implementation entrypoint. | It is historical/planning context. Start from PR-derived status and overrides. |
| `04_DECISIONS.md` is the live decision source. | It is historical decision context. Use decisions override first. |
| `05_TASK_BOARD.md` current statuses can be trusted directly. | It is a long historical task board; check task-board override and PR-derived status first. |
| `PROJECT_FILE_INDEX.md` current source order and file ownership are authoritative. | It is split-era context; use file-index and ownership overrides first. |
| Classic scripts are the whole frontend baseline. | Classic/static is the 4300 compatibility lane; Vue canary on 4301 is active migration lane. |
| Backend files/data/scripts belong in frontend repo. | Backend/API/runtime/data belong in `lian-platform-server`. |
| `contracts/api-contract.md` is frozen source of truth for current API. | It is split-era inventory; verify current frontend callers and backend routes. |
| Old task docs can be used to start implementation directly. | Revalidate against current code and PRs; create a dated addendum or fresh task. |
| Handoffs prove acceptance. | Handoffs are context only; reviewer validation must be recorded elsewhere. |

## Remaining caveats

- Several old long files still contain obsolete body text below their warning banners or sidecar notices. That is intentional for history preservation.
- `05_TASK_BOARD.md` was not whole-file edited because tool output was truncated and a full replacement would risk data loss.
- Directory notices do not replace current code/PR checks; they are guardrails for readers.
- This pass did not run local/CI validation commands.

## Recommended next cleanup

1. Run frontend validation:

```bash
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

2. If docs tooling requires inventory updates, regenerate or update generated docs lists.
3. Later, consider consolidating the many override files into a compact `CURRENT_PROJECT_STATE_2026-05-05.md`, leaving individual overrides as detail appendices.
4. Only after CI/local validation, consider rewriting old `05_TASK_BOARD.md` into a current board plus archived history.

## Safe implementation rule

Before starting any frontend task, check:

1. current code and `package.json` scripts;
2. latest merged PRs;
3. root `README.md`;
4. `PR_DERIVED_STATUS_2026-05-05.md`;
5. relevant override files;
6. then older task docs, handoffs, domains, and contracts as context only.
