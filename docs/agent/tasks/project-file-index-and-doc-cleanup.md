# Task: Project File Index And Documentation Cleanup

Status: P0 / Ready

Created: 2026-05-03

## Goal

Make the repository understandable without relying on chat history.

This task audits every project file category, verifies whether it is indexed in `docs/agent`, and removes or clearly marks old, contradictory, vague, or misleading documentation.

The goal is not to refactor runtime code. The goal is to make ownership, current truth, legacy status, and cleanup decisions explicit before larger frontend/backend repo split work continues.

## Why This Is P0

The project now has many parallel task lanes, handoffs, generated outputs, runtime data files, old prototypes, and documentation layers. Several docs still contain stale facts or conflicting status language.

Without this cleanup:

- new Codex threads may follow outdated baseline docs instead of current code;
- old generated files in `outputs/` may be mistaken for maintained source;
- task board statuses may be interpreted incorrectly;
- frontend/backend split work may move the wrong files;
- mojibake or old labels may be reintroduced by copying stale docs;
- real review blockers may be hidden by newer "fixed" summaries.

## Current Audit Snapshot

Audited on 2026-05-03 using repository file listing and documentation text search.

Important observed file groups:

| Group | Current state | Documentation/index risk |
|---|---|---|
| `src/server/*` | Backend is modularized and active. | Mostly indexed in ownership docs, but some newer files such as `notification-service.js` need explicit ownership/status confirmation. |
| `public/*` | Frontend has been split into classic-script modules. | Indexed, but old descriptions still say `public/app.js` is a single-file bottleneck in historical docs. |
| `public/tools/*` | Map editor tools are active internal tooling. | Indexed through map tasks/handoffs, but should have a concise canonical file index. |
| `public/menu-prototype*` | Menu prototypes exist in the main public tree. | Need explicit status: active demo, experimental, or archive candidate. |
| `public/assets/*` | Mixed current map assets, icons, and Chinese filename asset. | Need asset index and ownership notes. |
| `data/*` | Runtime data and config-like JSON coexist. | Needs split between committed fixtures/config, local runtime state, backups, and generated records. |
| `data/post-metadata.json.bak` | Present as an untracked backup. | Should be ignored, archived, or deleted after confirmation; current `.gitignore` covers timestamped `.bak-*`, not plain `.bak`. |
| `outputs/*` | Feed snapshots, generated post scripts, club images, result JSON, generated assets. | Needs generated/archive policy. Some ignored outputs still exist locally; scripts inside `outputs/` should not be treated as maintained source. |
| `scripts/*` | Validation, smoke, deploy, seed, and maintenance scripts. | Mostly indexed by ownership docs, but each script needs lifecycle status: active, one-shot, legacy, or deploy-only. |
| `docs/agent/*` | Main coordination layer. | Has multiple historical/planning docs; needs conflict resolution and source-of-truth order enforcement. |
| root docs | `README.md`, `CLAUDE.md`, `EDITORIAL_PRINCIPLES.md`. | Need explicit relation to `docs/agent/*`; some may be stale relative to current architecture. |

## Known Documentation Problems To Resolve

### 1. Stale baseline facts

`docs/agent/01_PROJECT_FACT_BASELINE.md` is marked historical, but still contains stale statements such as:

- frontend described as a single `public/app.js` file;
- Map described as no Leaflet / no interactive map;
- `validate-locations.js` described as not existing;
- notifications call site described as `channel-service.js` instead of the newer notification service;
- technology/testing appendix says no automated tests, while multiple validation and smoke scripts now exist.

Required action: keep it as historical only, or replace stale sections with a short pointer to current docs.

### 2. Mojibake in documentation

Several docs display mojibake in Chinese labels and status text, especially:

- `docs/agent/README.md`
- `docs/agent/03_FILE_OWNERSHIP.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/01_PROJECT_FACT_BASELINE.md`

Required action: fix docs encoding text or replace affected Chinese with clear English labels. Do not copy mojibake into new runtime UI.

### 3. Conflicting task board sections

`docs/agent/05_TASK_BOARD.md` contains older blocker sections and newer fix-pass sections for the same work. Some are now intentionally historical, but this is not visually obvious enough.

Examples:

- "Review Fix Pass" says prior blockers are no longer open blockers.
- Later "Review Blockers" sections still say some tasks are not approved.
- Lane F is currently `待复核`, which is correct, but must stay clearly separate from accepted lanes.

Required action: add clear status taxonomy and move historical blocker records under an explicit audit log section.

### 4. File ownership drift

`docs/agent/03_FILE_OWNERSHIP.md` has outdated or inconsistent ownership language:

- conflict definitions mention `hard-lock`, `soft-lock`, `open`, but tables use `hard-review`;
- some owner cells contain mojibake placeholders;
- new files are not fully indexed;
- `outputs/` is not described with enough lifecycle rules.

Required action: normalize conflict levels and add every active file group.

### 5. Generated files are mixed with source-like files

`outputs/` contains generated markdown, generated JSON, executable `.cjs` scripts, and large image directories. Some are ignored by `.gitignore`, some remain visible in local file listings.

Required action: classify each output path:

- kept artifact;
- local-only generated artifact;
- one-shot script archive;
- delete candidate;
- move-to-`scripts/archive` candidate;
- ignore-rule update candidate.

### 6. Runtime data, local state, and committed config are mixed

`data/` contains:

