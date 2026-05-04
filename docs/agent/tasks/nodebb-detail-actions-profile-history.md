# Task: NodeBB Detail Actions And Profile Activity

## Goal

Connect the next NodeBB native interactions at the correct product surfaces:

- detail page: favorite/save and report;
- profile page: browsing history, saved posts, liked posts;
- homepage cards: no additional actions beyond the existing like cut.

## Product Decisions

1. Posts are the core interaction unit.
2. Favorite/save applies to posts, not standalone locations.
3. If a post includes a location, the detail page should provide a jump to that location.
4. Do not build separate location collection/favorite management in this phase.
5. Report/flag is detail-page only.
6. Favorite/save is detail-page only.
7. Browsing history, saved posts, and liked posts live in profile.
8. Homepage cards should remain visually simple. Do not add favorite/report/history controls to cards.

## Detail Page Actions

The detail page should expose:

- Save / 收藏
- Report / 举报
- Jump to location, when the post has trusted location data

Recommended placement:

- Save: top action row or detail metadata card.
- Report: overflow/more menu or lower safety action.
- Location jump: visible location row/card inside detail content.

## Profile Page Sections

Add profile sections:

```text
浏览记录
我的收藏
赞过
```

### 浏览记录

Source:

- NodeBB read-state where available;
- LIAN may keep a local/server-side history mirror later, but must not expose it publicly.

Rules:

- mark read only when detail page opens;
- do not mark read on card impression;
- show only current user's history;
- apply audience checks before returning any item.

### 我的收藏

Source:

- NodeBB bookmark/favorite if endpoint semantics match.

Rules:

- list saved posts only;
- apply audience checks before returning any item;
- if a saved post becomes inaccessible, hide it or show a safe unavailable placeholder.

### 赞过

Source:

- NodeBB vote/upvote state.

Rules:

- list posts liked by current user;
- apply audience checks before returning any item;
- do not use liked posts to change feed ranking in this task.

## Implemented APIs

### LIAN endpoints (implemented)

```text
POST /api/posts/:tid/save       — toggle bookmark (PUT/DELETE /api/v3/posts/:pid/bookmark)
POST /api/posts/:tid/report     — flag post (POST /api/v3/posts/:pid/flag)
POST /api/posts/:tid/like       — toggle vote (existing, now with audience check)
GET  /api/me/saved              — user's bookmarked posts via /api/user/:slug/bookmarks
GET  /api/me/liked              — user's upvoted posts via /api/user/:slug/upvoted
POST /api/me/history            — read history from frontend readTids, filtered by audience
GET  /api/posts/:tid            — detail response now includes user-scoped `bookmarked` field
```

### NodeBB endpoints used

```text
PUT    /api/v3/posts/:pid/bookmark     — save post
DELETE /api/v3/posts/:pid/bookmark     — unsave post
POST   /api/v3/posts/:pid/flag         — report post
GET    /api/user/:slug/bookmarks       — user's saved list
GET    /api/user/:slug/upvoted         — user's liked list
GET    /api/user/uid/:uid              — resolve user slug from uid
```

### Audience enforcement

All action endpoints (save, report, like) run `canViewPost(auth.user, { visibility, audience })` before calling NodeBB. Profile list endpoints filter results through `canViewPost`.

### User-scoped bookmark state

Detail page fetches topic with user's `nodebbUid` via `withNodebbUid` to get accurate `bookmarked` field. Anonymous users get `bookmarked: false`.

## Review Fixes Applied

1. **Like audience check**: `handleTogglePostLike` now loads metadata and runs `canViewPost` before voting.
2. **User-scoped bookmark state**: `handlePostDetail` fetches user-scoped topic detail when logged in.
3. **Profile thumbnails**: `normalizeProfileTopic` uses `proxiedPostImageUrl(meta.imageUrls[0], { width: 400 })` instead of NodeBB files endpoint.
4. **History uses user uid**: `handleGetHistory` uses `ensureNodebbUid(auth)` instead of `config.nodebbUid`.
5. **Event listener dedup**: `loadProfile` uses `_profileBound` flag to prevent duplicate listeners.

## Pending Smoke Tests

`GET /api/user/:slug/bookmarks` and `GET /api/user/:slug/upvoted` need runtime verification against the actual NodeBB instance. Confirm response shape is `{ topics: [...] }`.

## Encoding Safety

Several existing files in this area already show mojibake in terminal output. Implementation threads must not make the encoding damage worse.

Rules:

- Preserve files as UTF-8.
- Do not paste or save garbled Chinese strings such as `鏀惰棌`, `璧炶繃`, `娴忚璁板綍` into runtime UI.
- User-facing labels should render as normal Chinese:
  - `收藏`
  - `举报`
  - `浏览记录`
  - `赞过`
  - `加载中`
  - `退出登录`
