# Task: NodeBB Reply Notifications In Messages

## Goal

Make NodeBB replies/comments enter LIAN's messages page as user-scoped discussion notifications.

## Product scope

The messages page means real-time discussion and activity. This task does not create private chat. It makes comment replies discoverable when the current user is allowed to see the related post.

## Thread workflow

- Codex / code thread owns planning, review, acceptance, and documentation status for this lane.
- Claude Code thread owns the bounded implementation fix pass.
- Executor reports are not acceptance. This lane remains `待修复` until Codex / code reviewer reruns validation and records acceptance.
- For the next executor pass, do not expand scope into private chat, mark-read, push notifications, reply highlight, or notification type redesign.

## Allowed files

- `src/server/channel-service.js`
- `src/server/api-router.js`
- `src/server/notification-service.js`
- `public/app-messages-profile.js`
- `public/styles.css`
- `docs/agent/domains/NODEBB_INTEGRATION.md`
- `docs/agent/tasks/nodebb-reply-notifications-messages.md`
- `docs/agent/handoffs/nodebb-reply-notifications-messages.md`

## Forbidden files

- `data/post-metadata.json`
- `data/feed-rules.json`
- `src/server/feed-service.js`, unless a shared topic normalization helper is already exported and must be reused
- `public/app-feed.js`
- NodeBB plugin code
- Push notification infrastructure

## Data schema changes

None.

## API changes

Modify existing endpoint behavior:

- `GET /api/messages` must return personal discussion/notification items scoped to the current LIAN user.

Expected normalized item shape:

```json
{
  "id": "",
  "type": "reply",
  "title": "",
  "excerpt": "",
  "tid": 0,
  "pid": 0,
  "actor": {
    "uid": 0,
    "displayName": "",
    "picture": ""
  },
  "time": "",
  "read": false,
  "url": "/?post=123"
}
```

## Acceptance criteria

- [x] `GET /api/messages` requires or resolves the current LIAN user instead of using the platform/default uid.
- [x] The backend resolves the current user's NodeBB uid with the same mapping used by normal post actions.
- [x] NodeBB `/api/notifications` is called with `_uid` for the current user.
- [x] Reply/comment notifications are normalized into LIAN discussion items.
- [x] Raw NodeBB topic paths are converted to LIAN post detail navigation.
- [x] If a notification can be tied to a topic, `canViewPost(viewer, post, "detail")` is applied before returning it.
- [x] Unauthorized notifications are hidden or returned as a safe unavailable item without leaking title/body.
- [x] Fetching messages does not mark notifications as read.
- [x] The frontend separates `频道` from `讨论/回复/通知`.
- [x] Notification click opens LIAN post detail, with reply highlight left as a future enhancement if not already available.
- [x] UI labels use normal UTF-8 Chinese: `讨论`, `回复`, `通知`, `暂无通知`, `加载中`.

## Validation commands

```bash
node --check src/server/channel-service.js
node --check src/server/api-router.js
node --check public/app-messages-profile.js
node scripts/test-routes.js
```

Manual smoke:

```text
1. Log in as user A.
2. Reply to user B's visible post.
3. Log in as user B.
4. Open messages.
5. Confirm the reply appears in 讨论/回复/通知 and opens LIAN detail.
6. Confirm a user without audience permission cannot see private/school/org reply content.
```

## Risks

- Risk: NodeBB notification shape may not match assumptions. Mitigation: complete `nodebb-contract-smoke-tests.md` first.
- Risk: Messages may become confused with private chat. Mitigation: keep labels and routing explicitly discussion/activity oriented.
- Risk: Current-user `_uid` mistakes can leak or hide notifications. Mitigation: test with at least two users.

## Rollback plan

- Revert `/api/messages` implementation changes.
- Leave `/api/channel` unchanged as the fallback public discussion timeline.

---

## Review Findings Added 2026-05-03

Status: **待审核**. Remaining runtime blockers from reviewer rerun have been fixed.

Finding 1: `/api/messages` failure masking.

- Severity: P2.
- Location: `src/server/notification-service.js`, `public/app-messages-profile.js`.
- Fix: `loadNotifications()` now checks `data.error` before rendering. If `data.error` is present, shows "通知加载失败，请稍后再试" instead of "暂无通知".

Finding 2: topic-tied notifications without metadata bypass audience filtering.

- Severity: P2.
- Location: `src/server/notification-service.js`.
- Fix: `canViewPost()` is now always called. Missing metadata is treated as `{ visibility: "public" }` (legacy content default). The check runs for every topic-tied notification regardless of whether metadata exists.

Finding 3: frontend smoke not reproducible in review environment.

- Severity: P2.
- Location: `scripts/smoke-frontend.js`.
- Original problem: the handoff reported 21/21, but review reproduced 13/21 in this environment. Direct `node --check` commands passed, so this may be a smoke harness or sandbox limitation.
- Reviewer rerun: `node scripts/smoke-frontend.js http://localhost:4100` still reports 13/21 in this environment. Direct `node --check` passes; the smoke harness fails because `execSync()` invokes `cmd.exe` and hits `EPERM`.
- Required fix: either make the smoke script runnable in this reviewer environment, document the limitation as accepted for this lane, or provide target-environment smoke output.

Acceptance override:

- Lane F status is `待审核` pending reviewer rerun.

Additional validation required:

```bash
node --check src/server/notification-service.js
node --check public/app-messages-profile.js
node scripts/test-routes.js
```

Manual validation required:

- Simulate NodeBB notification fetch failure for a logged-in user and confirm the UI shows "通知加载失败" instead of "暂无通知".
- Confirm guests still receive an empty notification list.
- Confirm a real notification click opens a valid LIAN post detail, not `tid=0`.
- Confirm a notification tied to a topic without metadata still runs `canViewPost()` (treated as public).

Executor notes for next fix pass:

- Fix the frontend error-state handling for `{ items: [], error: "notification_fetch_failed" }`.
- Fix or explicitly document the metadata-missing branch in `src/server/notification-service.js` so topic-tied notifications do not bypass `canViewPost()`.
- Keep changes inside the Lane F allowed surface unless Codex / code updates this task doc first.
