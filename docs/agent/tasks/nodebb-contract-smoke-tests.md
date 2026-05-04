# Task: NodeBB Contract Smoke Tests

## Goal

Verify the actual NodeBB endpoint shapes and `_uid` behavior before implementing more reply notifications, bookmark/like profile lists, and discussion surfaces.

## Product scope

This task is diagnostic. It does not add a user-facing feature, but it prevents LIAN from wiring messages/profile interactions against incorrect NodeBB assumptions.

## Allowed files

- `scripts/smoke-nodebb-contracts.js`
- `src/server/nodebb-client.js`, only if a small reusable diagnostic helper is needed
- `docs/agent/domains/NODEBB_INTEGRATION.md`
- `docs/agent/tasks/nodebb-contract-smoke-tests.md`
- `docs/agent/handoffs/nodebb-contract-smoke-tests.md`

## Forbidden files

- `public/*`
- `data/post-metadata.json`
- `src/server/feed-service.js`
- `src/server/post-service.js`, unless the smoke script needs to import an existing helper without behavior changes
- `src/server/channel-service.js`
- `server.js`

Do not change runtime NodeBB integration behavior in this task.

## Data schema changes

None.

The smoke script must not commit generated output by default.

## API changes

None.

## Acceptance criteria

- [ ] Add a smoke script that can run in read-only mode by default.
- [ ] The script prints NodeBB base URL, target uid mode, endpoint status codes, and safe response-shape summaries.
- [ ] The script never prints `NODEBB_TOKEN`, `MIMO_API_KEY`, session tokens, or cookies.
- [ ] Read-only smoke checks current-user topic detail shape for first post pid, upvoted state, bookmarked state, and image fields.
- [ ] Read-only smoke checks current-user `/api/notifications` shape with `_uid` set to the current user.
- [ ] Read-only smoke checks user bookmark list endpoint shape.
- [ ] Read-only smoke checks user upvoted list endpoint shape.
- [ ] Optional write mode is gated by an explicit environment variable such as `NODEBB_SMOKE_WRITE=1`.
- [ ] Optional write mode labels any test topic/reply clearly and documents cleanup.
- [ ] Optional write mode verifies reply, vote/unvote, bookmark/unbookmark, and flag/report endpoint behavior if safe to run.
- [ ] Findings are written into `docs/agent/domains/NODEBB_INTEGRATION.md`.

## Validation commands

```bash
node --check scripts/smoke-nodebb-contracts.js
node scripts/smoke-nodebb-contracts.js
```

Optional write smoke:

```bash
NODEBB_SMOKE_WRITE=1 node scripts/smoke-nodebb-contracts.js
```

On Windows PowerShell:

```powershell
$env:NODEBB_SMOKE_WRITE="1"
node scripts/smoke-nodebb-contracts.js
Remove-Item Env:NODEBB_SMOKE_WRITE
```

## Risks

- Risk: Smoke tests can create junk posts or reports. Mitigation: write mode must be opt-in and clearly label test artifacts.
- Risk: The script may leak secrets in logs. Mitigation: redact all headers, tokens, and auth values.
- Risk: Endpoint shape differs by NodeBB version. Mitigation: record raw shape summaries in the handoff and update integration docs.

## Rollback plan

- Remove or revert the smoke script.
- Delete any opt-in test artifacts from NodeBB manually if write smoke was run.

---

## Review Result Added 2026-05-03

Lane E status: accepted.

Verified:

- `scripts/smoke-nodebb-contracts.js` exists and defaults to read-only mode.
- The script redacts auth headers and does not print the raw token.
- Remote NodeBB smoke passed when network access was allowed.
- Findings are documented in `docs/agent/domains/NODEBB_INTEGRATION.md`.

Validation run:

```bash
node --check scripts/smoke-nodebb-contracts.js
node scripts/smoke-nodebb-contracts.js
```

Observed remote result:

```text
Notifications: 200, auth: Bearer
Topic detail: 200
User bookmarks: 200, auth: Bearer
User upvoted: 200, auth: Bearer
Passed: 4
Failed: 0
```

Follow-up:

- Runtime callers of notifications/bookmarks/upvoted must use `Authorization: Bearer` where NodeBB requires it. This is especially relevant to the future Messages lane.
