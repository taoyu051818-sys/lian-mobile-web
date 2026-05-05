# Map v2 Bounds Validation

Date: 2026-05-02

## Thread Scope

Tightened server-side map bounds to match approved product bounds. Verified all existing data is within bounds.

## Changes

### `src/server/map-v2-service.js`

Updated `MAP_V2_BOUNDS` from wider development bounds to approved product bounds:

| | Before | After (approved) |
|---|---|---|
| south | 18.3700734 | 18.373050 |
| west | 109.9940365 | 109.995380 |
| north | 18.4149043 | 18.413856 |
| east | 110.0503482 | 110.036262 |

No other code changes — `assertPointInBounds()` already validates all admin save geometry against `MAP_V2_BOUNDS`.

## Data Verification

- `data/locations.json`: 17 items, all within approved bounds
- `data/map-v2-layers.json`: all areas, routes, building polygons, entrances, environment elements, and assets within approved bounds
- No data corrections needed

## Files Changed

| File | Change |
|---|---|
| `src/server/map-v2-service.js` | Tightened MAP_V2_BOUNDS constants |

## Validation

```
node --check src/server/map-v2-service.js     ✓
node scripts/smoke-frontend.js                21/21 pass
node scripts/test-routes.js                   61/61 pass
```

## Existing Bounds Enforcement

The admin save handler (`PUT /api/admin/map-v2`) already validates:
- Map center
- All location coordinates
- All area polygon points
- All route points
- All building polygon points
- All building entrance points
- All environment element points
- All road points
- All junction positions
- All asset positions

Any out-of-bounds geometry is rejected with 400 error.

## Picker Contract

The `/api/map/v2/items` response includes `bounds` (the approved bounds). The frontend picker should:
1. Use `bounds` from the API response to constrain the pickable area
2. Confirm action: output `{ lat, lng, source: "map_v2", mapVersion: "gaode_v2", locationId, locationArea, displayName }`
3. Skip action: output `{ skipped: true, source: "skipped" }`
4. Prevent confirming points outside `bounds`

Frontend picker implementation is deferred to the Publish V2 page task.

## Next Steps

- Lane I (Map v2 editor) can proceed when picker contract is stable
- Publish V2 page can integrate the picker
