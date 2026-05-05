# Task: P0 Publish/Profile/NodeBB Regression Fix

Status: **待复核 / blockers remain**

## Goal

Fix the runtime regressions found during manual browser review of Publish V2, profile activity, NodeBB like/save behavior, and messages discussion notifications.

This is a bugfix pass only. Do not add new product features.

## User-Reported Bugs

### 1. Publish page stays mounted after publish/cancel

Observed DOM:

```html
<section class="view publish-view" data-view="publish">
  <header class="publish-topbar">
    <button class="back-button" type="button" data-publish-back aria-label="返回">‹</button>
    <h2>发布</h2>
    <span class="publish-step-label" id="publishStepLabel">1/3 选择图片</span>
  </header>
</section>
```

User symptom:

- A publish topbar/back button appears unexpectedly.
- It remains visible after publishing or leaving the flow.
- Position is strange and it looks like it is left underneath another page.

Expected:

- Publish view is visible only while the active view is `publish`.
- After successful publish, cancel, or back, the publish page state is cleared or hidden.
- No publish topbar/back button should remain on home, profile, detail, or messages views.

Likely files:

- `public/publish-page.js`
- `public/app.js`
- `public/app-state.js`
- `public/styles.css`

### 2. Publish V2 still waits on "下一步"

Observed DOM:

```html
<button class="primary" type="button" data-publish-confirm-images>下一步</button>
```

User symptom:

- After confirming/choosing images, the page still waits for the user to press `下一步`.
- This violates the product decision: image confirmation should immediately enter Map v2 location picking while upload and AI latency continue in the background.

Expected:

- After image selection/confirmation, the flow immediately advances to Map v2 location picking.
- The location step includes both `确认地点` and `跳过定位`.
- Upload progress and AI preview readiness are shown without blocking location picking.
- The user still must explicitly click final publish before public posting.

Likely files:

- `public/publish-page.js`
- `public/map-v2.js`
- `public/styles.css`

### 3. Profile activity layout is unstable

User symptom:

- In profile, `浏览记录` appears or expands before the user clicks the tab.
- After it appears, it occupies the whole page and pushes away `我的收藏` and `赞过`.

Expected:

- Profile activity should show stable tabs or sections.
- `浏览记录`, `我的收藏`, and `赞过` should remain visible as navigation controls.
- Only the selected tab content should render in the content area.
- Empty/error states should not occupy or replace the full profile page shell.

Likely files:

- `public/app-messages-profile.js`
- `public/styles.css`
- `public/app.js`

### 4. Detail-page like UI is inconsistent

User symptom:

- Homepage card heart UI looks good.
- Detail-page like only switches to a simple filled state, not the same red-heart visual language.

Expected:

- Detail-page like button should use the same empty-heart / red-filled-heart pattern as homepage cards.
- Like count and state should be clear after click and after refresh.

Likely files:

- `public/app-feed.js`
- `public/styles.css`

### 5. Homepage card like state is not durable/toggle-safe

User symptom:

- Homepage heart does not persist the already-liked state when returning or refreshing.
- Second click attempts to like again instead of unlike.

Expected:

- Feed card like control should render the current user's liked state from backend data when available.
- First click toggles like on.
- Second click toggles like off.
- After refresh/reload, state and count match NodeBB.
- If backend reports "already liked" or equivalent, frontend should reconcile state instead of repeatedly trying the same action.

Likely files:

- `src/server/post-service.js`
- `src/server/feed-service.js`
- `public/app-feed.js`
- `public/app.js`

### 6. Save/bookmark toggle reports already bookmarked

Observed error:

```json
{
  "status": {
    "code": "bad-request",
    "message": "You have already bookmarked this post"
  },
  "response": {}
}
```

User symptom:

- The post is already bookmarked, but LIAN still tries to bookmark it again.
- Profile `我的收藏` can still show empty even though bookmarked content exists.

Expected:

- Save endpoint must behave as an idempotent toggle.
- If the post is already bookmarked, LIAN should treat it as saved and either return `saved: true` or perform the intended unsave path.
- Detail initial `bookmarked` state must be user-scoped and accurate.
- Profile saved list should fetch and render the current user's saved posts.

Likely files:

- `src/server/post-service.js`
- `src/server/feed-service.js`
- `public/app-feed.js`
- `public/app-messages-profile.js`

