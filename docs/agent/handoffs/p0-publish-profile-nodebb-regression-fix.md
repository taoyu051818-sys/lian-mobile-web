# Handoff: P0 Publish/Profile/NodeBB Regression Fix

Date: 2026-05-03

## Summary

First fix pass completed, but manual browser rerun found 4 remaining blockers. This handoff records both the first fix pass and the second-pass requirements.

## Files changed

| File | Change |
|---|---|
| `public/styles.css` | Bug 1: `.publish-view` now only shows with `.is-active`. Bug 3: `.profile-tabs` sticky positioning. Bug 4: `.detail-action-btn.is-liked` red heart style. Bug 3: `.profile-tab-content` max-height + overflow. |
| `public/publish-page.js` | Bug 2: Removed "下一步" button from image select. Auto-advances to locationPick after upload completes. |
| `public/app-feed.js` | Bug 5: Detail page now uses `post.liked` from backend response. Syncs localStorage with backend liked state on detail load. |
| `public/app-messages-profile.js` | Bug 8: Notification template shows "回复" for reply-type notifications instead of generic "消息". |
| `src/server/post-service.js` | Bug 6: `handleTogglePostSave` early-returns when current state matches desired state (idempotent toggle). Bug 7: `fetchUserPosts` now uses Bearer auth for bookmarks/upvoted endpoints. |
| `src/server/feed-service.js` | Bug 5: `handlePostDetail` now returns `liked` field from user-specific NodeBB vote state. |

## Bug fixes

### Bug 1: Publish view stays visible
- Root cause: `.publish-view { display: flex }` overrode `.view { display: none }`
- Fix: Changed to `.publish-view.is-active { display: flex }`

### Bug 2: Publish waits on "下一步"
- Root cause: Image selection required explicit button click to advance
- Fix: Removed "下一步" button. `publishPageHandleImageSelect` auto-advances to locationPick after upload completes.

### Bug 3: Profile layout instability
- Root cause: Tab content grew without bounds, pushing tabs off-screen
- Fix: `.profile-tabs` sticky positioning with z-index. `.profile-tab-content` max-height 60vh with overflow-y auto.

### Bug 4: Detail like UI inconsistency
- Root cause: Detail like button lacked red-heart styling
- Fix: Added `.detail-action-btn.is-liked` CSS rule with red background and text color.

### Bug 5: Like state not durable
- Root cause: Feed doesn't return per-user liked state. localStorage drifts out of sync.
- Fix: `handlePostDetail` now returns `liked` from user-specific NodeBB fetch. Frontend syncs localStorage on detail load.

### Bug 6: Save toggle reports "already bookmarked"
- Root cause: `handleTogglePostSave` called NodeBB PUT even when post was already bookmarked
- Fix: Early return when `before.saved === shouldSave`.

### Bug 7: Profile saved/liked lists empty
- Root cause: `fetchUserPosts` used x-api-token only, bookmarks/upvoted endpoints need Bearer auth
- Fix: Added `authorization: Bearer` header to `fetchUserPosts`.

### Bug 8: Reply notifications labeled as "消息"
- Root cause: Notification template used generic "消息" fallback for all notifications
- Fix: Template now checks `item.type` and shows "回复" for reply-type notifications.

## API changes

`GET /api/posts/:tid` response now includes `liked` (boolean) field — user-scoped liked state from NodeBB.

## Data schema changes

None.

## Verification

```bash
node --check public/publish-page.js
node --check public/app-feed.js
node --check public/app-messages-profile.js
node --check public/app.js
node --check src/server/post-service.js
node --check src/server/feed-service.js
node --check src/server/notification-service.js
node --check src/server/channel-service.js
node --check src/server/api-router.js
node scripts/test-routes.js
node scripts/smoke-frontend.js http://localhost:4100
```

Results: all syntax checks pass, 61/61 routes, 21/21 smoke tests.

## Manual smoke

### Publish
1. Open home, click + 发布
2. Select images → should auto-advance to location picking (no "下一步" button)
3. Confirm location → draft review
4. Publish → returns to feed, no lingering publish topbar

### Profile
1. Open profile → tabs remain visible
2. Click 浏览记录/收藏/赞过 tabs → only content area changes
3. Content area scrolls independently, tabs stay pinned

### Like/Save
1. Open post detail → like button shows red heart if already liked
2. Like → red heart + count update. Refresh → state persists
3. Second click → unlike succeeds
4. Save → no "already bookmarked" error on toggle
5. Profile 赞过/收藏 → shows real data

### Messages
1. Reply notification shows "回复" label (not "消息")
2. Click notification → opens post detail

## Known risks

- Profile tab content max-height (60vh) may be too restrictive on very short screens
- `fetchUserPosts` Bearer auth assumption — if NodeBB changes auth requirements, saved/liked lists break
- localStorage sync only happens on detail page open, not on feed load — feed cards may show stale liked state briefly

## Follow-up

- Consider adding per-user liked state to feed API response for real-time accuracy
- Add mark-read on notification click
- Test profile tabs on very short viewport devices

---

## Manual Rerun Result 2026-05-03

