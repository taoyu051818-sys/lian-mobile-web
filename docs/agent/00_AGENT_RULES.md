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

- Do NOT format or pretty-print any JSON data file
- Do NOT reformat code outside your task scope
- Do NOT add frameworks or dependencies without approval
- Do NOT commit `.env`, API keys, or secrets
- Do NOT bypass `createNodebbTopicFromPayload()` / `handleAiPostPublish()` to call NodeBB directly
- Do NOT write `post-metadata.json` directly from AI code
- Do NOT do large rewrites unless the task explicitly says so
- Do NOT mark a lane as accepted from the executor thread. Only reviewer validation can move it to accepted.

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

- `src/server/audience-service.js` (new) -independent of location
- `src/server/location-service.js` (new) -independent of audience
- `scripts/validate-*.js` (new) -read-only scripts, no conflict
- `docs/agent/**` -documentation only
- `public/location-ui.js` / `public/audience-ui.js` (new) -if app.js is split

These modules conflict with each other and should not be modified simultaneously:

- `feed-service.js` + `post-service.js` -both touch publishing and metadata
- `app.js` + any new `public/*.js` -if app.js is not yet split, adding files requires coordinating with the app.js owner

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
