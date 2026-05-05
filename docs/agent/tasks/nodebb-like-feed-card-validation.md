# Task: NodeBB Like Feed Card Validation

## Goal

Validate and finish the first NodeBB like integration on homepage feed cards.

The user-facing behavior is already defined:

- feed card right side no longer shows time;
- it shows a heart and like count;
- unliked state uses an empty heart `♡`;
- liked state uses a filled red heart `♥`;
- the count is visible next to the heart;
- clicking the heart must not open the post detail page.

## Current Implementation State

Runtime code was started in the architect thread before the role was clarified as docs-only.

Expected touched runtime files:

- `src/server/feed-service.js`
- `src/server/post-service.js`
- `src/server/api-router.js`
- `public/app-feed.js`
- `public/app.js`
- `public/styles.css`
- `docs/agent/domains/NODEBB_INTEGRATION.md`

The implementation should be reviewed, validated, and either completed or reverted in a dedicated implementation thread.

## Product Boundaries

- Do not change feed ranking.
- Do not add likes to detail page in the same thread unless explicitly approved.
- Do not introduce LIAN-side like storage as source of truth.
- NodeBB remains source of truth for vote/upvote count.
- If frontend uses local optimistic state, it must reconcile with server response.

## Backend Requirements

Expected LIAN endpoint:

```text
POST /api/posts/:tid/like
```

Expected behavior:

- require login;
- resolve current user's NodeBB uid;
- fetch topic detail as current NodeBB user;
- find topic first post `pid`;
- call NodeBB native vote/upvote endpoint for that `pid`;
- return normalized `{ ok, tid, pid, liked, likeCount }`;
- clear feed/topic caches after successful mutation;
- do not write `post-metadata.json`.

Endpoint candidates to verify against installed NodeBB:

```text
PUT    /api/v3/posts/:pid/vote
DELETE /api/v3/posts/:pid/vote
PUT    /api/v3/posts/:pid/votes
DELETE /api/v3/posts/:pid/votes
```

Do not rely on guessed endpoint names if the local NodeBB instance differs.

## Frontend Requirements

- Card action is visually in the lower-right metadata area.
- Empty heart `♡` before like.
- Filled red heart `♥` after like.
- Like count is always shown.
- Optimistic update may be used, but failure must restore previous state.
- Heart click must stop propagation so the card does not open detail.

## Validation

Run:

```bash
node --check server.js
node --check src/server/feed-service.js
node --check src/server/post-service.js
node --check src/server/api-router.js
node --check public/app-feed.js
node --check public/app.js
node scripts/validate-post-metadata.js
```

Manual browser validation:

1. Open homepage.
2. Confirm feed card right side shows heart + count instead of time.
3. Click empty heart.
4. Confirm it becomes filled red heart and count increments.
5. Refresh feed.
6. Confirm count persists from NodeBB.
7. Click filled red heart.
8. Confirm it becomes empty heart and count decrements.
9. Confirm clicking elsewhere on card opens detail.
10. Confirm clicking heart does not open detail.

## Rollback

- Remove `/api/posts/:tid/like` route.
- Remove like helper from `post-service.js`.
- Remove like fields from feed normalization if they cause problems.
- Restore card right-side time label in `public/app-feed.js`.
- Remove `.card-like*` CSS.

Do not touch feed ranking rollback unless a later task changes ranking.