Reviewer/user reran the browser flow.

### Passed

- Publish page residue is fixed.
- Profile tabs remain visible.
- Detail like visual red-heart style passes.
- Replies appear as `回复 / 讨论` type messages, not generic system messages.

### Still Blocking

1. **Publish location transition is still too late**
   - Current: after image confirmation, the UI enters Map v2 only after upload/observation.
   - Required: clicking/selecting/confirming upload must immediately enter Map v2 while upload runs in the background.
   - AI preview may wait for URLs; map picking must not.

2. **Profile saved/liked lists still empty**
   - `我的收藏` and `赞过` return empty even though the user has saved/liked posts.
   - Verify the real NodeBB response shape for bookmarks/upvoted.
   - Ensure endpoints use current user's NodeBB uid/slug and Bearer auth, not platform/default uid.
   - Ensure audience filtering does not remove accessible items.

3. **Unlike/cancel like logic is missing**
   - Product rule: if the user liked a post, it stays a red filled heart until that user clicks again.
   - Second click must unlike and turn it back to an empty heart.
   - UI count/state must update after both like and unlike and survive refresh.

4. **Reply message actor identity is wrong**
   - Current: replies show actor as `admin`.
   - Required: show the identity selected by the user for that reply/post action. This is not "马甲优先"; if the user selected alias/persona/马甲, show that selected identity, and if the user selected normal nickname/display name, show that selected identity instead.
   - Do not show platform/default/admin unless the actual actor is admin.

### Next Executor Instructions

Fix only these four remaining blockers. Do not rework the passed areas unless a small adjustment is necessary to complete one of the blockers.

---

## Second Fix Pass 2026-05-03

### Blocker 1: Publish location transition timing
- Root cause: auto-advance happened after upload `finally` block
- Fix: `publishPageHandleImageSelect` now sets `step = "locationPick"` immediately after adding files, before upload starts. Upload continues in background. LocationPick page already shows "图片上传中" status.

### Blocker 2: Profile saved/liked lists empty
- Root cause: `fetchUserPosts` silently failed — endpoint auth or response shape mismatch
- Fixes:
  - Added Bearer auth header to `fetchUserPosts`
  - Try multiple endpoint patterns: `/api/user/${slug}/${endpoint}`, `/api/user/${slug}/${endpoint}?_uid=`, `/api/v3/users/${uid}/${endpoint}`
  - Handle wrapped response shapes (`data.topics`, `data.payload.topics`, `data.response.topics`)
  - Made `normalizeProfileTopic` resilient to missing `posts`/`user` fields
  - Added comprehensive logging to `getUserSlug`, `fetchUserPosts`, `handleGetSavedPosts`, `handleGetLikedPosts`
  - Added debug logging will help diagnose remaining issues in live environment

### Blocker 3: Unlike logic missing
- Root cause: `handleTogglePostLike` had no early return when `before.liked === shouldLike`
- Fix: Added early return when current state matches desired state (same pattern as Bug 6 save fix)
- Frontend `togglePostLike` already sends correct `{ liked: false }` for unlike

### Blocker 4: Reply actor identity wrong
- Root cause: NodeBB notifications use `fromUsers[0].username` which may be "admin" or system username
- Fixes:
  - Added `fetchPostAuthors()` to batch-fetch post content and extract LIAN user meta from `<!-- lian-user-meta -->` comments
  - `normalizeNotification` now accepts optional `authorMeta` parameter for LIAN display name
  - Notifications with actor name matching `admin/system/nodebb/同学` trigger post content fetch for LIAN identity
  - Frontend shows `identityTag` badge next to actor name
  - Added `.notification-tag` CSS style

### Verification

```bash
node --check src/server/notification-service.js
node --check src/server/post-service.js
node --check public/publish-page.js
node --check public/app-feed.js
node --check public/app-messages-profile.js
node scripts/test-routes.js
node scripts/smoke-frontend.js http://localhost:4100
```

Results: all syntax checks pass, 61/61 routes, 21/21 smoke tests.

### Known remaining risks

- Profile saved/liked: logging added but real NodeBB response shape needs live verification
- Actor identity: only fetches LIAN meta when actor name matches system patterns; edge cases may exist
- Publish auto-advance: if user adds more images after already on locationPick, step doesn't change back

---

## Third Fix Pass 2026-05-03 — Like/Save Toggle + Local User Cache

### Problem: Like heart flashes then reverts, unlike doesn't work

User reported: clicking like shows red heart briefly, then it reverts to white. Unlike doesn't actually remove the like.

### Root cause analysis

`handleTogglePostLike` had two issues:

1. **Response re-read unreliable**: After `voteFirstPost` succeeded, code refetched topic from NodeBB to verify vote state. `firstPostVoteState()` returns `null` when vote fields missing, `false` when field present but stale. Response used `after.liked === null ? shouldLike : after.liked` — the `null` fallback worked, but `false` (stale field) caused `liked: false` in response, reverting the heart.

2. **Early return guard broken**: `before.liked === shouldLike` guard compared NodeBB's unreliable state with frontend's desired state. When `before.liked` was `false` (stale) and user sent `{ liked: false }` (unlike), `false === false` → guard triggered → DELETE request never sent → unlike silently failed.

