# Agent Rules Quick Reference

Every Agent session must read this file before making changes, but this file is not above current code, merged GitHub PRs, root README, or dated override files.

## Startup checklist

Read these files at the start of every task, in this order:

1. Current code on `main` and the relevant root `README.md` / `package.json`.
2. Recent merged GitHub PRs for the repo and task area.
3. `docs/agent/README.md` - source-of-truth order and docs index.
4. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`.
5. Current dated override files relevant to the task:
   - `docs/agent/references/DECISIONS_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/TASK_DOCS_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/HANDOFFS_OVERRIDE_2026-05-05.md`
   - `docs/agent/references/CONTRACTS_OVERRIDE_2026-05-05.md`
6. `docs/agent/00_AGENT_RULES.md` - this file.
7. Older numbered docs, domain docs, task docs, and handoffs only as historical/context material after override checks.

Do not start from `ARCHITECTURE_WORKPLAN.md`, `05_TASK_BOARD.md`, `03_FILE_OWNERSHIP.md`, `04_DECISIONS.md`, `tasks/*`, `handoffs/*`, or `contracts/*` without checking the override chain first.

## Current repo facts

- `lian-mobile-web` owns frontend runtime lanes, frontend UI, Vue canary, legacy/static rehearsal, frontend task-board UI, assets, design docs, and frontend docs.
- `lian-platform-server` owns backend/API/runtime, Redis object-native state, NodeBB integration, auth/session, uploads, image proxy, map/data APIs, and backend validation.
- `lian-mobile-web-full` is historical only.
- Frontend runtime is dual-lane: 4300 legacy/static rehearsal and 4301 Vue canary.

## Thread role split

This project uses a two-thread workflow by default:

| Thread | Responsibility | Can implement? | Required output |
|---|---|---:|---|
| Codex / code thread | Planning, task decomposition, architecture judgement, review, acceptance, documentation status | No, unless the user explicitly asks this thread to patch | Review findings, task docs, handoff updates, acceptance decision |
| Claude Code thread | Bounded implementation against an approved task doc | Yes | Patch, verification output, handoff summary |

Rules:

- The Codex / code thread owns scope control. It should write or update task docs before large implementation work starts.
- The Claude Code thread owns execution. It should not broaden scope beyond the task doc without handing back to the Codex / code thread.
- Review findings from the Codex / code thread are blockers until fixed or explicitly waived in docs.
- A lane is not accepted because implementation reports "done"; it is accepted only after reviewer validation is recorded.
- If a task touches high-conflict files, the Codex / code thread must define exact allowed files and validation commands before execution.
- If implementation discovers a product or architecture ambiguity, stop and write a handoff instead of silently choosing a broad direction.

## Forbidden actions

- Do NOT format or pretty-print runtime JSON data files.
- Do NOT reformat code outside your task scope.
- Do NOT add frameworks or dependencies without approval.
- Do NOT commit `.env`, API keys, or secrets.
- Do NOT add backend/API/runtime implementation back into `lian-mobile-web`.
- Do NOT treat old task docs, handoffs, contracts, or split manifests as current truth without override and code checks.
- Do NOT do large rewrites unless the task explicitly says so.
- Do NOT mark a lane as accepted from the executor thread. Only reviewer validation can move it to accepted.

## High-conflict frontend files

| File / area | Level | Notes |
|---|---|---|
| `src/**` | soft-lock | Vue canary/runtime lane; check current PRs and task scope. |
| `public/**` | soft-lock | Legacy/static rehearsal lane and tools; check ownership and task scope. |
| `public/tools/task-board.*` | soft-lock | Task-board UI; keep unauthenticated shell useful. |
| `scripts/serve-frontend-runtimes.js` | hard-review | Runtime supervisor for 4300/4301. |
| `package.json` | hard-review | Defines current frontend commands; avoid script drift. |
| `docs/agent/**` | documentation | Must follow current source-of-truth order. |

Backend-owned files such as `server.js`, `src/server/*`, runtime `data/*`, backend validation scripts, NodeBB integration, Redis storage, and backend route registry belong in `lian-platform-server`.

## Parallel development boundaries

These frontend areas can be developed in parallel with minimal conflict when scoped correctly:

- Vue canary page-level work under `src/`.
- Legacy/static compatibility fixes under `public/`.
- Frontend task-board UI files.
- Frontend docs and design references.
- Frontend smoke/check scripts listed in current `package.json`.

These areas need coordination:

- Changes that affect both 4300 legacy/static and 4301 Vue canary.
- Runtime supervisor or package script changes.
- API contract changes that require backend updates.
- Map geometry/data/editor changes; keep human-assisted.

## Small task vs large task

| | Small task (typo, config, one-line fix) | Large task (new feature, multi-file, contract/runtime change) |
|---|---|---|
| Task doc | not required | required in `docs/agent/tasks/` or a dated task addendum |
| Handoff | chat summary is enough | must write/update `docs/agent/handoffs/` |
| Plan mode | not needed | required for 3+ files or touching runtime/API contracts |
| Verification | changed-file check plus relevant package script | current `npm run verify` plus targeted smoke/manual checks |
| Branch lifetime | hours | 1-3 days |

## Validation commands

Use current `package.json` first. Current frontend top-level checks include:

```bash
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

Current runtime startup:

```bash
npm start
```

Expected lanes:

```text
legacy/static rehearsal: 4300
Vue canary: 4301
```

If a referenced script does not exist, say so in your handoff and check current `package.json` before inventing replacements.
