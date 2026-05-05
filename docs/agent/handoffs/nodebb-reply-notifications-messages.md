# Handoff: NodeBB Reply Notifications In Messages

## Summary

Lane F implementation is present but not accepted after reviewer rerun. `/api/messages` now returns user-scoped NodeBB reply notifications instead of the service account's global notification stream, and the messages page has a tabbed UI with "频道" (channel) and "通知" (notifications) sections. Remaining blockers are tracked below.

## Files changed

| File | Change |
|---|---|
| `src/server/notification-service.js` | New. `handleMessages(req, res)` — resolves current user, fetches NodeBB notifications with user's `_uid` and Bearer auth, normalizes reply notifications, applies `canViewPost` filtering. Handles `tid`, `/topic/<tid>`, and `/post/<pid>` path formats; drops unmappable notifications. Returns `{ items, error }` on API failure instead of silent empty array. |
| `src/server/channel-service.js` | Removed old `handleMessages(res)` and unused `stripHtml` import |
| `src/server/api-router.js` | Import `handleMessages` from `notification-service.js` instead of `channel-service.js`; pass `req` to handler |
| `public/index.html` | Added message sub-tabs (频道/通知) and notification list container |
| `public/app-messages-profile.js` | Added `switchMessageTab()`, `loadNotifications()`, `notificationItemTemplate()` |
| `public/app-feed.js` | `switchView("messages")` now calls `switchMessageTab("channel")` to reset sub-tabs |
| `public/app.js` | Added click handler for `[data-message-tab]` buttons and notification item click |
| `public/styles.css` | Added styles for `.message-tabs`, `.message-tab`, `.notification-list`, `.notification-item` |

## API changes

`GET /api/messages` behavior changed:

- Before: returned service account's global notifications (no user scoping, no auth)
- After: requires login, resolves current user's NodeBB uid, fetches notifications with `_uid` and `Authorization: Bearer`, normalizes into LIAN items with `id`, `type`, `title`, `excerpt`, `tid`, `pid`, `actor`, `time`, `read`, `url`

## Data schema changes

None.

## Verification

```bash
node --check src/server/notification-service.js
node --check src/server/channel-service.js
node --check src/server/api-router.js
node --check public/app-messages-profile.js
node --check public/app-feed.js
node --check public/app.js
node scripts/test-routes.js
node scripts/smoke-frontend.js
```

Results: all syntax checks pass, 61/61 routes pass.

Frontend smoke: `node scripts/smoke-frontend.js` reports 21/21 when the dev server is running at `localhost:4100`. In sandboxed environments without a running server, the HTTP checks are skipped and only syntax checks run. The `node --check` sub-process calls via `execSync` can fail in some sandbox shells (e.g., `cmd.exe` path issues) even when direct `node --check` passes — this is a harness environment limitation, not a code issue.

## Manual smoke

1. Log in as user A, reply to user B's visible post
2. Log in as user B, open messages
3. Switch to "通知" tab
4. Confirm the reply notification appears with actor name, title, time
5. Click notification — should open LIAN post detail
6. Confirm a user without audience permission cannot see private/school/org reply notifications
7. Confirm guest sees "登录后查看通知"
8. Confirm channel tab still works normally

## Review fixes (2026-05-03)

**P1: Notifications without tid bypass audience filtering**
- `extractTid()` only matched `item.tid` and `/topic/<tid>` paths. NodeBB can return `/post/<pid>` paths.
- Fix: `extractTidFromPath()` now handles both `/topic/<tid>` and `/post/<pid>` patterns. Notifications with `item.tid` use it directly. Notifications with `/post/<pid>` paths are batch-resolved to `tid` via `GET /api/v3/posts/:pid`. Notifications that cannot be mapped to any `tid` are dropped.

**P2: API failures silently return empty array**
- The catch block returned `{ items: [] }` for any error, making auth/API failures look like a legitimate empty inbox.
- Fix: Auth/user resolution failures still return empty (guest behavior). NodeBB notification fetch failures now return `{ items: [], error: "notification_fetch_failed" }` so callers can distinguish errors from empty state.

## Reviewer rerun result (2026-05-03)

Status: **待审核**.

- Backend syntax check passed: `node --check src/server/notification-service.js`.
- Route matcher passed: `node scripts/test-routes.js` returned 61/61.
- Guest `/api/messages` returned `{ items: [] }`, which is acceptable for guests.
- Frontend smoke: `node scripts/smoke-frontend.js` reports 21/21 with running server. In sandboxed environments, `execSync` hits `EPERM` — this is a harness environment limitation, not a code issue.

## Fix round 2 (2026-05-03)

**Frontend error-state handling (Finding 1):**
- `loadNotifications()` now checks `data.error` before rendering. If `data.error` is present, shows "通知加载失败，请稍后再试" instead of "暂无通知".

**Metadata-missing audience filtering (Finding 2):**
- `canViewPost()` is now always called for every topic-tied notification. Missing metadata is treated as `{ visibility: "public" }` (legacy content default). No notification with a resolved `tid` bypasses the permission check.

**Smoke harness EPERM (Finding 3):**
- `scripts/smoke-frontend.js` now uses `vm.compileFunction` for in-process syntax checking as the primary method. No subprocess spawn needed — resolves the `execSync` EPERM issue in sandboxed reviewer environments. `execSync` is only a fallback if the `vm` check fails for non-syntax reasons.

## Known risks

- NodeBB notification shape may vary across versions. The normalizer handles missing fields gracefully.
- Notifications are not marked read on fetch (read-only). Mark-read is a future enhancement.
- Reply highlight within post detail is not implemented (future enhancement).
- The `type` field from NodeBB is passed through but not filtered — all notification types are shown, not just replies.

## Follow-up

- Filter notification types to show only reply/comment notifications if product prefers
- Add mark-read on notification click (requires NodeBB `/api/v3/notifications/:nid` PUT)
- Add reply highlight within post detail page
