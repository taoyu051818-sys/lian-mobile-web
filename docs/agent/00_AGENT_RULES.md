# Agent Rules Quick Reference

Every Agent session must read this file before making changes.

## Startup checklist

Read these files at the start of every task:

1. `CLAUDE.md` - project-wide rules
2. `docs/agent/README.md` - docs index and source-of-truth order
3. `docs/agent/00_AGENT_RULES.md` - this file
4. `docs/agent/ARCHITECTURE_WORKPLAN.md` - current architecture direction
5. `docs/agent/05_TASK_BOARD.md` - current priorities and task status
6. `docs/agent/03_FILE_OWNERSHIP.md` - file conflict levels
7. `docs/agent/tasks/<your-task>.md` - your task details (if exists)
8. `docs/agent/handoffs/<your-task>.md` - previous handoff (if exists)

## Forbidden actions

- Do NOT format or pretty-print any JSON data file
- Do NOT reformat code outside your task scope
- Do NOT add frameworks or dependencies without approval
- Do NOT commit `.env`, API keys, or secrets
- Do NOT bypass `createNodebbTopicFromPayload()` / `handleAiPostPublish()` to call NodeBB directly
- Do NOT write `post-metadata.json` directly from AI code
- Do NOT do large rewrites unless the task explicitly says so

## High-conflict files

| File | Level | Reviewer |
|---|---|---|
| `public/app.js` | soft-lock | Programmer B |
| `public/styles.css` | soft-lock | Programmer B |
| `src/server/feed-service.js` | hard-review | Programmer A |
| `src/server/post-service.js` | hard-review | Programmer A |
| `src/server/api-router.js` | soft-lock | either, but only route mounting |
| `data/post-metadata.json` | soft-lock | no bulk edits |

- **soft-lock**: can modify, but must check the current task doc first
- **hard-review**: can submit, but must get owner review before merge

## Parallel development boundaries

These modules can be developed in parallel with minimal conflict:

- `src/server/audience-service.js` (new) 鈥?independent of location
- `src/server/location-service.js` (new) 鈥?independent of audience
- `scripts/validate-*.js` (new) 鈥?read-only scripts, no conflict
- `docs/agent/**` 鈥?documentation only
- `public/location-ui.js` / `public/audience-ui.js` (new) 鈥?if app.js is split

These modules conflict with each other and should not be modified simultaneously:

- `feed-service.js` + `post-service.js` 鈥?both touch publishing and metadata
- `app.js` + any new `public/*.js` 鈥?if app.js is not yet split, adding files requires coordinating with the app.js owner

## Small task vs large task

| | Small task (typo, config, one-line fix) | Large task (new feature, multi-file, schema change) |
|---|---|---|
| Task doc | not required | required in `docs/agent/tasks/` |
| Handoff | chat summary is enough | must write `docs/agent/handoffs/` |
| Plan mode | not needed | required for 3+ files or touching core services |
| Verification | `node --check` on changed files | full validation scripts + manual curl |
| Branch lifetime | hours | 1-3 days |

## Validation commands

```bash
node --check server.js
node --check src/server/*.js
```

```powershell
Get-ChildItem src/server/*.js | ForEach-Object { node --check $_.FullName }
```

If validation scripts exist:

```bash
node scripts/validate-post-metadata.js
node scripts/validate-locations.js
```

If a script does not exist, say so in your handoff.
