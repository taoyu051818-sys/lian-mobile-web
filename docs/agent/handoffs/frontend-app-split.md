---
task: frontend-app-split
status: completed
date: 2026-05-02
---

# Handoff: Frontend App Split

## Summary

- `public/app.js` was mechanically split into feature-scoped classic script files.
- No build tool, bundler, or ES module system was introduced.
- `public/index.html` now loads the split files in dependency order.
- The goal was conflict reduction, not behavior change.

## Files changed

- `public/index.html`: loads the split frontend scripts before `public/app.js`.
- `public/app-state.js`: global state, state aliases, legacy static map data.
- `public/app-utils.js`: DOM helpers, API helper, image upload/compression helpers, publish progress helpers.
- `public/app-auth-avatar.js`: auth UI helpers and avatar crop flow.
- `public/app-feed.js`: feed list, masonry, detail view, gallery/lightbox.
- `public/app-legacy-map.js`: legacy illustrated map compatibility and route animation.
- `public/app-ai-publish.js`: AI publish flow, location draft handling, Map v2 picker integration.
- `public/app-messages-profile.js`: messages, replies, auth submit, profile, regular publish.
- `public/app.js`: event binding, scroll/pull handlers, app initialization.

## API changed

None.

## Data changed

None.

## Validation

Run:

```bash
node --check public/app-state.js
node --check public/app-utils.js
node --check public/app-auth-avatar.js
node --check public/app-feed.js
node --check public/app-legacy-map.js
node --check public/app-ai-publish.js
node --check public/app-messages-profile.js
node --check public/app.js
node --check public/map-v2.js
node --check server.js
node scripts/validate-post-metadata.js
```

Manual HTTP checks:

- `/` returns 200 and includes all split script tags.
- `/api/feed?limit=1` returns feed items.
- `/api/map/v2/items` returns `mapVersion=gaode_v2`.

## Known risks

- Classic scripts depend on load order. Do not reorder without testing.
- Functions are still global. This is intentional for a low-risk first split.
- Future work should add a smoke test before deeper refactors.

## Next suggested task

- `frontend-stability-smoke`

