# Audience Auth Hydration

Date: 2026-05-02

## Thread Scope

Added `hydrateAudienceUser()` to normalize raw auth-store users into canonical viewer context for all audience permission checks.

## Problem

Auth store users have `institution` (e.g. "中国传媒大学海南国际学院") and `tags` (e.g. ["中国传媒大学", "高校认证"]) but NOT `schoolId`, `orgIds`, or `roleIds`. Permission functions (`canViewPost`, `canModeratePost`, etc.) expected these fields, so raw auth-store users could fail school-scoped visibility checks.

## Solution

### `src/server/audience-service.js`

- Added `hydrateAudienceUser(user, options)` — normalizes any user (or null) into `{ id, schoolId, orgIds, roleIds, isGuest, isAdmin }`.
  - `schoolId` derived from `institution` via existing `deriveSchoolId()`.
  - `orgIds` defaults to `[]` when absent.
  - `roleIds` defaults to `[]` when absent; preserves existing values.
  - `options.isAdmin` injects `"admin"` into `roleIds` when ADMIN_TOKEN matched.
  - `null` → guest: `{ isGuest: true, ...empty }`.
- Updated `canViewPost()`, `canModeratePost()`, `canCreatePostWithAudience()`, `canSeeAudienceOption()` to auto-hydrate internally via `hydrateAudienceUser()`.
- No call-site changes needed — existing code passing raw `auth.user` now works correctly.
- `canReplyToPost()` delegates to `canViewPost()` which auto-hydrates.

### `scripts/test-audience-hydration.js` (new)

61 unit tests covering:
- `hydrateAudienceUser`: null/guest, institution→schoolId derivation, external users, orgIds preservation, roleIds preservation, isAdmin option
- `canViewPost` auto-hydration: public, campus, school (match/mismatch), private+org, linkOnly feed/map/detail
- `canModeratePost` auto-hydration: guest, normal user, moderator, admin, author
- `canReplyToPost` auto-hydration: guest denied, school match/mismatch
- `canCreatePostWithAudience` auto-hydration
- `canSeeAudienceOption` auto-hydration
- `deriveSchoolId`: known institutions, empty, null, unknown

## Files Changed

| File | Change |
|---|---|
| `src/server/audience-service.js` | Added `hydrateAudienceUser`, updated 4 permission functions to auto-hydrate |
| `scripts/test-audience-hydration.js` | New unit test script |

## Files NOT Modified

- `src/server/feed-service.js` — already passes `auth.user` to `canViewPost`; auto-hydration handles it
- `src/server/map-v2-service.js` — same
- `src/server/post-service.js` — same
- `src/server/channel-service.js` — same (reply check uses `canReplyToPost` → `canViewPost`)
- `src/server/auth-service.js` — no changes needed; raw user shape unchanged
- `public/*` — no frontend changes

## Validation

```
node --check src/server/audience-service.js     ✓
node --check src/server/channel-service.js       ✓
node --check src/server/feed-service.js          ✓
node --check src/server/map-v2-service.js        ✓
node --check src/server/post-service.js          ✓
node scripts/test-audience-hydration.js          61/61 pass
node scripts/smoke-frontend.js                   21/21 pass
node scripts/test-metadata-write-safety.js       14/14 pass
node scripts/test-routes.js                      61/61 pass
```

## Design Decisions

1. **Auto-hydrate inside permission functions**: Rather than requiring all call sites to hydrate first, permission functions call `hydrateAudienceUser()` internally. This eliminates the risk of forgotten hydration at new call sites.

2. **`options.isAdmin` for admin injection**: Admin status is determined by `ADMIN_TOKEN` header (request-utils.js), not stored in the auth user. The `options` parameter lets callers pass `{ isAdmin: true }` when the header matched. Permission functions auto-hydrate without this option, so admin override requires the caller to pre-hydrate with the option — this is intentional to keep admin override explicit.

3. **No schema changes**: Auth store records are unchanged. Hydration is a read-time normalization layer.

4. **Double hydration is cheap**: If a pre-hydrated viewer is passed to `canViewPost`, it gets hydrated again (no-op since it already has `schoolId`, `orgIds`, etc.). The cost is negligible and avoids needing a "is already hydrated" sentinel.

## Remaining Item

- Public text-only `/api/posts` metadata write (last unchecked acceptance criterion) — belongs to a separate task.

## Next Steps

- Lane E (NodeBB contract smoke tests) can proceed
- Lane F (Messages) and Lane G (Channel) can now proceed with D completed
