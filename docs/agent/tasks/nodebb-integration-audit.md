# Task: nodebb-integration-audit

## Goal

Verify the current LIAN <-> NodeBB integration contract before adding school/org audience, groups, or category permission work.

## Product scope

This task does not add user-facing features. It reduces risk by documenting and testing the current NodeBB bridge.

## Allowed files

- `docs/agent/domains/NODEBB_INTEGRATION.md`
- `docs/agent/tasks/nodebb-integration-audit.md`
- `docs/agent/handoffs/nodebb-integration-audit.md`
- Optional read-only script: `scripts/audit-nodebb-integration.js`

## Forbidden files

- `src/server/post-service.js`
- `src/server/feed-service.js`
- `src/server/auth-service.js`
- `src/server/nodebb-client.js`
- `data/post-metadata.json`
- `data/feed-rules.json`
- frontend files

## Data schema changes

None.

## API changes

None.

## Audit checklist

- [x] Confirm `nodebbFetch()` auth behavior: `x-api-token` vs explicit `Authorization: Bearer`.
- [x] Confirm `_uid` behavior from `addUid()` and `withNodebbUid()`.
- [x] Confirm regular publish uses current user's `nodebbUid`.
- [x] Confirm AI publish uses the same publish helper and current user's `nodebbUid`.
- [x] Confirm reply endpoints and fallback behavior.
- [x] Confirm channel topic creation/reply behavior.
- [x] Confirm feed index/detail endpoints.
- [x] Confirm notification endpoint behavior.
- [x] Confirm NodeBB user lookup and creation behavior.
- [x] Document failure modes and whether metadata is written after failures.

## Validation commands

Read-only checks only by default:

```bash
node --check server.js
node --check src/server/nodebb-client.js
node --check src/server/post-service.js
node --check src/server/auth-service.js
node --check src/server/channel-service.js
```

If a smoke script is added:

```bash
node --check scripts/audit-nodebb-integration.js
node scripts/audit-nodebb-integration.js --read-only
```

## Risks

- Write-endpoint smoke tests can create real NodeBB content. They require explicit approval and a test category/user.
- NodeBB API behavior may vary by version or plugin configuration.

## Rollback plan

- Revert docs/script changes.
- No runtime data should be modified by this task.