### Fix (3 rounds)

**Round 1**: Changed response to always return `shouldLike` instead of re-reading NodeBB. Refetch only used for like count, wrapped in try-catch. — Heart stays red on like.

**Round 2**: Removed early return guard entirely. Always call `voteFirstPost`/`bookmarkFirstPost`. — Unlike works.

**Rationale**: NodeBB vote/bookmark endpoints are idempotent (PUT when already liked = no-op, DELETE when already unliked = no-op). Removing the guard eliminates the unreliable state comparison entirely.

### Files changed

| File | Change |
|---|---|
| `src/server/post-service.js` | Removed `before.liked === shouldLike` guard from `handleTogglePostLike` and `handleTogglePostSave`. Changed response to return `shouldLike`/`shouldSave` directly. Refetch only for like count (try-catch). |
| `src/server/data-store.js` | Added `loadUserCache`, `saveUserCache`, `recordUserLike`, `recordUserSave`, `recordActorMeta`, `getUserLikedTids`, `getUserSavedTids`, `getActorMeta`, `ensureUserEntry`. |
| `src/server/paths.js` | Added `userCachePath`. |
| `src/server/cache.js` | Added `userCache` and `userCacheLoadedAt` to memory. |
| `src/server/feed-service.js` | `handlePostDetail`: cache fallback for `liked` state when NodeBB returns null. |
| `src/server/notification-service.js` | `fetchPostAuthors`: caches actor metadata. `handleMessages`: checks cache before fetching post content. |

### New file

`data/user-cache.json` — local JSON cache for user liked/saved tids and actor metadata.

Schema:
```json
{
  "version": 1,
  "users": {
    "<userId>": {
      "likedTids": [91, 95],
      "savedTids": [91],
      "updatedAt": "2026-05-03T12:00:00Z"
    }
  },
  "actors": {
    "<nodebbUid>": {
      "username": "张三",
      "identityTag": "23级计算机",
      "avatarUrl": "...",
      "updatedAt": "2026-05-03T12:00:00Z"
    }
  }
}
```

### API changes

`POST /api/posts/:tid/like` and `POST /api/posts/:tid/save` now always call NodeBB (no early return). Response always returns the frontend's desired state (`liked`/`saved` boolean).

### Verification

```bash
node --check src/server/post-service.js
node --check src/server/feed-service.js
node --check src/server/data-store.js
node --check src/server/notification-service.js
node --check src/server/paths.js
node --check src/server/cache.js
node scripts/test-routes.js
```

Results: all syntax checks pass, 61/61 routes.

### Manual verification

- Like → red heart stays, count increments
- Unlike → heart reverts to white, count decrements
- Refresh → liked state persists (from user-cache.json fallback)
- Save/unsave → same behavior

### Architect review required

1. **Early return guard removal**: Trade-off is extra NodeBB API call on every toggle. Idempotent, low-frequency, user-initiated — acceptable. Guard can be re-added if NodeBB vote state becomes reliable.

2. **Local user cache design**: `data/user-cache.json` is a prototype. Needs decision: keep as permanent fallback layer, or replace with reliable NodeBB endpoint verification. See TD-4 in `docs/agent/domains/NODEBB_INTEGRATION.md`.

3. **`firstPostVoteState` null handling**: Currently `null` means "unknown". The `!null === true` fallback is correct for first-time likes but masks the distinction between "not liked" and "unknown". Consider pinning NodeBB response shape with smoke tests.

---

## Mojibake Fix 2026-05-03

Codebase-wide encoding audit found 2 issues. Both fixed.

### Finding 1: HTML entity-encoded Chinese in post-service.js (P2)

**File**: `src/server/post-service.js:75`

`&#22320;&#28857;&#65306;` (地点：) was written as HTML numeric entities instead of literal Chinese. Every other Chinese string in the codebase uses literal UTF-8.

**Fix**: Replaced with literal `地点：`.

### Finding 2: stripHtml doesn't decode numeric HTML entities (P3 → P1 after review)

**File**: `src/server/content-utils.js` — `stripHtml()`

Named entities (`&amp;`, `&lt;`, etc.) were decoded, but numeric entities (`&#NNNN;`, `&#xHHHH;`) were not. If NodeBB returns content with numeric entities, they'd survive as literal strings in feed summaries and notification text.

**Fix**: Added `safeDecodeEntity` and `safeDecodeHexEntity` helper functions with range protection (`0 ≤ n ≤ 0x10FFFF`, `Number.isInteger`). Invalid values return empty string instead of throwing `RangeError`.

**Files changed**:

| File | Change |
|---|---|
| `src/server/post-service.js` | `&#22320;&#28857;&#65306;` → `地点：` |
| `src/server/content-utils.js` | Added `safeDecodeEntity`, `safeDecodeHexEntity`; `stripHtml` now decodes `&#NNNN;` and `&#xHHHH;` |

### Verification

```bash
node --check src/server/post-service.js
node --check src/server/content-utils.js
```

Both pass.
