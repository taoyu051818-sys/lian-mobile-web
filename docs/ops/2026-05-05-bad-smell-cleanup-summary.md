# 2026-05-05 bad-smell cleanup summary

## Purpose

This document records the project bad-smell cleanup work performed around Feed service extraction, frontend Vue migration, rollback, and operational guardrails.

It exists to prevent the same mistakes from becoming tribal knowledge. Future developers and operators should be able to understand what happened, what was reverted, and which rules now protect the project.

## Work completed

### Backend Feed service cleanup

The backend Feed cleanup was handled as a small extraction slice instead of a large rewrite.

Completed work:

- Extracted Feed scoring, diversity, score breakdown, and moment scoring helpers into a dedicated module.
- Added focused unit tests for deterministic scoring behavior.
- Kept the first extraction low risk by not changing the production Feed handler call path in the same step.
- Fixed an image proxy regression by restricting Cloudinary image URLs to configured accounts instead of accepting arbitrary Cloudinary account paths.

Result:

- The Feed scoring logic now has a testable module boundary.
- Future Feed service cleanup can import the helper module and remove duplicated local functions in a separate PR.

### Frontend Vue migration attempt

A Vue migration branch introduced a Vue Feed API preview and changed the default frontend runtime toward the Vue/Vite `dist` output.

Completed work in that attempt:

- Added a Feed API composable for read-only `/api/feed` loading.
- Rendered a Vue Feed API preview in `FeedView.vue`.
- Updated the static rehearsal server and smoke tests to validate Vue/Vite assets.
- Updated structure checks so legacy JavaScript files were no longer mandatory.

Issue found after merge:

- The Vue Feed API preview did not have feature parity with the legacy frontend.
- The default entrypoint was changed before key product flows had Vue replacements or explicit fallbacks.
- The visible product regressed because users saw a partial Vue shell instead of the existing product experience.

Resolution:

- The frontend `main` branch was restored to the pre-default-Vue state.
- Vue migration work remains valid as a shadow/canary direction, but must not become the default entry until feature parity and fallback rules are satisfied.

## Incident lessons

### 1. Preview code must not become the default product path

A preview can be useful for migration work, but it must remain behind an explicit shadow, canary, or non-default entry.

A PR must not switch the default frontend entrypoint unless one of the following is true:

- The replacement has feature parity for critical product flows.
- Missing flows have an explicit and tested fallback.
- Missing flows are intentionally disabled and documented as a product decision.

### 2. Runtime behavior is part of the code contract

Changing startup scripts, static roots, proxy behavior, service names, ports, or default entrypoints is a runtime contract change.

Runtime contract changes must be reviewed with the same care as source code changes. They must include rollback notes and update the runtime inventory or its schema.

### 3. Do not infer operations details from repository names

The frontend repository name, process name, and service name are not interchangeable. The incident showed that guessing process managers or service names can waste time and spread incorrect instructions.

Runtime facts need a single source of truth and automated checks.

## Guardrails added

### PR template

The repository now includes a pull request template requiring:

- Scope and non-goals.
- Runtime impact checklist.
- Migration and fallback matrix for frontend work.
- Verification checklist.
- Risk notes.

### Runtime inventory schema

The repository now includes `ops/runtime-inventory.schema.json`.

The schema defines the shape for runtime facts such as:

- Repository identity.
- Working directory.
- Runtime manager.
- Runtime name.
- HTTP port.
- Health check path.

The actual inventory should be maintained by the environment owner or deployment automation when concrete runtime details change.

### Runtime inventory guard

The repository now includes `scripts/guard-runtime-inventory.js`.

The guard checks that:

- Runtime governance files exist.
- The runtime inventory schema has the expected shape.
- Known-bad guessed runtime aliases do not reappear in repository text.
- Runtime-sensitive files are not changed without also updating an ops inventory artifact.

Runtime-sensitive examples include:

- `package.json`
- frontend entry HTML
- static server scripts
- smoke tests
- structure validation scripts
- CI workflow files
- ops documentation or inventory files

## Required future process

### For frontend migration PRs

Every frontend migration PR must declare the status of these areas:

| Area | Required status |
| --- | --- |
| Feed | Vue, legacy fallback, explicitly disabled, or not touched |
| Detail | Vue, legacy fallback, explicitly disabled, or not touched |
| Map | Vue, legacy fallback, explicitly disabled, or not touched |
| Publish | Vue, legacy fallback, explicitly disabled, or not touched |
| Messages | Vue, legacy fallback, explicitly disabled, or not touched |
| Profile | Vue, legacy fallback, explicitly disabled, or not touched |

A default entrypoint switch is blocked unless critical flows have either Vue parity or a documented fallback.

### For runtime-sensitive changes

A PR that changes runtime-sensitive files must update an ops inventory artifact in the same PR.

Examples:

- Changing startup scripts.
- Changing static serving behavior.
- Changing the default frontend entry.
- Changing port assumptions.
- Changing smoke tests that represent production runtime behavior.
- Adding or removing a workflow that affects deployment checks.

### For rollback work

Rollback instructions must name the exact affected concern, but should avoid spreading unverified command guesses.

A rollback note should say:

- What changed.
- Which user-visible behavior regressed.
- Which commit or PR restores the previous behavior.
- Which runtime inventory entry or deployment automation owns the restart procedure.

## Current status

- Backend Feed scoring extraction is merged and safe to build upon.
- Frontend Vue default-entry migration was rolled back from `main`.
- Runtime inventory schema and guardrails are merged into `main`.
- Future Vue work should proceed as shadow/canary work until feature parity is ready.

## Next recommended work

1. Add a concrete runtime inventory file through the deployment owner or automation path.
2. Wire `npm run ops:guard` or an equivalent runtime guard into CI.
3. Reintroduce Vue migration only as shadow/canary, not default entry.
4. Continue Feed service cleanup by switching production Feed scoring calls to the extracted helper module in a separate backend PR.
5. Add a runtime smoke test that checks the intended entrypoint without requiring manual server knowledge.