- committed product data/config: `feed-rules.json`, `post-metadata.json`, `locations.json`, `map-v2-layers.json`, `clubs.json`;
- local runtime/user state: `auth-users.json`, `channel-reads.json`, JSONL AI records;
- backups: `post-metadata.json.bak`;
- discovery/test artifacts.

Required action: document which files are source-of-truth, which are local-only, and which should never be committed.

### 7. Legacy naming is not always explicit

Files such as `public/app-legacy-map.js` may still be used as compatibility code, while some docs call it old or legacy. That is acceptable only if the current role is explicit.

Required action: add "legacy but active compatibility" vs "dead legacy" labels.

### 8. Root-level docs lack an ownership map

Root docs exist outside `docs/agent`:

- `README.md`
- `CLAUDE.md`
- `EDITORIAL_PRINCIPLES.md`

Required action: define whether each is current, historical, or subordinate to `docs/agent`.

## Scope

Allowed files:

- `docs/agent/README.md`
- `docs/agent/03_FILE_OWNERSHIP.md`
- `docs/agent/04_DECISIONS.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/01_PROJECT_FACT_BASELINE.md`
- `docs/agent/domains/*.md`
- `docs/agent/tasks/*.md`
- `docs/agent/handoffs/README.md`
- optionally new docs under `docs/agent/references/`
- optionally `.gitignore`, but only after explicit approval

Read-only audit targets:

- `server.js`
- `src/server/*`
- `public/*`
- `public/tools/*`
- `public/assets/*`
- `data/*`
- `scripts/*`
- `outputs/*`
- root docs

Do not modify runtime code in this task.

## Required Deliverables

### Deliverable 1: Canonical project file index

Create or update a canonical index that lists every important file group:

- purpose;
- active/legacy/generated/local-only status;
- owner/conflict level;
- related task/handoff/domain docs;
- whether it belongs in future frontend repo or backend repo.

Recommended file:

```text
docs/agent/PROJECT_FILE_INDEX.md
```

### Deliverable 2: Documentation source-of-truth map

Update `docs/agent/README.md` so new threads know exactly which docs to trust first.

The source-of-truth order should distinguish:

- current code;
- current task;
- latest handoff;
- domain docs;
- decisions;
- historical baseline;
- generated outputs.

### Deliverable 3: Task board cleanup

Update `docs/agent/05_TASK_BOARD.md`:

- define status terms: Done, Accepted, 待审核, 待复核, Blocked, Superseded, Historical;
- move old blocker records into an "Audit Log" section;
- remove or clearly mark duplicate task descriptions;
- keep P0 repo split and this cleanup task visible.

### Deliverable 4: Ownership cleanup

Update `docs/agent/03_FILE_OWNERSHIP.md`:

- normalize conflict levels;
- add missing files/groups;
- add generated-output policy;
- add data-file policy;
- add frontend/backend repo-split destination.

### Deliverable 5: Old/stale expression report

Create a short report listing:

- stale statements found;
- contradictory status statements;
- mojibake locations;
- legacy files needing current status;
- generated/local files that need ignore/archive/delete decisions.

Recommended file:

```text
docs/agent/references/DOC_CLEANUP_AUDIT_2026-05-03.md
```

### Deliverable 6: Optional ignore/archive recommendations

Do not delete files in this task unless explicitly requested.

Instead, document recommended actions for:

- `data/post-metadata.json.bak`;
- `outputs/club-posts/images/`;
- `outputs/menu-post-*.cjs`;
- generated feed snapshots;
- generated seed result JSON;
- one-shot scripts in `outputs/`.

## Acceptance Criteria

- Every top-level directory has an explicit documentation index entry.
- Every active `src/server/*` file has an owner/status entry.
- Every active `public/*.js` file has an owner/status entry.
- `outputs/` is clearly marked as generated/archive, not source.
- `data/` files are separated into committed product data, local runtime state, generated records, and backups.
- Old statements in `01_PROJECT_FACT_BASELINE.md` are clearly marked historical or replaced with pointers.
- `05_TASK_BOARD.md` no longer presents contradictory statuses without an explicit audit-log explanation.
- Mojibake in current docs is either fixed or listed as a remaining cleanup item with exact file references.
- No runtime code is changed.

## Validation

Use read-only checks where possible:

```bash
node scripts/validate-project-structure.js
git status --short
```

Manual validation:

- open `docs/agent/README.md` and confirm a new thread can find the current task board, current architecture, and file index;
- open `docs/agent/05_TASK_BOARD.md` and confirm status terms are not contradictory;
- open `docs/agent/03_FILE_OWNERSHIP.md` and confirm every active file group has an owner/status;
- scan for mojibake in current docs before marking complete.

## Non-Goals

- No runtime refactor.
- No recommendation changes.
- No frontend UI changes.
- No backend API changes.
- No deletion of local generated files without explicit approval.
- No repo split execution in this task; only documentation preparation for repo split.

## Suggested Execution Order

1. Generate complete file inventory.
2. Compare inventory against `docs/agent/03_FILE_OWNERSHIP.md`.
3. Compare docs index against actual docs under `tasks/`, `handoffs/`, `domains/`, `references/`.
4. Mark generated/output/local-only files.
5. Fix doc source-of-truth order.
6. Normalize task board statuses.
7. Write audit report.
8. Run project structure validation.
9. Handoff with remaining unresolved decisions.

