# Account Privacy, Data Controls & Session Management

> Information architecture and contract definitions for Profile settings, account lifecycle, and user-facing privacy controls in LIAN mobile web.

## Source Issues

- [#140](https://github.com/nicepkg/lian-mobile-web/issues/140) — account privacy, data controls, session management
- [#149](https://github.com/nicepkg/lian-mobile-web/issues/149) — local client IDs, reader IDs, device-level privacy
- [#139](https://github.com/nicepkg/lian-mobile-web/issues/139) — notifications, unread state, Push, app badge
- [#136](https://github.com/nicepkg/lian-mobile-web/issues/136) — unsaved drafts and form input protection

## Current State

`ProfileView.vue` provides:

- Identity card: display name, email/institution, identity tags, avatar initials
- Alias card: active alias name + summary (category, signal, persona, description) or "real identity" hint
- Actions: edit profile toggle, logout
- Content tabs: history, saved, liked — read-only lists with no management actions
- Guest state: `AuthPanel` for login/registration when no session

`ProfileView.vue` reads `localStorage.getItem("lian.readHistory")` for the history tab. There is no settings section, privacy controls, data export, account deletion, session management, notification preferences, or local data cleanup.

## Profile Settings Information Architecture

```
Profile (我的)
├── Identity Card
│   ├── display name, avatar, institution, identity tags
│   └── active alias summary (or "real identity" hint)
├── [Edit Profile]  → ProfileEditorPanel (existing)
├── Content Tabs
│   ├── history (浏览记录)
│   ├── saved (收藏)
│   └── liked (赞过)
└── Settings (设置)              ← NEW section
    ├── Account (账号)
    │   ├── account deletion / deactivation
    │   └── data export
    ├── Privacy (隐私)
    │   ├── alias visibility & default posting identity
    │   ├── browsing history control
    │   └── local data cleanup
    ├── Notifications (通知)
    │   ├── notification categories toggle
    │   ├── browser permission status
    │   └── do-not-disturb
    ├── Security (安全)
    │   ├── active sessions / devices
    │   └── revoke other sessions
    └── About (关于)
        └── privacy policy link, version
```

## Account Deletion

### Contract

| Field | Value |
|-------|-------|
| MVP support | Deferred — define contract now, implement after backend confirms capability |
| API | `DELETE /api/account` or `POST /api/account/delete` (TBD with backend) |
| Helper | `requestAccountDeletion(): Promise<void>` in `src/api/profile.ts` |

### Requirements

- Entry point: Settings > Account > Delete Account (注销账号)
- Double confirmation dialog explaining impact scope:
  - posts, replies, images, aliases, saved items, liked items, notifications, drafts
  - data that cannot be immediately deleted and its retention policy
- On success:
  - clear `lian.readHistory`, `lian.clientId`, drafts, push subscription
  - clear auth state (cookie/session)
  - enter guest state (`enterGuestState()`)
- Provide contact/support path for data that cannot be self-served

### Deferred Items

- Backend must define: which data is hard-deleted vs anonymized, retention period, reactivation window
- Legal/compliance review for campus data handling

## Data Export

### Contract

| Field | Value |
|-------|-------|
| MVP support | Deferred — document non-support, define scope for future |
| API | `POST /api/account/export` (TBD) |
| Helper | `requestDataExport(): Promise<{ requestId: string }>` |

### Export Scope (when implemented)

- profile (display name, institution, identity tags, aliases)
- posts and replies authored
- uploaded images (URLs or archive)
- saved items, liked items
- notification history
- settings and preferences

### Requirements

- Entry point: Settings > Account > Export My Data (导出我的数据)
- Request requires authentication; download link has expiry and rate-limit
- UI states: pending, ready (download link), failed, expired
- Export file format: JSON or ZIP with JSON + media references

## Clear Browsing History

### Contract

| Field | Value |
|-------|-------|
| MVP support | Yes — local-only clear is low-risk |
| Storage key | `lian.readHistory` (localStorage) |
| API | `DELETE /api/me/history` if server-side history exists |

### Requirements

- Entry point: History tab header action "清空浏览记录" + Settings > Privacy > Browsing History
- Confirmation: "清空后无法恢复，浏览记录将从本设备删除"
- On confirm:
  - `localStorage.removeItem("lian.readHistory")`
  - refresh history tab to empty state
  - notify other tabs via `BroadcastChannel` or `storage` event (#120)
- Explanatory text: "浏览记录仅保存在本设备，用于展示浏览历史和辅助内容推荐"
- Single-item removal in history tab (P2): swipe-to-delete or long-press menu

### Related: `readHistory` Privacy

- `readHistory` IDs are sent to `/api/feed` as `read` query parameter for recommendation/dedup
- User should be informed that browsing history influences feed ordering
- Future: opt-out toggle for personalized dedup ("关闭个性化已读去重")

## Session & Device Management

### Contract

| Field | Value |
|-------|-------|
| MVP support | Deferred — define contract, implement before Push/PWA |
| APIs | `GET /api/sessions`, `DELETE /api/sessions/:id`, `DELETE /api/sessions/other` |
| Helpers | `fetchSessions()`, `revokeSession(id)`, `revokeOtherSessions()` |

### Requirements

- Entry point: Settings > Security > Active Sessions (登录设备)
- Display per session: device/browser, platform, last active time, is current device, is PWA
- Actions:
  - revoke a single session (with confirmation)
  - revoke all other sessions (with confirmation: "将退出其他所有设备上的登录状态")
- `logoutAuth()` must also clear local state: `lian.readHistory`, drafts, push subscription, auth-sensitive form state

### `lian.clientId` Lifecycle

- `lian.clientId` is a persistent device identifier in localStorage, generated by `ensureClientId()` in `src/api/messages.ts`
- Used as `x-client-id` header and `readerId` body field for channel messages
- Current state: no TTL, no rotation, no logout cleanup, no privacy disclosure
- Contract:
  - register in storage key registry (#106) with purpose, scope, TTL
  - `logout` / account deletion: rotate or remove clientId (product + backend decision)
  - Settings > Privacy > Local Data: "重置设备标识" option
  - never include in telemetry payloads directly

## Notification Preferences

### Contract

| Field | Value |
|-------|-------|
| MVP support | Deferred — contract definition only |
| API | `GET/PUT /api/notification-preferences` |
| Helper | `fetchNotificationPreferences()`, `updateNotificationPreferences()` |

### Categories

| Category | Description | Default |
|----------|-------------|---------|
| reply | 回复我的帖子或评论 | on |
| system | 系统通知、公告 | on |
| channel | 频道消息 | on |
| mention | @提及 | on |
| promotion | 活动、推荐 | off |

### Requirements

- Entry point: Settings > Notifications
- Toggle per category
- Global mute / Do Not Disturb (免打扰) with time range
- Browser notification permission status display (granted / denied / default)
- Permission request only from this settings page, never auto-prompt on first visit
- Permission denied state: explain how to re-enable in browser settings
- Browser permission != product preference: user can allow browser notifications but disable specific categories server-side

### Browser Notification Strategy

- Support Web Push only after PWA Service Worker is stable (#109)
- Push payload: use generic text ("你有一条新回复"), never include post body, DM content, image URLs, or precise location
- `notificationclick` uses canonical route builder to open target post/message
- `logout` / session expired: unregister or pause push subscription
- App Badge API (`navigator.setAppBadge`): only when user has notifications enabled and PWA is installed; graceful fallback on unsupported browsers

## Alias Visibility & Default Identity

### Current Behavior

- Profile shows active alias or "real identity"
- `activeAliasHint`: "这个马甲会作为你在 LIAN 中出现的默认身份"
- API supports activate/deactivate alias via `src/api/profile.ts`

### Contract

- Alias visibility scope: define which pages show real identity vs active alias vs identityTag
  - profile page: always shows current identity (alias or real)
  - post/reply author: uses active alias at time of publishing
  - channel messages: uses active alias
  - settings/admin: real identity (if applicable)
- Default posting identity: active alias at time of compose; no per-post identity picker in MVP
- Switching alias: show confirmation explaining "切换后新发布的帖子和回复将使用此身份"
- Alias history: do not expose which aliases a user has held in the past to other users
- Related: #129 anonymous/alias privacy, #138 AI draft privacy

### Settings Entry

- Settings > Privacy > Default Identity (默认发布身份)
- Display: current active identity name + hint
- Action: navigate to alias management (when alias management UI exists)

## Local Data Cleanup

### Settings > Privacy > Clear Local Data (清理本地数据)

One-tap cleanup for shared-device / privacy-conscious users:

| Data | Key / Source | Clearable | Notes |
|------|-------------|-----------|-------|
| Browsing history | `lian.readHistory` | Yes | Also clears profile history tab |
| Device ID | `lian.clientId` | Yes (reset) | Rotates to new UUID on next use |
| Drafts | component-local / future storage | Yes | When draft persistence is implemented |
| Notification badge | app state | Yes | Clear unread count |
| Push subscription | Service Worker | Yes (unregister) | Only if Push is enabled |
| Auth session | cookie | Yes (logout) | Handled by existing `logoutAuth()` |
| Liked/saved cache | optimistic cache | Yes | When local cache is implemented |

### Requirements

- Confirmation dialog: "将清除本设备上的浏览记录、设备标识和本地缓存。不会影响你的账号、发布内容和服务端数据。"
- After clear: refresh UI, re-enter guest state if auth was included
- Option to clear without logging out (keep session, clear only local behavioral data)

## Logout & Account Deletion Local State

### Logout Cleanup Checklist

When `logoutAuth()` succeeds (or session is already invalid):

- [ ] `user` ref → `null`
- [ ] `profileItems` → `[]`
- [ ] `editorOpen` → `false`
- [ ] `errorMessage` / `listError` → `""`
- [ ] `lian.readHistory` — decision: clear or preserve (preserve = user sees history after re-login on same device)
- [ ] `lian.clientId` — decision: preserve (device identity) or rotate
- [ ] drafts — clear
- [ ] push subscription — unregister
- [ ] notification badge — clear
- [ ] auth-sensitive form state — clear (per #127)

Current `enterGuestState()` only resets Vue refs. The additional cleanup items above need to be added.

### Account Deletion Cleanup Checklist

All logout items plus:

- [ ] `lian.clientId` — remove (device identity no longer valid)
- [ ] `lian.readHistory` — remove
- [ ] all local storage keys under `lian.*` — remove
- [ ] Service Worker caches — clear
- [ ] IndexedDB (if used) — clear

## Profile List Management (P2)

Current profile tabs (history, saved, liked) are read-only with no item removal.

### Planned Additions

- History tab: remove single item (swipe/long-press), clear all (header action)
- Saved tab: unsave item (tap to toggle)
- Liked tab: unlike item (tap to toggle)
- All destructive actions: confirmation or short undo window
- State sync: list removal must update feed/detail interaction state (#115, #137)

## MVP Support Summary

| Feature | MVP | Notes |
|---------|-----|-------|
| Settings section in Profile | Yes | IA skeleton, entry points |
| Clear browsing history | Yes | Local `readHistory` only |
| Local data cleanup | Partial | History + clientId reset; drafts/Push when available |
| Account deletion | No | Contract defined, backend TBD |
| Data export | No | Scope defined, backend TBD |
| Session/device management | No | Contract defined, backend TBD |
| Notification preferences | No | Categories defined, needs Push first |
| Alias visibility settings | Partial | Hint text improved; full settings TBD |
| Profile list item removal | No | P2, needs API support |
| Logout local state cleanup | Yes | Extend `enterGuestState()` |

## Testing

- Logout clears Vue state and enters guest UI
- History clear removes `lian.readHistory` and refreshes tab
- `clientId` reset generates new UUID on next `ensureClientId()` call
- Alias switch shows correct identity hint in Profile
- Guest state renders `AuthPanel`, not identity card
- `enterGuestState()` called on 401/403 from any profile API
- Destructive actions (clear history, delete account) require confirmation
- No sensitive data (password, invite code, auth error) in localStorage drafts

## Cross-Reference

- #106 — browser storage key registry (register all `lian.*` keys)
- #120 — app lifecycle / cross-tab sync (storage event for history clear)
- #127 — auth/session (logout cleanup, sensitive form state)
- #129 — anonymous/alias privacy (alias visibility scope)
- #133 — testing strategy (E2E coverage for privacy flows)
- #136 — draft lifecycle (draft persistence and cleanup)
- #139 — notifications / Push / badge (notification preferences, permission)
- #149 — client ID / reader ID privacy (clientId lifecycle, reset)