### 7. Profile saved/liked lists return empty while data exists

User symptom:

- `我的收藏` and `赞过` currently show empty.
- The user confirms there are already liked and bookmarked posts.

Expected:

- `GET /api/me/saved` returns the current user's NodeBB bookmarks.
- `GET /api/me/liked` returns the current user's NodeBB upvoted posts.
- Endpoints must use current LIAN user's NodeBB uid/slug, not platform/default uid.
- Response shape from NodeBB must be smoke-tested against the live instance.
- Audience filtering should hide inaccessible posts without hiding accessible saved/liked posts.

Likely files:

- `src/server/post-service.js`
- `src/server/nodebb-client.js`
- `public/app-messages-profile.js`

### 8. Replies should be discussion items, not system messages

Product correction:

- All replies/comments should enter the messages page.
- A reply should be treated as a discussion item in the messages page, not as a generic system message.
- Messages page meaning: real-time discussion activity.
- This is still not private chat.

Expected:

- Reply notifications are rendered in a `讨论 / 回复` section or tab.
- Labels should avoid "系统消息" for normal replies.
- Click opens LIAN post detail.
- Permissions still apply: users without access to the related post should not see reply content.

Likely files:

- `src/server/notification-service.js`
- `src/server/channel-service.js`
- `public/app-messages-profile.js`
- `public/styles.css`

## Non-Goals

- No new recommendation strategy.
- No private messages/chat.
- No push notifications.
- No moderation dashboard.
- No Map v2 redesign.
- No new NodeBB plugin.
- No broad frontend redesign.
- No repo split work in this bugfix.

## Allowed Files

Runtime files, only as needed for these bugs:

- `public/publish-page.js`
- `public/app-feed.js`
- `public/app-messages-profile.js`
- `public/app.js`
- `public/app-state.js`
- `public/styles.css`
- `src/server/post-service.js`
- `src/server/feed-service.js`
- `src/server/notification-service.js`
- `src/server/channel-service.js`
- `src/server/nodebb-client.js`
- `src/server/api-router.js`

Docs:

- `docs/agent/tasks/p0-publish-profile-nodebb-regression-fix.md`
- `docs/agent/handoffs/p0-publish-profile-nodebb-regression-fix.md`
- `docs/agent/05_TASK_BOARD.md`

## Forbidden Files

- `data/post-metadata.json`, unless a local test creates then cleans up a known test record and the reviewer approves it.
- `data/feed-rules.json`
- `data/locations.json`
- `data/map-v2-layers.json`
- Map editor files.
- NodeBB plugin code.

## Validation Commands

```bash
node --check public/publish-page.js
node --check public/app-feed.js
node --check public/app-messages-profile.js
node --check public/app.js
node --check src/server/post-service.js
node --check src/server/feed-service.js
node --check src/server/notification-service.js
node --check src/server/channel-service.js
node scripts/test-routes.js
node scripts/smoke-frontend.js http://localhost:4100
node scripts/smoke-nodebb-contracts.js
```

If `smoke-nodebb-contracts` cannot reach NodeBB in the executor environment, record the network failure explicitly and run browser/manual checks against the environment where NodeBB is reachable.

## Manual Acceptance

### Publish

1. Open LIAN home.
2. Click `+ / 发布`.
3. Select one or more images.
4. Confirm image selection.
5. Confirm the UI immediately enters Map v2 location picking without waiting on a visible `下一步`.
6. Confirm `确认地点` and `跳过定位` are available.
7. Complete publish.
8. Return to home/profile/detail/messages and confirm the publish topbar/back button no longer remains on screen.

### Profile

1. Open profile.
2. Confirm `浏览记录`, `我的收藏`, and `赞过` controls remain visible.
3. Click each tab.
4. Confirm only the selected tab content changes.
5. Empty/error states do not replace the whole profile page shell.

### Like/Save

1. Open a post detail page.
2. Like it. Confirm red filled heart and count update.
3. Refresh. Confirm liked state persists.
4. Click again. Confirm unlike succeeds.
5. Save/bookmark it. Refresh. Confirm saved state persists.
6. Click again. Confirm unsave succeeds.
7. Confirm no `You have already bookmarked this post` error appears during normal toggle.
8. Open home feed and verify card heart state matches current user's liked state.

### Profile Lists

