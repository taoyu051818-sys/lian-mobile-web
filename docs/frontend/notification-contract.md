# Notification Contract

Frontend contract for in-app notifications, read state, unread count, browser notification permission, Push payload privacy, and notificationclick deep link dependencies.

This document does **not** cover Service Worker registration, Push subscription lifecycle, or background sync — those belong to the PWA RFC (#109).

Related issues: #139, #137, #120, #127, #109.

---

## 1. notificationId vs targetPostId

### Problem

`NotificationItem` currently exposes `id` and `tid` with no stable contract:

- `id` is optional and may be a notification event ID or a server-generated key.
- `tid` is the target post/topic ID — semantically a **destination**, not an **event identifier**.
- The Vue key falls back to `String(item.id || item.tid || item.title)`, meaning two notifications pointing at the same post collide when `id` is missing.

### Contract

| Field | Type | Required | Description |
|---|---|---|---|
| `notificationId` | `string` | Yes | Stable, unique identifier for this notification event. Used for mark-read, Vue key, deduplication. Never derived from `tid`. |
| `targetPostId` | `string` | No | The post/topic this notification refers to. Used for deep link navigation. May be absent for system notifications without a target. |
| `type` | `string` | Yes | Notification category: `reply`, `mention`, `system`, `channel`, etc. |

Rules:

- `notificationId` is **always** present after response normalization. Notifications missing a stable ID are filtered or routed to diagnostics — never rendered in the list.
- `notificationId` and `targetPostId` occupy separate namespaces. A notification ID of `"123"` and a post ID of `"123"` are unrelated.
- Vue `:key` uses `notificationId` exclusively. No fallback to `tid` or `title`.
- Response adapters normalize raw API fields: `id` (when present and stable) becomes `notificationId`; `tid` becomes `targetPostId`. See §4.

### Current gap

`src/types/messages.ts` `NotificationItem.id` is `string | number | undefined`. The adapter must coerce to `string` and reject items where a stable ID cannot be determined.

---

## 2. Read state, mark-read, all-read, and unread count

### Current state

- `NotificationItem.read?: boolean` is display-only.
- `src/api/messages.ts` exposes `fetchNotifications()` — no mark-read helper.
- `MessagesView.vue` does not call any mark-read API on tab switch or item view.
- No unread count endpoint or tab badge.

### Contract

#### API helpers (to be added to `src/api/messages.ts`)

```ts
markNotificationRead(notificationId: string): Promise<void>
markNotificationsRead(notificationIds: string[]): Promise<void>
markAllNotificationsRead(): Promise<void>
fetchUnreadCount(): Promise<number>
```

#### Read-state rules

| Trigger | Behavior |
|---|---|
| User opens notification tab | Visible notifications are **not** auto-marked read. User intent is ambiguous — browsing does not equal acknowledging. |
| User taps a specific notification | Call `markNotificationRead(notificationId)`. Optimistically set `read = true` in local state; reconcile on error. |
| User taps "mark all read" | Call `markAllNotificationsRead()`. Optimistically set all `read = true` and `unreadCount = 0`. |
| Notification deep link navigates to post | Mark the originating notification read (requires passing `notificationId` through the route). |

#### Unread count

- `fetchUnreadCount()` returns the server-authoritative count.
- The Messages bottom tab displays a badge when `unreadCount > 0`.
- Badge refreshes on: tab focus, app resume (`visibilitychange` to `visible`), network reconnect, and after any mark-read operation.
- Do not maintain a local-only count that diverges from the server. Optimistic updates are acceptable; permanent local-only counts are not.

#### Cross-tab sync

When a notification is marked read in one tab, other tabs should pick up the change via the `storage` event listener (#120) or a shared broadcast channel. The unread badge must not show stale counts across tabs.

---

## 3. Browser notification permission timing

### Contract

The browser `Notification.requestPermission()` prompt is **never** shown automatically on page load, first visit, or first login.

#### Permitted trigger points

| Trigger | Allowed | Notes |
|---|---|---|
| User navigates to notification settings (future) | Yes | Primary entry point. User is explicitly managing notification preferences. |
| User taps "enable notifications" in a contextual prompt | Yes | Prompt must explain what will be notified (replies, system, channel). |
| App cold start / first login | **No** | Premature prompts cause permission denial and cannot be re-requested in most browsers. |
| After user receives their first notification | **No** | User has not expressed intent to receive browser notifications. |
| Tab focus after user explicitly enabled in settings | Yes | Re-prompt only if current state is `default` (not yet asked). |

#### Permission state handling

| State | UI behavior |
|---|---|
| `granted` | Show toggle to enable/disable browser notifications in settings. Respect product-level preferences (§6). |
| `denied` | Show explanation that browser notifications are blocked. Link to browser settings. Do not re-prompt. |
| `default` | Show "enable notifications" button in settings. Do not auto-request. |

#### Scope

This contract applies to the browser Notification API (`new Notification(...)`). It does **not** govern the in-app notification list or unread badge — those always work regardless of browser permission.

---

## 4. Response adapter and normalization

All notification data from `/api/messages` passes through a response adapter before reaching components.

### Adapter responsibilities

```ts
interface NormalizedNotification {
  notificationId: string;      // from raw `id`, required
  targetPostId?: string;       // from raw `tid`, optional
  type: string;                // from raw `type`, required
  title: string;               // from raw `title`, fallback "新通知"
  excerpt: string;             // from raw `excerpt`, fallback ""
  read: boolean;               // from raw `read`, default false
  actor?: NotificationActor;   // from raw `actor`
  timestampISO?: string;       // from raw `timestampISO` or `time`
}
```

Rules:

- `notificationId`: coerced from `id` via `String()`. If `id` is `undefined`, `null`, or empty string after coercion, the item is **dropped** and logged to diagnostics.
- `targetPostId`: coerced from `tid` via `String()`. Absent values produce `undefined` — not a fallback.
- `read`: coerced via `Boolean()`. Truthy values (`1`, `true`, `"yes"`) become `true`; everything else is `false`.
- `type`: coerced via `String()`. Empty or missing defaults to `"unknown"` for diagnostics grouping.
- `timestampISO`: prefers `timestampISO`, falls back to `time`. Invalid date strings produce `undefined`.

### Current gap

`fetchNotifications()` in `src/api/messages.ts` returns raw `NotificationResponse` with no normalization. The adapter should be added as a pure function and applied inside `fetchNotifications()` or in the component's load handler.

---

## 5. Push payload privacy

When Push notifications are implemented (#109), the payload must respect privacy boundaries.

### Allowed fields in Push payload

| Field | Required | Description |
|---|---|---|
| `notificationId` | Yes | For notificationclick routing and deduplication. |
| `type` | Yes | Category: `reply`, `mention`, `system`, `channel`. |
| `targetPostId` | No | For deep link. Omit for notifications without a target. |
| `title` | Yes | Generic title, e.g. "新回复", "系统通知". Must not contain user-generated content. |
| `body` | Yes | Generic body, e.g. "有人回复了你的帖子". Must not contain post excerpts, message text, usernames, or precise location. |

### Prohibited fields in Push payload

- Post content, excerpts, or titles
- Channel message text or sender usernames
- User profile data (avatar URL, display name, bio)
- Precise location coordinates
- Image URLs
- Auth tokens, session identifiers
- Any PII or user-generated content

### Rationale

Push payloads pass through platform infrastructure (FCM, APNs, browser push service) and may be logged, cached, or displayed on lock screens. Content that would be inappropriate on a lock screen must not be in the payload. The app fetches full details from the API after the user taps the notification.

---

## 6. notificationclick deep link dependencies

When a user taps a Push or browser notification, the click handler must navigate to the correct view.

### Dependencies

| Dependency | Status | Required before notificationclick |
|---|---|---|
| Canonical route builder | Needs implementation | `buildNotificationTargetUrl(notification)` must produce a stable route. |
| Entity ID normalization (#137) | Needs implementation | `targetPostId` must be a normalized string to avoid `Number()` vs `String()` mismatches in route params. |
| Router deep link contract (#110) | Needs implementation | `/posts/:id` and `/messages` routes must accept string params and resolve correctly. |
| Auth session check (#127) | Needs implementation | If the user is logged out when they tap a notification, the app must preserve the deep link target and redirect to auth, then resume navigation. |

### notificationclick flow

```
1. User taps notification
2. Service Worker notificationclick handler fires
3. Read notificationId + targetPostId + type from event.notification.data
4. Focus existing client window if open, or open a new one
5. Post message to client: { type: "notificationclick", notificationId, targetPostId }
6. Client router navigates to canonical URL for the target
7. Client marks notification as read (§2)
```

### Canonical URL mapping

| `type` | Route | Notes |
|---|---|---|
| `reply` | `/posts/:targetPostId` | Scroll to reply if reply ID available |
| `mention` | `/posts/:targetPostId` | |
| `system` | `/messages?tab=notifications` | System notifications may not have a target post |
| `channel` | `/messages?tab=channel` | |

If `targetPostId` is absent, fall back to `/messages?tab=notifications`.

---

## 7. Non-goals (for this contract)

These items are out of scope for this document and tracked elsewhere:

| Item | Tracking issue |
|---|---|
| Service Worker registration and push subscription lifecycle | #109 |
| App Badge API (`navigator.setAppBadge` / `clearAppBadge`) | #139 |
| Notification preferences / mute / Do Not Disturb | #139 |
| Multi-tab unread sync implementation | #120 |
| App lifecycle resume refresh implementation | #120 |
| Auth session expired recovery | #127 |
| Testing fixtures for notification ID edge cases | #133 |

---

## 8. Current code inventory

| File | Relevant state |
|---|---|
| `src/views/MessagesView.vue` | Two tabs (channel, notifications). Notification list renders `NotificationItem` with key fallback `String(item.id \|\| item.tid \|\| item.title)`. No mark-read calls. No unread badge. |
| `src/api/messages.ts` | `fetchNotifications()` returns raw `NotificationResponse`. No mark-read, mark-all-read, or unread-count helpers. |
| `src/types/messages.ts` | `NotificationItem` has `id?: string \| number`, `tid?: string \| number`, `read?: boolean`, `type?: string`. No `notificationId` or `targetPostId` fields. |

---

## 9. Acceptance criteria

- [ ] `NotificationItem` type defines `notificationId: string` (required) and `targetPostId?: string` separately from event ID.
- [ ] Response adapter normalizes raw API notifications, dropping items with missing/invalid ID.
- [ ] `markNotificationRead`, `markNotificationsRead`, `markAllNotificationsRead`, `fetchUnreadCount` API helpers exist.
- [ ] Messages tab shows unread badge sourced from server-authoritative count.
- [ ] Tapping a notification in the list calls `markNotificationRead` with optimistic UI update.
- [ ] "Mark all read" action exists with optimistic update and server reconciliation.
- [ ] Browser Notification permission is only requested from explicit user action (settings or contextual prompt), never on load.
- [ ] Permission states (`granted`, `denied`, `default`) have distinct UI treatment.
- [ ] Push payload contract documents allowed and prohibited fields.
- [ ] notificationclick handler uses canonical route builder and depends on normalized entity IDs.
- [ ] Auth-redirect preserves deep link target when user taps notification while logged out.
