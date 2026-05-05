# Handoffs Override - 2026-05-05

This file overrides stale active-status readings in `docs/agent/handoffs/*`.

Handoffs are context-transfer notes. They are not acceptance records and must not override current code, merged PRs, PR-derived status, or dated override files.

## Current authority

1. Current code on `main`.
2. Merged GitHub PRs.
3. `PR_DERIVED_STATUS_2026-05-05.md`.
4. This override file.
5. Individual handoffs as historical context.

## Current handoff-read rule

Before using any handoff:

1. Check current code and `package.json`.
2. Check merged PRs.
3. Read `PR_DERIVED_STATUS_2026-05-05.md`.
4. Read the relevant override files.
5. Then read the handoff for thread context only.

## Known stale handoff readings

| Handoff or index | Stale reading | Current correction |
|---|---|---|
| `handoffs/README.md` | `04_DECISIONS.md` and `05_TASK_BOARD.md` are current workspace entry points. | Current entry point is PR-derived status plus overrides. |
| `handoffs/README.md` | Read `ARCHITECTURE_WORKPLAN.md` before new implementation. | Read PR-derived status and override files before old architecture workplan. |
| `frontend-stability-smoke.md` | Smoke defaults to older 4100/static split assumptions. | Current frontend runtime uses 4300 legacy/static and 4301 Vue canary. Use `npm run test` and `npm run test:vue-canary`. |
| `frontend-app-split.md` and classic-script handoffs | Classic split is the full frontend baseline. | Classic scripts are compatibility lane only; Vue canary has real product paths. |
| `publish` or `ai-publish` handoffs | Publish is modal/classic/static-only or rough single-image state. | Recent Vue canary PRs added Publish and Map V2 location draft support; recheck current code before planning. |
| `repo-split-frontend-backend.md` | Some historical split details may mention older repo states. | Use latest repo-split handoff only as context; repo ownership is complete and current roots/README files are authoritative. |
| Map handoffs | Map implementation may proceed from handoff notes alone. | Map geometry/data/editor work remains human-assisted and requires explicit human-approved scope. |

## Current frontend handoff facts

- `lian-mobile-web` is the active frontend/mobile web repo.
- `lian-platform-server` is the active backend/API/runtime repo.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane: 4300 legacy/static rehearsal and 4301 Vue canary.
- Handoff validation results are snapshots, not durable acceptance unless current PRs/code still match.

## Safe usage

Use handoffs to answer:

- what a previous thread attempted;
- what files it thought it changed;
- what validations it claimed to run;
- what risks it left behind.

Do not use handoffs alone to answer:

- what is currently implemented;
- what repo owns a file now;
- whether a feature is accepted today;
- what command should be run today;
- whether an old follow-up is still valid.
