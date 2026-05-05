# Handoff: PC Task Board Web UI v1

## Date

2026-05-03

## Thread scope

Implementation of read-only PC task board web UI first cut.

## What was built

Static page at `/tools/task-board.html` that fetches `05_TASK_BOARD.md` via a narrow API endpoint and renders a filterable task table.

### Features

- 3-column PC layout: left sidebar (filters), center (task table), right (detail panel)
- Fetches markdown from `GET /api/internal/task-board` at runtime
- Parses `### ` sections into task objects with status, priority, category, human-assisted flags
- Pro Decision execution order parsed for P0/P1/P2 priority mapping
- Sidebar filters: status checkboxes, priority checkboxes, category checkboxes, human-assisted toggle, text search
- Sortable table columns (title, status, priority, category, human-assisted)
- Status badges: Done (green), 待审核 (blue), 待复核 (orange), Blocked (red), Ready (gray), Later (muted), Human-assisted (purple), External (muted)
- Priority badges: P0 (red), P1 (orange), P2 (blue)
- Human-assisted dot indicator for Map tasks
- Detail panel shows full task body, section, task doc link, handoff link
- Top bar shows total/blocked/human counts and P0 execution queue summary

## Files changed

| File | Action |
|---|---|
| `public/tools/task-board.html` | NEW — page shell |
| `public/tools/task-board.css` | NEW — all styles |
| `public/tools/task-board.js` | NEW — parser, renderer, filters, sorting |
| `src/server/task-board-service.js` | NEW — reads and returns markdown as plain text |
| `src/server/api-router.js` | EDIT — added `GET /api/internal/task-board` route |
| `src/server/paths.js` | EDIT — added `taskBoardPath` constant |

## Validation

- `node --check` passed for all 3 new files and both edited files
- `node scripts/test-routes.js` passed 61/61
- Task board markdown file exists and is readable

## Known limitations

- Read-only: no comment write support
- No admin auth on the internal endpoint (task board has no secrets)
- Task parsing is regex-based; unusual markdown formatting may miss some tasks
- Priority mapping relies on Pro Decision section text matching
- Links to task docs/handoffs assume the static server can serve `docs/` files (may need verification)

## Follow-up TODOs

- Add JSONL comment write support with admin auth
- Add task doc content preview in detail panel (fetch and render markdown)
- Add execution queue drag-to-reorder
- Consider admin auth for the endpoint if secrets are ever added to task docs
