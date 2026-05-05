# Task: PC Task Board Web UI

## Goal

Build a PC-oriented web UI for the project task board so humans can view task status, inspect handoffs, and leave simple coordination messages without editing Markdown directly.

## Product scope

This is an internal project-management tool. It is not a student-facing LIAN feature.

The tool should help humans supervise multi-agent work, especially tasks that require human approval such as Map v2 design/editing.

## Current problem

The current task board lives in Markdown:

- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/tasks/*`
- `docs/agent/handoffs/*`

This works for agents, but it is weak for human project management:

- hard to scan task state;
- hard to tell which tasks are blocked by human review;
- hard to leave short human notes;
- hard to distinguish accepted work from executor reports;
- hard to see which tasks Claude Code may not independently implement.

## Allowed files

Planning/docs:

- `docs/agent/tasks/pc-task-board-webui.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/handoffs/pc-task-board-webui.md`

Future implementation may modify or add:

- `public/tools/task-board.html`
- `public/tools/task-board.css`
- `public/tools/task-board.js`
- `src/server/task-board-service.js`, if server-side Markdown/JSON reading is needed
- `src/server/api-router.js`, only for narrow internal task-board endpoints
- `data/task-board-comments.jsonl`, if comments are stored server-side
- `scripts/export-task-board.js`, if Markdown-to-JSON export is chosen

## Forbidden files

For this documentation thread:

- `public/*`
- `src/server/*`
- `data/*`
- `server.js`

For future implementation:

- Do not change runtime LIAN user-facing app behavior.
- Do not edit feed ranking.
- Do not modify NodeBB publish/reply logic.
- Do not write comments into task Markdown directly from the browser unless a clear audit/backup plan exists.
- Do not allow unauthenticated public users to write task-board comments.

## Data schema changes

First version may use read-only Markdown parsing plus optional JSONL comments.

Suggested comment record:

```json
{
  "id": "comment-...",
  "taskId": "publish-v2-browser-acceptance",
  "author": "human",
  "role": "owner",
  "message": "Needs browser check on real phone.",
  "statusHint": "needs-human-review",
  "createdAt": "2026-05-03T00:00:00.000Z"
}
```

Suggested derived task fields:

```json
{
  "id": "publish-v2-browser-acceptance",
  "title": "Publish V2 Browser Acceptance",
  "status": "P0",
  "ownerType": "human_review",
  "allowedExecutor": "human_assisted",
  "taskDoc": "docs/agent/tasks/publish-v2-browser-acceptance.md",
  "handoff": "",
  "blockedBy": [],
  "notes": []
}
```

## API changes

Optional first-cut internal APIs:

- `GET /api/internal/task-board` returns parsed task board data.
- `GET /api/internal/task-board/comments` returns comments.
- `POST /api/internal/task-board/comments` appends a comment.

These endpoints must be internal/admin protected if implemented. A static read-only version may be built first without APIs.

## UI requirements

PC layout:

- left sidebar: status filters and workstream filters;
- center: task columns or table;
- right panel: selected task details, task doc link, handoff link, human notes;
- top bar: current priority order and blocked/human-required count.

Core views:

- P0/P1 execution queue;
- blocked tasks;
- human-assisted tasks;
- Claude-allowed tasks;
- accepted/done tasks;
- map-development tasks;
- repo-split tasks.

Task card fields:

- title;
- status;
- priority;
- owner thread type;
- allowed executor;
- human assistance required yes/no;
- task doc link;
- handoff link;
- last updated date if available.

Simple human communication:

- add short comment;
- mark "needs human review";
- mark "human approved to proceed";
- mark "blocked by product decision";
- mark "do not let Claude Code independently implement".

## Map development rule integration

The UI must clearly surface the new Map line rule:

```text
Map development requires human assistance.
Claude Code threads may not independently develop Map v2 editor, Map v2 data, routes, assets, building hierarchy, or render workflow.
```

Map tasks should show a visible `Human-assisted only` badge.

## Acceptance criteria

- [ ] PC page can display the current task board in a scannable table or board.
- [ ] Human-assisted tasks are visually distinct.
- [ ] Map v2 tasks are marked human-assisted only.
- [ ] Task cards link to task docs and handoffs.
- [ ] P0/P1 execution order is visible.
- [ ] Simple human comments can be viewed; if write support is implemented, comments append to JSONL with timestamps.
- [ ] The UI does not expose secrets or runtime data.
- [ ] The UI does not require editing Markdown manually for basic human notes, if comment write support is implemented.
- [ ] The implementation has a read-only fallback if comment API is not ready.

## Validation commands

If static-only:

```bash
node --check public/tools/task-board.js
node scripts/smoke-frontend.js http://localhost:4100
```

If server APIs are added:

```bash
node --check src/server/task-board-service.js
node --check src/server/api-router.js
node scripts/test-routes.js
```

Manual browser check:

```text
1. Open /tools/task-board.html.
2. Filter P0 tasks.
3. Filter human-assisted tasks.
4. Open a Map v2 task and confirm Human-assisted only is visible.
5. Open a task doc/handoff link.
6. Add a comment if write support exists.
```

## Risks

- Risk: Tool becomes a second source of truth. Mitigation: task Markdown remains source of truth; comments are append-only side notes.
- Risk: Browser writes corrupt docs. Mitigation: first cut should use JSONL comments, not direct Markdown rewrites.
- Risk: Unauthorized users can see or write internal notes. Mitigation: protect write endpoints and consider protecting the whole tool.
- Risk: Scope expands into a full project-management SaaS. Mitigation: first cut is read/filter/comment only.

## Rollback plan

- Remove the static tool page and any internal endpoints.
- Preserve Markdown task board as the canonical source of truth.
- If comment JSONL causes problems, stop reading it and keep it as an archive.
