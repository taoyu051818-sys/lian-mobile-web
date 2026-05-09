# Agent Docs Index

This directory is the working memory for Codex threads. Treat merged GitHub PRs and current code as more authoritative than older task-board, decision, domain, task, handoff, or contract text.

## Current Source-Of-Truth Rule

When docs disagree, prefer this order:

1. Current code on `main`.
2. Merged GitHub PRs, especially newest PRs.
3. `references/PR_DERIVED_STATUS_2026-05-05.md`.
4. `references/DECISIONS_OVERRIDE_2026-05-05.md` for decision-log conflict handling.
5. `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` for architecture-planning conflict handling.
6. `references/TASK_BOARD_OVERRIDE_2026-05-05.md` for active task-board interpretation.
7. `references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md` for ownership conflict handling.
8. `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` for file-index conflict handling.
9. `references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md` for domain-doc conflict handling.
10. `references/TASK_DOCS_OVERRIDE_2026-05-05.md` for task-doc conflict handling.
11. `references/HANDOFFS_OVERRIDE_2026-05-05.md` for handoff conflict handling.
12. `references/CONTRACTS_OVERRIDE_2026-05-05.md` for API-contract conflict handling.
13. `references/DOC_REVIEW_FINDINGS_2026-05-05.md` for known stale-doc warnings.
14. `docs/agent/FRONTEND_REVIEWER_HANDOFF.md` - frontend review handoff context for continuation.
15. Latest handoff for the task area as context only.
16. Current task doc as scope/history, after override checks.
17. `PROJECT_FILE_INDEX.md` as historical/structural context.
18. Domain docs as business intent and historical context.
19. Contract docs as split-era API inventory, after contract override checks.
20. `ARCHITECTURE_WORKPLAN.md`, `03_FILE_OWNERSHIP.md`, and `04_DECISIONS.md` as historical/planning context.
21. Historical baseline/planning docs.

## Thread Workflow

Default division of labor:

- Codex / code thread: project management, planning, architecture decisions, review, acceptance, and docs status.
- Claude Code thread: implementation inside the approved task boundary.

Do not treat executor handoffs as acceptance. A lane becomes accepted only when the Codex / code review records the validation result in `05_TASK_BOARD.md`, the corresponding task doc, or a newer PR-derived status file.

## Start Here

Read these in order before starting implementation work:

1. `references/PR_DERIVED_STATUS_2026-05-05.md` - newest PR-derived frontend/runtime status
2. `references/DECISIONS_OVERRIDE_2026-05-05.md` - current decision-log override
3. `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` - current architecture-planning override
4. `references/TASK_BOARD_OVERRIDE_2026-05-05.md` - current active task-board interpretation
5. `references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md` - current ownership conflict handling
6. `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` - current file-index conflict handling
7. `references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md` - current domain-doc conflict handling
8. `references/TASK_DOCS_OVERRIDE_2026-05-05.md` - current task-doc conflict handling
9. `references/HANDOFFS_OVERRIDE_2026-05-05.md` - current handoff conflict handling
10. `references/CONTRACTS_OVERRIDE_2026-05-05.md` - current API-contract conflict handling
11. `references/DOC_REVIEW_FINDINGS_2026-05-05.md` - known stale-doc risks and cleanup recommendations
12. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files
13. `docs/agent/FRONTEND_REVIEWER_HANDOFF.md` - frontend review handoff context for continuation
14. `ARCHITECTURE_WORKPLAN.md` - historical architecture direction; verify stale points against overrides and PRs
15. `05_TASK_BOARD.md` - long task context; may contain older status and must be checked against PRs and override files
16. `03_FILE_OWNERSHIP.md` - historical ownership/conflict context; check against ownership override before use
17. `PROJECT_FILE_INDEX.md` - historical file index; check against override before use
18. `04_DECISIONS.md` - historical decision context; check against decisions override before use
19. `domains/<area>.md` - domain intent and historical context; check against domain override before use
20. `tasks/<task>.md` - task scope/history; check against task override before use
21. `handoffs/<task>.md` - thread context only; check against handoffs override before use
22. `contracts/<contract>.md` - split-era contract inventory; check against contracts override and current code before use

