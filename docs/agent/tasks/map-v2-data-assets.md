# Task: map-v2-data-assets

## Goal

Make Map v2 useful as a campus data surface by improving data, assets, validation, and editor ergonomics without changing feed ranking or publishing semantics.

## Product scope

After this task, operators can add and preview campus areas, routes, location icons, and always-visible cards with confidence that coordinates stay inside the trial-zone bounds.

## Allowed files

- `public/map-v2.js`
- `public/tools/map-v2-editor.html`
- `public/tools/map-v2-editor.css`
- `public/tools/map-v2-editor.js`
- `public/assets/*`
- `src/server/map-v2-service.js`
- `data/locations.json`
- `data/map-v2-layers.json`
- `scripts/validate-locations.js`
- `docs/agent/tasks/map-v2-data-assets.md`
- `docs/agent/handoffs/map-v2-data-assets.md`

## Forbidden files

- `src/server/feed-service.js`
- `data/feed-rules.json`
- `src/server/post-service.js`
- `src/server/ai-light-publish.js`
- `public/app-ai-publish.js`

## Data schema changes

Allowed additive fields only:

- location icon preview fields, if needed;
- card preview fields, if needed;
- route/area editor metadata, if needed.

Do not remove or rename existing `locationId`, `locationArea`, `lat`, `lng`, `mapVersion`, `legacyPoint`, or `imagePoint` fields.

## API changes

Prefer none.

If backend validation requires changes, keep them under the existing Map v2 admin API:

- `GET /api/map/v2/items`
- `GET /api/admin/map-v2`
- `PUT /api/admin/map-v2`

## Acceptance criteria

- [ ] `scripts/validate-locations.js` exists and validates current `locations.json` and `map-v2-layers.json`.
- [ ] Editor can preview provided art/icon assets on the map.
- [ ] Editor prevents saving points outside SW `18.373050/109.995380` and NE `18.413856/110.036262`.
- [ ] Existing user map still renders Gaode tiles plus LIAN overlays.
- [ ] No feed or publish behavior changes.

## Validation commands

```bash
node --check public/map-v2.js
node --check public/tools/map-v2-editor.js
node --check src/server/map-v2-service.js
node --check scripts/validate-locations.js
node scripts/validate-locations.js
```

Manual:

1. Open `http://localhost:4100/` and switch to map.
2. Open `http://localhost:4100/tools/map-v2-editor.html`.
3. Add a draft location, area, and route inside bounds.
4. Try to save an out-of-bounds point and confirm it is rejected.

## Risks

- Misaligned art assets can make precise location picking misleading.
- Admin editor still uses lightweight token auth only.
- Large assets can slow mobile map rendering.

## Rollback plan

- Revert the task commit.
- Restore `data/locations.json` and `data/map-v2-layers.json` from the previous commit.
- Remove newly added assets if they are not referenced.

