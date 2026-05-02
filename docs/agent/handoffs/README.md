# Agent Handoffs

Use this directory for thread handoff notes when a Codex thread changes behavior, performs validation, or leaves follow-up decisions for another thread.

Normalized handoffs live here:

- `admin-editor-v1.md`
- `ai-light-publish-flow.md`
- `ai-post-preview.md`
- `ai-publish-polish.md`
- `alias-phase-1.md`
- `alias-phase-2.md`
- `alias-phase-3.md`
- `audience-permission-design.md`
- `audience-system-phase1-3.md`
- `feed-optimization.md`
- `feed-ops-snapshot-diff.md`
- `frontend-app-split.md`
- `frontend-stability-smoke.md`
- `map-v2-editor.md`
- `map-v2-gaode.md`
- `map-v2-restore-legacy-geo.md`
- `nodebb-integration-audit.md`
- `post-metadata-gap-check.md`
- `road-draw-mvp.md`

## Relationship To Numbered Docs

Numbered docs such as `../04_DECISIONS.md` and `../05_TASK_BOARD.md` are the current workspace entry points. Handoff files in this directory record thread context for the next thread.

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

A handoff transfers context. It should not silently introduce new product scope.

## Current Architect Entry Point

Read `../ARCHITECTURE_WORKPLAN.md` before starting a new implementation thread.
