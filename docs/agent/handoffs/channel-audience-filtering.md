# Channel Audience Filtering

Date: 2026-05-02

## Thread Scope

Added audience filtering to `GET /api/channel` so channel timeline respects the same visibility model as feed, detail, and map.

## Changes

### `src/server/channel-service.js`

- `handleChannel` signature changed: `(reqUrl, res)` → `(reqUrl, req, res)`
- Added viewer resolution via `getCurrentUser(req)` — guest allowed (no login required)
- Added `canViewPost(viewer, postMeta, "map")` check before including topic posts in channel events
- Imported `canViewPost` from `audience-service.js` and `getCurrentUser` from `auth-service.js`
- Topics without metadata pass through (no metadata = no audience restriction)
- Topics with metadata are filtered: public visible to all, campus to logged-in, school to matching school, private to owners/members, linkOnly excluded from channel (distribution surface)

### `src/server/api-router.js`

- Updated `handleChannel` call to pass `req` as second argument

### `docs/agent/domains/NODEBB_INTEGRATION.md`

- Updated auth behavior table with smoke test findings (Bearer vs x-api-token)

## Files Changed

| File | Change |
|---|---|
| `src/server/channel-service.js` | Added audience filtering, viewer resolution, new imports |
| `src/server/api-router.js` | Pass `req` to `handleChannel` |
| `docs/agent/domains/NODEBB_INTEGRATION.md` | Auth behavior corrections |

## Validation

```
node --check src/server/channel-service.js       ✓
node --check src/server/api-router.js             ✓
node --check src/server/audience-service.js       ✓
node scripts/smoke-frontend.js                    21/21 pass
node scripts/test-routes.js                       61/61 pass
node scripts/test-audience-hydration.js           61/61 pass
```

## Decisions

1. **Channel uses "map" surface**: linkOnly content is excluded from channel distribution, same as feed and map. This matches the distribution restriction semantics.

2. **Guest allowed**: Channel doesn't require login. Guest sees only public content. Logged-in users see campus + matching school + their org content.

3. **Missing metadata passes through**: If a topic has no entry in `post-metadata.json`, it's not restricted. This is safe because metadata is the source of audience restrictions — no metadata = legacy public post.

4. **Signature change**: `handleChannel` now takes `(reqUrl, req, res)` instead of `(reqUrl, res)`. The route matcher doesn't track function signatures, so no test changes needed.

## Risks

- Channel may appear empty for users with narrow audience (e.g., external guest). This is correct behavior — they should only see public content.
- Performance: `loadMetadata()` is called per request, but it's cached (15s TTL) so the impact is minimal.

## Next Steps

- Lane F (Messages) can proceed — notifications need Bearer auth and audience filtering
- Lane H (Map picker) can proceed
