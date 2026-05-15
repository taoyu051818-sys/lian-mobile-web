# Profile Privacy Explanation Brief - 2026-05-15

Issue: #452
Status: implementation-ready content/design brief
Scope: `lian-mobile-web` Profile/privacy wording only

## Why this exists

Issue #452 turns the remaining Profile/privacy wording gap into one bounded brief. This file defines what the frontend may say today about:

- device-level client identity
- local read history
- logout
- future clear-local-data/reset wording

This brief does not define account deletion, data export, other-device session management, or new discovery / map sequencing.

## Current code truth

### Device identity

Current main-branch code shows that `src/platform/clientIdentity.ts`:

- stores `lian.clientId` in browser `localStorage` when storage is available
- falls back to an in-memory value when storage access is unavailable
- does not expose a user-facing reset control today

Current main-branch code also shows that `src/api/messages.ts` still uses the current client id in channel-message self/read behavior. That means copy may describe it as a browser-level local identifier used for current-device messaging/read-state behavior, but not as a real-name identity or a cross-device account concept.

### Local read history

Current main-branch code shows that `src/platform/browser-storage.ts` stores `lian.readHistory` as local browser history entries, and `src/views/ProfileView.vue` uses those local ids to build the Profile `浏览` list.

That means copy may describe the history list as depending on local browser records on the current device. Copy must not promise that the list is server-only, cross-device, or automatically deleted on logout.

### Logout

Current main-branch code shows that `src/views/ProfileView.vue` calls `logoutAuth()` and then enters guest state. The current logout flow does not clear `lian.clientId` or `lian.readHistory` in the frontend code reviewed for this brief.

That means logout copy may promise sign-out of the current session, but must not promise local-data deletion unless that behavior is implemented later.

### Privacy wording baseline from merged work

Merged PR `#437` established the current privacy-copy tone: the frontend may describe local checks or visible behavior, but must defer unverified backend guarantees to confirmed contracts. This same caution should apply here.

## Copy guardrails

### Do say

- `当前浏览器` or `本设备` when the behavior is browser-local
- `本地记录` when referring to read history
- `退出登录会结束当前登录状态`
- `清理本地数据` is separate from logout
- backend deletion/export/cross-device guarantees are outside this slice unless separately verified

### Do not say

- that `lian.clientId` is a real-world identity
- that the device id follows a user across every device
- that logout clears all local data
- that clear-local-data deletes server-side posts, replies, images, saves, likes, or notifications
- that account deletion, data export, or other-device session revocation already exists unless those flows are implemented and verified

## Recommended user-facing copy

### 1. Device identity row or helper text

Primary copy:

`LIAN 会在当前浏览器保存一个本地设备标识，用来帮助频道消息和已读状态保持一致。`

Secondary copy:

`它不等于你的真实身份，也不代表跨设备同步。更换浏览器、清理本地数据，或在受限模式下使用时，这个标识可能变化。`

### 2. Local read history helper

Primary copy:

`“浏览”列表依赖这台设备当前浏览器保存的本地记录。`

Secondary copy:

`如果多人共用同一浏览器，之后的使用者可能看到这些记录，直到本地数据被清理。`

### 3. Logout helper or confirmation copy

Primary copy:

`退出登录会结束当前登录状态。`

Secondary copy:

`当前版本不应把“退出登录”解释成删除账号、清空浏览记录，或移除这台设备上的全部本地数据。`

### 4. Future clear-local-data row

Available-state copy:

`清理本地数据只影响当前浏览器里的本地记录，例如本地设备标识和浏览记录。`

Caution copy:

`它不应承诺删除服务器上的帖子、回复、图片、收藏、通知，或其他设备上的数据。`

Unavailable-state copy:

`当前版本暂未在这里提供清理本地数据入口；如果你在共享设备上使用 LIAN，请在退出登录后同时清理浏览器本地数据。`

## Placement guidance

Use this brief on Profile/privacy surfaces only:

- Profile settings > `隐私与数据`
- History tab helper text
- logout confirmation / helper copy
- a future `清理本地数据` row, even if it ships first as disabled / coming-soon copy

Do not reuse this brief to explain:

- alias visibility or default publish identity rules
- account deletion or data export policy
- recommendation ranking or discovery privacy
- map / place / location precision policy

Those belong to separate follow-up slices.

## Review checklist

Before shipping UI copy from this brief, confirm that the surface:

- mentions `当前浏览器` or `本设备` at least once when the data is local
- never equates the local device id with a real identity
- keeps shared-device sensitivity explicit for read history
- keeps logout and clear-local-data as separate actions
- avoids unverified claims about deletion, export, retention, or cross-device behavior
- stays consistent with the cautious privacy wording already merged in PR `#437`

## Follow-up work outside this slice

This brief intentionally leaves these items open for later implementation or product decisions:

- real `清理本地数据` controls
- account deletion / export
- other-device session management
- alias visibility and default-identity explanation
- cross-tab sync for local-data clearing
- any broader settings IA work that goes beyond the wording needed for issue #452
