---
task: map-v2-restore-legacy-geo
status: done
date: 2026-05-02
files_changed:
  - data/locations.json
  - scripts/validate-locations.js
---

# Handoff: Restore Legacy Geo Anchors To Map v2

## What was done

Restored 9 real-world coordinate anchors from `public/app-state.js` `geoImagePairs` into `data/locations.json` for Map v2.

### Updated locations.json

- 5 original entries preserved: `li-an-campus-core`, `dadun-village`, `shuttle-stop-main`, `canteen`, `sports-field`
- `library` updated with real coordinates from geoImagePairs[3]
- 8 new entries added:
  - `cuc-hainan` (中国传媒大学)
  - `public-teaching-building` (公共教学楼)
  - `public-lab-building` (公共实验楼)
  - `life-zone-1` (生活一区)
  - `life-zone-2` (生活二区)
  - `innovation-center` (创新创业中心)
  - `bupt-hainan` (北京邮电大学)
  - `uestc-hainan` (电子科技大学)
- All entries have `coordSystem: "gcj02"` and `legacyPoint` preserved
- Total: 14 locations

### Created validate-locations.js

`scripts/validate-locations.js` validates:
- Required fields: id, name, lat, lng
- Coordinates within Map v2 bounds (SW 18.373050/109.995380, NE 18.413856/110.036262)
- No duplicate IDs or coordinates
- Type, aliases, coordSystem, legacyPoint structure
- Status field values

## How to verify

```bash
node --check scripts/validate-locations.js
node scripts/validate-locations.js
curl -s http://localhost:4100/api/map/v2/items | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.locations.forEach(l => console.log(l.id, l.name, l.lat, l.lng))"
```

## API verification

`GET /api/map/v2/items` returns all 14 locations with correct lat/lng and legacyPoint.

## Known limits

- No duplicate entries found
- All coordinates within bounds
- Feed, AI publish, and NodeBB publish code unchanged

## Rollback

Revert only `data/locations.json` and `scripts/validate-locations.js`.
