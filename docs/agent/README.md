# Agent Docs Index

This directory is the working memory for Codex threads. Treat merged GitHub PRs and current code as more authoritative than older task-board or handoff text.

## Current Source-Of-Truth Rule

When docs disagree, prefer this order:

1. Current code on `main`.
2. Merged GitHub PRs, especially newest PRs.
3. `references/PR_DERIVED_STATUS_2026-05-05.md`.
4. `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` for architecture-planning conflict handling.
5. `references/TASK_BOARD_OVERRIDE_2026-05-05.md` for active task-board interpretation.
6. `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` for file-index conflict handling.
7. `references/DOC_REVIEW_FINDINGS_2026-05-05.md` for known stale-doc warnings.
8. Latest handoff for the task area.
9. Current task doc.
10. `PROJECT_FILE_INDEX.md` as historical/structural context.
11. Domain docs.
12. `ARCHITECTURE_WORKPLAN.md` and `04_DECISIONS.md` as historical/planning context.
13. Historical baseline/planning docs.

## Thread Workflow

Default division of labor:

- Codex / code thread: project management, planning, architecture decisions, review, acceptance, and docs status.
- Claude Code thread: implementation inside the approved task boundary.

Do not treat executor handoffs as acceptance. A lane becomes accepted only when the Codex / code review records the validation result in `05_TASK_BOARD.md`, the corresponding task doc, or a newer PR-derived status file.

## Start Here

Read these in order before starting implementation work:

1. `references/PR_DERIVED_STATUS_2026-05-05.md` - newest PR-derived frontend/runtime status
2. `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` - current architecture-planning override
3. `references/TASK_BOARD_OVERRIDE_2026-05-05.md` - current active task-board interpretation
4. `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` - current file-index conflict handling
5. `references/DOC_REVIEW_FINDINGS_2026-05-05.md` - known stale-doc risks and cleanup recommendations
6. `00_AGENT_RULES.md` - operating rules, validation, high-conflict files
7. `ARCHITECTURE_WORKPLAN.md` - historical architecture direction; verify stale points against overrides and PRs
8. `05_TASK_BOARD.md` - long task context; may contain older status and must be checked against PRs and override files
9. `03_FILE_OWNERSHIP.md` - ownership and conflict boundaries; verify stale points against overrides and PRs
10. `PROJECT_FILE_INDEX.md` - historical file index; check against override before use
11. `04_DECISIONS.md` - recorded architecture/product decisions
12. `domains/<area>.md` - domain context for the task area
13. `tasks/<task>.md` - current task specification, if present
14. `handoffs/<task>.md` - latest thread handoff, if present

## Current Frontend Runtime Snapshot

Current merged PRs and code establish this frontend model:

- `npm start` runs both frontend lanes through `scripts/serve-frontend-runtimes.js`.
- legacy/static rehearsal lane uses port 4300.
- Vue canary lane uses port 4301.
- `npm run test` targets 4300.
- `npm run test:vue-canary` targets 4301.
- `npm run verify` runs check, ops guard, and build.

## Current Domain Docs

- `domains/AI_POST_PREVIEW.md` - AI preview and light publish scope
- `domains/AUDIENCE_SYSTEM.md` - audience/permission model direction
- `domains/FEED_SYSTEM.md` - feed, metadata, scoring, and debug context
- `domains/MAP_SYSTEM.md` - Map v1/v2, location data, editor, and future map work
- `domains/NODEBB_INTEGRATION.md` - NodeBB endpoints, auth modes, posting path, and failure modes

## Current Task Docs

Use `tasks/` for active or ready-to-resume implementation specs. A task doc should describe scope, allowed files, acceptance criteria, validation, and rollback notes. Before starting, compare the task with merged PRs because several older tasks were partially or fully superseded by the Vue canary PR burst.

## Handoffs

Use `handoffs/` for completed-thread summaries and next-thread instructions. Handoffs are context transfer notes, not new product scope.

Read `handoffs/README.md` for the normalized handoff list.

## References

- `references/PR_DERIVED_STATUS_2026-05-05.md` - newest PR-derived status for the frontend repo
- `references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md` - current architecture override and conflict list
- `references/TASK_BOARD_OVERRIDE_2026-05-05.md` - current active task-board override
- `references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md` - current file-index override and conflict list
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
