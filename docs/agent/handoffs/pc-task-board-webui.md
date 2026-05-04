# Handoff: PC Task Board Web UI

## Date

2026-05-03

## Thread scope

Architecture and project-management planning only. No runtime tool UI was implemented.

## Decision

Add a PC-oriented internal task-board web UI as a project-management task.

The UI should visualize:

- P0/P1 execution order;
- task status;
- blocked tasks;
- human-assisted tasks;
- Map line tasks that Claude Code may not independently develop;
- task docs and handoff links;
- simple human comments.

## Files changed

- `docs/agent/tasks/pc-task-board-webui.md`
- `docs/agent/handoffs/pc-task-board-webui.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/ARCHITECTURE_WORKPLAN.md`
- `docs/agent/tasks/map-v2-admin-editor.md`

## Human assistance rule

Map development is now marked as human-assisted only.

Claude Code threads must not independently implement Map v2 editor/data/render/floor-plan tasks. They may only proceed when a human gives concrete inputs, reviews intermediate outputs, and approves the implementation step.

## Next implementation thread

Build a first-cut read-only `/tools/task-board.html` before adding write/comment APIs.

Preferred first cut:

1. parse or consume exported task metadata;
2. show task table/board;
3. highlight human-assisted tasks;
4. link task docs/handoffs;
5. leave comment write support for a second cut unless easy and admin-protected.
