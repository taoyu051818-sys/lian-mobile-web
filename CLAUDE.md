# LIAN Agent Rules

## Product direction

LIAN is a campus experience layer for students at the Hainan Lian International Education Innovation Zone. It is not a generic forum frontend.

Priority follows `docs/agent/05_TASK_BOARD.md`. Default priority when the task board is silent:

1. Stabilize NodeBB publishing, auth, and feed flows
2. Improve content operations and AI light posting
3. Advance location model and audience visibility

Do not expand into task market, DM, payment, run errands, drone delivery, or full database migration unless the task explicitly says so.

## Architecture rules

- Keep NodeBB as the community backend. LIAN server owns metadata, location, audience, feed, AI draft, image proxy, and governance.
- Do not rewrite the app into Vue/React/TypeScript unless explicitly assigned.
- Prefer small additive modules over large rewrites.
- Keep `server.js` as thin entry — only http.createServer and top-level routing.
- Keep `api-router.js` as route mounting only — avoid adding business logic there.
- New business logic goes in dedicated service files under `src/server/`.

## High-conflict files

Do not modify these unless the task explicitly allows it:

- `public/app.js` (2151 lines — all frontend logic, highest conflict risk)
- `public/styles.css`
- `src/server/feed-service.js` (recommendation core)
- `src/server/post-service.js` (publishing core)
- `src/server/api-router.js` (route mounting)
- `data/post-metadata.json` (2314 lines — concurrent writes lose data)

If you must change them, describe in your handoff:

1. exact reason
2. affected functions
3. expected conflict risk
4. validation steps

## Forbidden behaviors

- Do NOT format or pretty-print `data/post-metadata.json` or any JSON data file. Only modify entries relevant to your task.
- Do NOT reformat code that is not part of your task scope.
- Do NOT add frameworks, libraries, or dependencies unless explicitly approved.
- Do NOT commit `.env`, API keys, or secrets.
- Do NOT write multi-paragraph comments or docstrings. One short line max.

## File creation rules

- Small changes should not create unnecessary new files. Edit existing files when the change fits.
- It is allowed to create new files when needed for low-conflict modularization: service modules (`src/server/*.js`), scripts (`scripts/*.js`), docs (`docs/agent/**`), and test files.

## NodeBB integration rules

- All NodeBB requests go through `nodebb-client.js`. Do not call NodeBB directly from other files.
- `NODEBB_UID` is the system default user for read operations. Real users get their own `nodebbUid` via `ensureNodebbUid()`.
- `config.nodebbToken` is sent as `x-api-token` header. It is a shared admin token, not per-user.
- Creating topics: `POST /api/v3/topics` with `_uid` param set to the real user's nodebbUid.
- Creating replies: try `POST /api/v3/topics/:tid` first, fall back to `POST /api/v3/topics/:tid/posts`.

## AI publish rules

- AI can only generate editable drafts (title, body, tags, location suggestions, risk flags).
- After the user confirms and submits, the publish flow goes through the existing `createNodebbTopicFromPayload()` / `handleAiPostPublish()` pipeline.
- AI must NOT bypass the unified publish service to call NodeBB directly or write `post-metadata.json` directly.

## Data file rules

- `data/post-metadata.json`: only modify entries for your task's tids. Never sort the entire file. Never batch-modify unrelated entries. Backup to `outputs/` before large changes.
- `data/auth-users.json`: never commit (already in .gitignore). Session data is stored here.
- `data/feed-rules.json`: feed configuration — changes affect all users immediately.
- JSONL files (`ai-post-drafts.jsonl`, `ai-post-records.jsonl`): append-only via code, never hand-edit.

## Required checks before handoff

Run at least:

```bash
node --check server.js
node --check src/server/*.js
```

PowerShell equivalent:

```powershell
Get-ChildItem src/server/*.js | ForEach-Object { node --check $_.FullName }
```

If validation scripts exist, also run:

```bash
node scripts/validate-post-metadata.js
node scripts/validate-locations.js
```

If a script does not exist, say so in your handoff.

## Handoff rules

- Non-trivial tasks (new feature, multi-file change, schema change, API change) must update:
  - `docs/agent/tasks/<task-name>.md`
  - `docs/agent/handoffs/<task-name>.md`
  - Include: files changed, API changed, data schema changed, how to verify, known risks, follow-up TODOs.
- Small fixes (typo, one-line bug fix, config tweak) can summarize in chat only, unless the user explicitly asks for a written handoff.

## Branch and worktree rules

- `main`: stable deployable only
- `integration`: daily merge target for testing
- `agent/*`: one task per branch, 1-3 day lifetime
- All agent branches fork from `integration`
- Each branch must have a handoff before merge
- Max 2 implementation agents + 1 review agent + 1 planning agent running simultaneously

## Commit message format

```text
feat(location): add locations API
feat(audience): add canViewPost
fix(feed): filter linkOnly from home feed
chore(agent): update audience handoff
test(audience): add visibility matrix script
```

## PR merge checklist

Every PR must answer:

1. What user-facing flow does this complete?
2. Which high-conflict files were changed?
3. Does this change the data schema?
4. Does this change the API?
5. Does this affect NodeBB posting?
6. Does this affect feed/detail/map/search permissions?
7. Is there a rollback plan?
8. Is the handoff updated?
9. Did `node --check` pass?
10. Is there a curl or screenshot verification?
