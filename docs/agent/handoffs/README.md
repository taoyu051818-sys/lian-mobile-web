# Agent Handoffs

Use this directory for thread handoff notes when a Codex thread changes behavior, performs validation, or leaves follow-up decisions for another thread.

Handoffs are context-transfer notes. They are not acceptance records and must not override current code, merged GitHub PRs, `../references/PR_DERIVED_STATUS_2026-05-05.md`, or the dated override files.

## Current Entry Point

Before reading individual handoffs, start here:

1. `../references/PR_DERIVED_STATUS_2026-05-05.md`
2. `../references/DECISIONS_OVERRIDE_2026-05-05.md`
3. `../references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md`
4. `../references/TASK_BOARD_OVERRIDE_2026-05-05.md`
5. `../references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md`
6. `../references/PROJECT_FILE_INDEX_OVERRIDE_2026-05-05.md`
7. `../references/DOMAIN_DOCS_OVERRIDE_2026-05-05.md`
8. `../references/TASK_DOCS_OVERRIDE_2026-05-05.md`
9. `../references/HANDOFFS_OVERRIDE_2026-05-05.md`
10. `../references/DOC_REVIEW_FINDINGS_2026-05-05.md`

Only then read `../ARCHITECTURE_WORKPLAN.md`, `../05_TASK_BOARD.md`, `../04_DECISIONS.md`, or individual handoffs as historical/context material.

## Normalized Handoffs

- `admin-editor-v1.md`
- `ai-light-publish-flow.md`
- `ai-post-preview.md`
- `ai-publish-polish.md`
- `alias-phase-1.md`
- `alias-phase-2.md`
- `alias-phase-3.md`
- `audience-permission-design.md`
- `asset-placement-phase2.md`
- `audience-system-phase1-3.md`
- `curves-route-semantics-phase1c.md`
- `feed-optimization.md`
- `feed-ops-snapshot-diff.md`
- `frontend-app-split.md`
- `frontend-stability-smoke.md`
- `implementation-batch-2026-05-02.md`
- `map-v2-editor.md`
- `map-v2-gaode.md`
- `map-v2-road-network-import-preview.md`
- `map-v2-restore-legacy-geo.md`
- `nodebb-integration-audit.md`
- `post-metadata-gap-check.md`
- `pc-task-board-webui.md`
- `p0-publish-profile-nodebb-regression-fix.md`
- `pro-engineering-decision-task-split.md`
- `repo-split-frontend-backend.md`
- `road-draw-mvp.md`
- `road-junctions-phase1b.md`

## Relationship To Numbered Docs

Numbered docs such as `../04_DECISIONS.md` and `../05_TASK_BOARD.md` are historical/planning context unless current PRs and overrides confirm they are still accurate.

## Recommended Handoff Sections

- Date
- Thread scope
- Files changed
- Validation run
- Decisions made
- Risks
- Rollback notes, if behavior changed
- Next thread instructions

## Rule

A handoff transfers context. It should not silently introduce new product scope, claim durable acceptance, or replace current PR/code-derived status.
