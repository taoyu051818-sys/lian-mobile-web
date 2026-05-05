# Task: map-v2-restore-legacy-geo

## Goal

Restore the original real-world coordinate anchors from the old v1 illustrated map calibration and use them as trusted Map v2 seed data.

## Why

The v1 map did not start from arbitrary image points. It used a small set of real `lat/lng` coordinates and projected them onto illustrated map `x/y` points through `geoImagePairs`.

Map v2 now uses Gaode/GIS coordinates as the primary map surface, so these original `lat/lng` values should be brought back into `data/locations.json` instead of relying on approximate placeholder coordinates.

## Source Of Truth

Current source file:

- `public/app-state.js`

Current source constant:

- `geoImagePairs`

The corresponding old illustrated places are in:

- `campusPlaces`

## Original Coordinate Anchors

Use these as the first trusted seed set:

| placeName | lat | lng | legacyPoint.x | legacyPoint.y |
|---|---:|---:|---:|---:|
| 中国传媒大学 | 18.399433 | 110.013919 | 573 | 567 |
| 公共教学楼 | 18.400032 | 110.016989 | 744 | 491 |
| 公共实验楼 | 18.401458 | 110.018094 | 843 | 431 |
| 图书馆 | 18.403036 | 110.014774 | 629 | 325 |
| 生活一区 | 18.395955 | 110.016671 | 761 | 716 |
| 生活二区 | 18.397625 | 110.018474 | 869 | 620 |
| 创新创业中心 | 18.395424 | 110.012750 | 521 | 770 |
| 北京邮电大学 | 18.395598 | 110.009517 | 330 | 724 |
| 电子科技大学 | 18.394325 | 110.007274 | 203 | 819 |

## Product scope

After this task, Map v2 can render these old calibrated locations at their original real coordinates on the Gaode base map while still preserving the old illustrated `legacyPoint` for compatibility.

## Allowed files

- `data/locations.json`
- `scripts/validate-locations.js`
- `docs/agent/tasks/map-v2-restore-legacy-geo.md`
- `docs/agent/handoffs/map-v2-restore-legacy-geo.md`

Optional, only if a one-time migration helper is useful:

- `scripts/restore-legacy-geo-locations.js`

## Forbidden files

- `src/server/feed-service.js`
- `src/server/post-service.js`
- `src/server/ai-light-publish.js`
- `public/app-ai-publish.js`
- `public/map-v2.js`
- `public/tools/map-v2-editor.js`
- `data/feed-rules.json`
- `data/post-metadata.json`

## Data schema changes

No schema change.

Update or add `data/locations.json` entries using the current shape:

```json
{
  "id": "stable-location-id",
  "name": "中国传媒大学",
  "type": "school",
  "aliases": [],
  "lat": 18.399433,
  "lng": 110.013919,
  "coordSystem": "gcj02",
  "legacyPoint": { "x": 573, "y": 567 },
  "status": "active"
}
```

Do not remove `legacyPoint`. It is still useful for old map compatibility and for debugging the old projection.

## ID guidance

Suggested stable IDs:

- `cuc-hainan`
- `public-teaching-building`
- `public-lab-building`
- `library`
- `life-zone-1`
- `life-zone-2`
- `innovation-center`
- `bupt-hainan`
- `uestc-hainan`

If an existing location entry already represents the same place, update that entry rather than creating a duplicate.

## API changes

None.

The existing endpoint should expose updated data:

- `GET /api/map/v2/items`

## Acceptance criteria

- [ ] `data/locations.json` contains the 9 restored coordinate anchors.
- [ ] Each restored location keeps `lat`, `lng`, `coordSystem: "gcj02"`, and `legacyPoint`.
- [ ] No duplicate location entries for the same place.
- [ ] `GET /api/map/v2/items` returns the restored locations.
- [ ] The Map v2 user map shows the restored points in plausible positions.
- [ ] Feed, AI publish, and NodeBB publish code are unchanged.

## Validation commands

```bash
node --check scripts/validate-locations.js
node scripts/validate-locations.js
node --check public/map-v2.js
node --check server.js
```

Manual:

1. Start the server.
2. Open `http://localhost:4100/`.
3. Switch to the map tab.
4. Verify the 9 restored locations render on the Gaode base map.
5. Open `http://localhost:4100/tools/map-v2-editor.html`.
6. Verify the same locations appear in editor data.

## Risks

- The old coordinates may be GCJ-02 or device-reported coordinates near GCJ-02; keep `coordSystem: "gcj02"` for current Map v2 consistency.
- Some current `locations.json` entries are placeholders and may conflict with the restored points.
- Chinese text in current data may still show mojibake if not repaired in the same controlled task.

## Rollback plan

- Revert only the `data/locations.json` changes.
- Do not alter feed, publish, or map rendering code for rollback.

