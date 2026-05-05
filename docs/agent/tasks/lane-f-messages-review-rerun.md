# Task: Lane F Messages Review Rerun

## Goal

Re-run reviewer validation for Lane F Messages/Notifications after the frontend smoke harness is fixed, without adding new message features.

## Product scope

This task decides whether the existing Messages discussion work can move from pending review to accepted. It does not implement private chat, push notifications, mark-read behavior, or notification type redesign.

## Allowed files

- `docs/agent/tasks/lane-f-messages-review-rerun.md`
- `docs/agent/handoffs/nodebb-reply-notifications-messages.md`
- `docs/agent/05_TASK_BOARD.md`

Runtime files may only be changed if the reviewer finds a concrete bug and opens a separate fix task.

## Forbidden files

- `src/server/*` for this rerun task
- `public/*` for this rerun task
- `data/*`
- `server.js`

## Data schema changes

None.

## API changes

None.

## Acceptance criteria

- [ ] `node scripts/test-routes.js` passes.
- [ ] `node scripts/smoke-frontend.js http://localhost:4100` is reproducible in the reviewer environment, or the reviewer records an explicit environment waiver.
- [ ] `node scripts/test-audience-hydration.js` passes.
- [ ] Guest `/api/messages` returns a safe empty response.
- [ ] Logged-in `/api/messages` is scoped to the current LIAN/NodeBB user or returns an explicit safe error.
- [ ] NodeBB/API failures are surfaced as safe error states and not silently treated as a true empty inbox.
- [ ] Notifications tied to metadata-missing topics still run through `canViewPost()` using the documented legacy-public branch.
- [ ] Frontend Messages page distinguishes channel timeline from discussion/reply notifications.

## Validation commands

```bash
node scripts/test-routes.js
node scripts/smoke-frontend.js http://localhost:4100
node scripts/test-audience-hydration.js
```

Optional manual/API checks:

```text
GET /api/messages as guest
GET /api/messages as logged-in user
Force or simulate NodeBB notification API failure and confirm safe error UI/JSON
```

## Risks

- Risk: Reviewer may accept a feature based only on implementation handoff. Mitigation: acceptance must be based on rerun evidence in this task.
- Risk: Smoke harness can fail for environment reasons. Mitigation: reviewer may write a scoped waiver only after direct syntax checks and browser/manual validation pass.
- Risk: Messages may drift into private chat scope. Mitigation: this task is review-only and forbids new message features.

## Rollback plan

- If validation fails, keep Lane F in pending review and open a separate narrow fix task with concrete findings.