- If a touched runtime file already contains mojibake near the edited lines, either restore the affected labels to proper UTF-8 in the same patch or explicitly call it out in the handoff.
- Verify UI text in the browser or a UTF-8 terminal before marking the task complete.

## Affected Files

Frontend:

- `public/app-feed.js` — detail action bar, togglePostSave, handleReportPost
- `public/app-messages-profile.js` — profile tabs, loadProfileTab, profileListItem
- `public/app.js` — event delegation for save/report buttons
- `public/styles.css` — detail-actions, profile-tabs, profile-list styles

Backend:

- `src/server/post-service.js` — bookmarkFirstPost, handleTogglePostSave, flagNodebbPost, handleReportPost, handleGetSavedPosts, handleGetLikedPosts, handleGetHistory
- `src/server/api-router.js` — 6 new routes
- `src/server/feed-service.js` — user-scoped bookmarked field in handlePostDetail

## Non-Goals

- No homepage card favorite/report buttons.
- No location favorites.
- No feed ranking changes.
- No public display of browsing history.
- No private messages.
- No new moderation dashboard in the same first cut unless explicitly approved.

## Validation

Manual:

1. Open a post detail page.
2. Save the post.
3. Confirm it appears in profile -> 我的收藏.
4. Unsave it.
5. Confirm it disappears from 我的收藏.
6. Report the post from detail.
7. Confirm NodeBB or LIAN moderation receives a report record.
8. Open several post details.
9. Confirm profile -> 浏览记录 shows them.
10. Like posts from cards or later detail.
11. Confirm profile -> 赞过 lists them.

Security:

- saved/history/liked lists must apply audience checks;
- another user must not see my lists.

## Rollback

- Remove detail save/report actions.
- Remove profile sections and their API calls.
- Remove LIAN proxy routes for save/report/history/liked lists.
- Do not touch feed ranking rollback.

---

## Review Blockers Added 2026-05-03

This task is not approved yet.

Findings:

- Detail actions and profile lists rely on `canViewPost()`. Until canonical audience user hydration is fixed, save/like/report and profile filtering can deny valid school users or mis-handle private/org visibility.
- Runtime user-facing labels in the touched frontend files still contain mojibake. This directly fails the task's own encoding-safety requirement.
- `scripts/smoke-frontend.js` did not finish green during review. Individual `node --check` on key files passed, but the task cannot be accepted until the smoke result is clean or the harness issue is fixed and documented.
- Action endpoints pass simplified `{ visibility, audience }` objects to `canViewPost()`. If private/linkOnly author override matters for an action, the caller must include the author context or explicitly document why it is not required.

Acceptance additions:

- [ ] Browser-visible labels for save, report, history, saved, liked, loading, and empty states render as normal UTF-8 Chinese.
- [ ] Frontend smoke is green after the label cleanup.
- [ ] Save/like/report are tested with public, campus, school, private, and linkOnly posts.
- [ ] Profile saved/liked/history lists hide inaccessible posts after audience hydration is fixed.
- [ ] Runtime verification against NodeBB confirms `GET /api/user/:slug/bookmarks` and `GET /api/user/:slug/upvoted` response shapes.

---

## Fix Pass Result Added 2026-05-03

Status: fixed, pending NodeBB interaction smoke.

Recorded implementation result:

- Audience hydration dependency is resolved by Lane D.
- `/api/posts` baseline metadata write was fixed in `post-service.js`.
- No mojibake found in the latest touched labels according to the implementation handoff.
- Frontend smoke reports 21/21 pass.
- The broader fix pass reports 143/143 tests passing.

Reviewer validation still required:

```bash
node scripts/smoke-frontend.js http://localhost:4100
node scripts/smoke-nodebb-contracts.js
```

Manual checks still required:

- Save and unsave one visible post from detail.
- Like and unlike one visible post.
- Report one visible test post.
- Confirm profile saved, liked, and history lists load for the current user and hide inaccessible posts.

---

## P1 Browser Acceptance Requirement Added 2026-05-03

Current Pro decision: validate this after Publish V2, or in parallel if a separate reviewer is available.

Do not add new NodeBB native features in this acceptance pass. The scope is only:

- detail save/unsave;
- detail like/unlike;
- detail report;
- profile browsing history;
- profile saved posts;
- profile liked posts.

Acceptance must include:

- [ ] Browser-visible Chinese labels render normally.
- [ ] Save state remains correct after page refresh.
- [ ] Like count/state remains correct after page refresh.
- [ ] Report action returns a clear success/failure state.
- [ ] Saved list uses the current user, not platform/default uid.
- [ ] Liked list uses the current user, not platform/default uid.
- [ ] History list uses the current user and hides inaccessible posts.
- [ ] Inaccessible school/private/org/linkOnly posts do not leak through profile lists.

If any runtime issue appears, open a separate narrow fix task instead of expanding this acceptance task.
