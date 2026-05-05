# Task: <task-name>

## Goal

One-sentence description of what this task achieves.

## Product scope

Which user or system flow does this task complete? What can the user do after this task that they cannot do before?

## Allowed files

List every file this task may modify or create:

- `src/server/example-service.js`
- `scripts/example-script.js`
- `docs/agent/tasks/<task-name>.md`

## Forbidden files

List files this task must NOT touch, even if it seems convenient:

- `public/app.js` (unless explicitly allowed)
- `src/server/feed-service.js` (unless explicitly allowed)

## Data schema changes

Describe any changes to JSON data structures. If none, write "None."

- New fields added to `post-metadata.json`: ...
- New JSONL file: `data/example.jsonl`

## API changes

Describe any new or modified endpoints. If none, write "None."

- `GET /api/example` — returns ...
- `POST /api/example` — accepts ..., returns ...

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

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

## Risks

- Risk 1: description and mitigation
- Risk 2: description and mitigation

## Rollback plan

How to undo this task if something goes wrong:

- Revert commit ...
- Remove file ...
- Restore `data/...` from backup
