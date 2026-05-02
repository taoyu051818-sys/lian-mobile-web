# Handoff: nodebb-like-feed-card

Date: 2026-05-02

## Summary

The first NodeBB native like cut was started before the current thread was clarified as architect/docs-only.

The intended behavior is:

- homepage feed card lower-right metadata area shows heart + count;
- old time label is removed from feed cards;
- empty heart `♡` means not liked;
- filled red heart `♥` means liked;
- count is visible;
- clicking heart does not open detail;
- feed ranking is unchanged.

## Runtime Files Touched

- `src/server/feed-service.js`
- `src/server/post-service.js`
- `src/server/api-router.js`
- `public/app-feed.js`
- `public/app.js`
- `public/styles.css`

## Docs Touched

- `docs/agent/domains/NODEBB_INTEGRATION.md`
- `docs/agent/tasks/nodebb-like-feed-card-validation.md`

## Validation Run

Used bundled Node because the system `node.exe` path returned Access denied.

Passed:

- `node --check server.js`
- `node --check src/server/feed-service.js`
- `node --check src/server/post-service.js`
- `node --check src/server/api-router.js`
- `node --check public/app-feed.js`
- `node --check public/app.js`
- `node scripts/validate-post-metadata.js`

`validate-post-metadata.js` returned `ok: true` with existing warnings only.

## Follow-Up Required

A dedicated implementation thread should validate the NodeBB vote endpoint against the actual NodeBB instance:

- `PUT /api/v3/posts/:pid/vote`
- `DELETE /api/v3/posts/:pid/vote`
- fallback `PUT/DELETE /api/v3/posts/:pid/votes`

If the installed NodeBB endpoint differs, adjust only the narrow like helper.

## Risks

- NodeBB may not expose the guessed vote endpoint shape in this installed version.
- Topic detail may not reliably expose viewer-specific liked state.
- Frontend currently uses optimistic local state and must reconcile with server response.
- Like count must not affect feed ranking in this cut.

## Rollback

Use `docs/agent/tasks/nodebb-like-feed-card-validation.md` rollback section.

Do not roll back unrelated docs organization changes.
