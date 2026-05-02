# Handoff: NodeBB Detail Actions & Profile Activity

Date: 2026-05-02

## Product Decision

NodeBB native interactions are split by surface:

- homepage cards keep only the like cut;
- save/favorite belongs on detail page;
- report/flag belongs on detail page;
- browsing history, saved posts, and liked posts belong in profile;
- posts are the core saved/activity unit;
- no separate location favorite/collection system in this phase.

## Task Doc

`docs/agent/tasks/nodebb-detail-actions-profile-history.md`

## Files Changed

### Backend

| File | Changes |
|---|---|
| `src/server/post-service.js` | +12 functions: `bookmarkFirstPost`, `firstPostBookmarkState`, `handleTogglePostSave`, `flagNodebbPost`, `handleReportPost`, `getUserSlug`, `fetchUserPosts`, `handleGetSavedPosts`, `handleGetLikedPosts`, `handleGetHistory`, `normalizeProfileTopic`, `filterByAudience`. New imports: `canViewPost`, `getCurrentUser`, `loadMetadata`, `fetchNodebbTopicIndex`, `proxiedPostImageUrl` |
| `src/server/api-router.js` | +6 routes: `POST /api/posts/:tid/save`, `POST /api/posts/:tid/report`, `GET /api/me/saved`, `GET /api/me/liked`, `POST /api/me/history`. New imports: `handleGetHistory`, `handleGetLikedPosts`, `handleGetSavedPosts`, `handleReportPost`, `handleTogglePostSave` |
| `src/server/feed-service.js` | `handlePostDetail` fetches user-scoped topic detail for accurate `bookmarked` field. New imports: `ensureNodebbUid`, `withNodebbUid` |

### Frontend

| File | Changes |
|---|---|
| `public/app-feed.js` | Detail page action bar (收藏/点赞/举报), `togglePostSave()`, `handleReportPost()` with category selector |
| `public/app-messages-profile.js` | Profile tabs (浏览记录/收藏/赞过), `loadProfileTab()`, `profileListItem()`, `_profileBound` dedup flag |
| `public/app.js` | Event delegation for `[data-save-tid]` and `[data-report-tid]` |
| `public/styles.css` | `.detail-actions`, `.detail-action-btn`, `.profile-tabs`, `.profile-tab`, `.profile-list`, `.profile-list-item` |

## API Contract

```
POST /api/posts/:tid/save       { saved?: boolean }  → { ok, tid, pid, saved }
POST /api/posts/:tid/report     { reason, category }  → { ok, tid, pid }
POST /api/posts/:tid/like       { liked?: boolean }   → { ok, tid, pid, liked, likeCount }
GET  /api/me/saved                                → { items: [{ tid, title, cover, timestampISO, visibility, author }] }
GET  /api/me/liked                                → { items: [...] }
POST /api/me/history            { tids: number[] }   → { items: [...] }
GET  /api/posts/:tid                               → { ..., bookmarked: boolean }
```

## Audience Enforcement

All 3 action endpoints (save, report, like) load `post-metadata.json`, extract `visibility`/`audience`, and run `canViewPost(auth.user, ...)` before calling NodeBB. Returns 403 if access denied.

Profile list endpoints filter results through `canViewPost` before returning.

## Review Fixes Applied

1. Like endpoint now has audience check
2. Detail `bookmarked` field is user-scoped (fetches with `ensureNodebbUid`)
3. Profile thumbnails use `proxiedPostImageUrl` (was broken NodeBB files URL)
4. History uses user's `nodebbUid` (was using `config.nodebbUid`)
5. Profile event listeners bound once via `_profileBound` flag

## Pending

- **Smoke test** `GET /api/user/:slug/bookmarks` and `GET /api/user/:slug/upvoted` against live NodeBB. Confirm response shape is `{ topics: [...] }`.
- **Verify** Chinese labels render correctly in browser (no mojibake).
- **Location jump** on detail page (not implemented in this cut).
- **Report moderation workflow** — reports currently go to NodeBB admin only. LIAN operator UI is a future task.

## Validation

```bash
node --check src/server/post-service.js
node --check src/server/api-router.js
node --check src/server/feed-service.js
node --check public/app-feed.js
node --check public/app.js
node --check public/app-messages-profile.js
```

Manual:
1. Open detail → verify 收藏/点赞/举报 buttons
2. Click 收藏 → toggle → check profile 收藏 tab
3. Click 举报 → select reason → confirm API call
4. Profile → 浏览记录/收藏/赞过 tabs load correctly
5. Verify audience-denied posts return 403 on save/report/like

## Rollback

- Remove `detail-actions` HTML from `app-feed.js` `openDetail()`
- Remove `profile-tabs` HTML from `app-messages-profile.js` `loadProfile()`
- Remove 6 route blocks from `api-router.js`
- Remove new functions from `post-service.js`
- Remove new CSS classes from `styles.css`