## Current Frontend Runtime Snapshot

Current merged PRs and code establish this frontend model:

- `npm start` runs both frontend lanes through `scripts/serve-frontend-runtimes.js`.
- legacy/static rehearsal lane uses port 4300.
- Vue canary lane uses port 4301.
- `npm run test` targets 4300.
- `npm run test:vue-canary` targets 4301.
- `npm run verify` runs check, ops guard, and build.

## Current Domain Docs

Use these for business/domain intent only after reading `references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md`:

- `domains/AI_POST_PREVIEW.md` - AI preview and light publish scope
- `domains/AUDIENCE_SYSTEM.md` - audience/permission model direction
- `domains/FEED_SYSTEM.md` - feed, metadata, scoring, and debug context
- `domains/MAP_SYSTEM.md` - Map v1/v2, location data, editor, and future map work
- `domains/NODEBB_INTEGRATION.md` - NodeBB endpoints, auth modes, posting path, and failure modes

## Current Task Docs

Use `tasks/` for task scope/history only after reading `references/TASK_DOCS_OVERRIDE_2026-05-05.md`. Before starting, compare the task with current code and merged PRs because several older tasks were partially or fully superseded by the Vue canary PR burst and repo split completion.

## Handoffs

Use `handoffs/` for completed-thread summaries and next-thread instructions only after reading `references/HANDOFFS_OVERRIDE_2026-05-05.md`. Handoffs are context transfer notes, not new product scope or durable acceptance records.

Read `handoffs/README.md` for the normalized handoff list and current handoff entrypoint.

## Contracts

Use `contracts/` for split-era API inventory only after reading `references/CONTRACTS_OVERRIDE_2026-05-05.md`. Verify current frontend callers and backend routes before treating any endpoint status, port, or response shape as current.

## References

- `references/PR_DERIVED_STATUS_2026-05-05.md` - newest PR-derived status for the frontend repo
- `references/DECISIONS_OVERRIDE_2026-05-05.md` - current decision override and conflict list
- `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` - current architecture override and conflict list
- `references/TASK_BOARD_OVERRIDE_2026-05-05.md` - current active task-board override
- `references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md` - current file ownership override and conflict list
- `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` - current file-index override and conflict list
- `references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md` - current domain-doc override and conflict list
- `references/TASK_DOCS_OVERRIDE_2026-05-05.md` - current task-doc override and conflict list
- `references/HANDOFFS_OVERRIDE_2026-05-05.md` - current handoff override and conflict list
- `references/CONTRACTS_OVERRIDE_2026-05-05.md` - current contract override and conflict list
- `references/DOC_REVIEW_FINDINGS_2026-05-05.md` - documentation review findings and stale-doc warning list
- `../design/LIAN-Campus-UI-UX-Guidelines-V0.1.md` - LIAN Campus UI / UX Guidelines V0.1
- `references/GITHUB_RECENT_UPDATES_2026-05-05.md` - repo-split and GitHub orientation note
- `references/RECENT_WORK_HANDOFF_2026-05-05.md` - repo-split and docs handoff
- `references/HIGH_RISK_AREAS.md` - high-risk area audits
- `references/GITHUB_RECENT_UPDATES_2026-05-04.md` - historical GitHub commit summary; superseded for repo ownership and recent PR state
- `references/RECENT_WORK_HANDOFF_2026-05-04.md` - historical long-thread handoff; superseded for repo ownership and recent PR state

## Historical References

These files are useful for history but should not override newer PRs or code:

- `01_PROJECT_FACT_BASELINE.md` - early fact baseline
- `MAP_V2_TECH_PLAN.md` - early Map v2 implementation plan
- `domains/FEED_REFACTOR_PLAN.md` - feed refactor planning reference