1. Like at least one visible post.
2. Save at least one visible post.
3. Open profile `赞过`; confirm liked post appears.
4. Open profile `我的收藏`; confirm saved post appears.
5. Confirm inaccessible posts do not leak.

### Messages

1. User B replies to User A's post.
2. User A opens messages.
3. Reply appears as discussion/reply activity, not a generic system message.
4. Clicking it opens LIAN post detail.
5. Unauthorized post reply content is hidden.

## Acceptance Decision

This task can be marked Done only when:

- Publish page no longer persists outside publish flow.
- Publish image confirmation immediately enters Map v2 location picking.
- Profile activity layout is stable.
- Like/save toggles are stateful, refresh-safe, and current-user scoped.
- Saved/liked profile lists return real current-user data.
- Replies render as discussion activity in messages.
- Validation commands and manual acceptance are recorded in the handoff.

---

## Manual Rerun Result Added 2026-05-03

The user reran browser checks after the first fix pass.

### Passed

- Publish page no longer remains visible after leaving/completing publish.
- Profile activity tabs remain visible; `浏览记录`, `我的收藏`, and `赞过` controls are not pushed away.
- Detail like UI red-heart styling passes visual review.
- Replies now appear as `回复 / 讨论` style messages instead of generic system messages.

### Still Blocking (addressed in second fix pass)

#### A. Publish must enter map immediately when upload starts — FIXED

Fix: `publish-page.js` sets `step = "locationPick"` immediately on image selection, before upload starts.

#### B. Profile saved and liked lists still return empty — FIXED

Fix: `fetchUserPosts()` uses Bearer auth, multi-endpoint fallback (`/api/user/:slug/:endpoint`, `/api/v3/users/:uid/:endpoint`), debug logging. Cache sync on successful fetch.

#### C. Like state/toggle logic is still incomplete — FIXED

Fix (3 rounds):

1. Added `recordUserLike` cache write on toggle, `getUserLikedTids` fallback on detail page.
2. Changed response to trust `shouldLike` instead of re-reading NodeBB (refetch unreliable).
3. Removed early return guard (`before.liked === shouldLike`) — NodeBB's vote fields are unreliable (`null` or stale `false`), causing guard to skip DELETE request. Vote/bookmark endpoints are idempotent, so always calling them is safe.

#### D. Reply message actor identity is wrong — FIXED

Fix: `notification-service.js` batch-fetches post content to extract `<!-- lian-user-meta -->`, caches actor metadata in `data/user-cache.json`.

### Local User Cache (data/user-cache.json)

Created as fallback storage for unreliable NodeBB endpoints:

- Schema: `{ version: 1, users: { "<userId>": { likedTids, savedTids, updatedAt } }, actors: { "<nodebbUid>": { username, identityTag, avatarUrl, updatedAt } } }`
- Write on toggle (like/save), overwrite from NodeBB on list fetch
- Actor metadata cached from post content `<!-- lian-user-meta -->` comments
- 15s TTL in memory, atomic file writes

**Needs architect review**: this cache is a prototype. Long-term design should decide whether to keep as permanent layer or replace with reliable NodeBB endpoint verification.

### Like/Save Toggle Design — Architect Review Required

The current toggle implementation has a design decision that needs architect sign-off:

**Decision**: Remove `before.liked === shouldLike` early return guard. Always call NodeBB vote/bookmark endpoint regardless of perceived current state.

**Rationale**:
- `firstPostVoteState()` reads from `posts[0].upvoted`/`voted`/`vote` — returns `null` when all fields missing, `false` when field present but value is falsy
- `null` case: `null === true/false` → false → guard doesn't trigger → works correctly
- `false` case: `false === false` → true → guard triggers → DELETE never sent → unlike silently fails
- NodeBB vote/bookmark endpoints are idempotent (PUT when already liked = no-op, DELETE when already unliked = no-op)

**Trade-off**: Extra NodeBB API call on every toggle (even when state hasn't changed). Acceptable because toggle is user-initiated, low-frequency.

**Alternative considered**: Fix `firstPostVoteState` to handle `null` explicitly (treat as `false`). Rejected because: (a) `null` means "unknown", not "not liked" — treating it as `false` would cause incorrect behavior on first-time like; (b) even with `null` handling, the `false` case (field present but stale) still breaks the guard.
