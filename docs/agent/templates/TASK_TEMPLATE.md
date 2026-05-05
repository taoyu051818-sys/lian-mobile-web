# Task: <task-name>

## Current source check

Record the current sources checked before defining this task:

- Current code on `main`:
- Recent merged PRs checked:
- Root `README.md` / `package.json` checked:
- Relevant override files checked:
  - `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
  - `docs/agent/references/DECISIONS_OVERRIDE_2026-05-05.md`
  - `docs/agent/references/ARCHITECTURE_WORKPLAN_OVERRIDE_2026-05-05.md`
  - `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
  - `docs/agent/references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md`
  - other relevant override files:

If this task resumes an old task/handoff/contract, explain what was revalidated and what is stale.

## Goal

One-sentence description of what this task achieves.

## Product scope

Which user or system flow does this task complete? What can the user do after this task that they cannot do before?

## Repository and ownership scope

- Repository: `lian-mobile-web`
- Owned area: frontend runtime lanes / Vue canary / legacy-static rehearsal / task-board UI / frontend docs / other:
- Backend/API/runtime changes required? If yes, create or reference a backend task in `lian-platform-server` instead of editing backend code here.

## Allowed files

List every file this task may modify or create. Use current repo ownership, not old split-era docs.

- `src/...` or `public/...`
- `scripts/...`
- `docs/agent/tasks/<task-name>.md`

## Forbidden files

List files this task must NOT touch, even if it seems convenient.

- Backend/API/runtime files in `lian-platform-server`
- Runtime data files unless explicitly scoped and approved
- Any file outside this task's allowed list

## Data or state changes

Describe frontend state, API payload, or persisted data implications. If none, write "None."

Do not assume file-backed JSON is the current backend data model. If backend data changes are needed, reference the backend task.

## API or contract changes

Describe any new or modified API needs. If none, write "None."

Before changing API assumptions, check:

- current frontend callers;
- current backend route registry/code;
- `docs/agent/references/CONTRACTS_OVERRIDE_2026-05-05.md`.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Validation commands

Use current `package.json` first. Example frontend checks:

```bash
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

Add targeted browser/manual checks when UI behavior changes.

If a referenced script does not exist, say so in the handoff and check current `package.json` before inventing replacements.

## Risks

- Risk 1: description and mitigation
- Risk 2: description and mitigation

## Rollback plan

How to undo this task if something goes wrong:

- Revert commit ...
- Remove file ...
- Restore previous UI/runtime behavior ...
