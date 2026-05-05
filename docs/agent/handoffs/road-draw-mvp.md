# Handoff: Road Draw MVP (Phase 1A)

Date: 2026-05-02

## What Was Done

Implemented Phase 1A of the road network drawing engine — game-engine-style click-drag road drawing with road types, properties panel, save/reload/export, bounds validation, and point simplification.

### Backend (`src/server/map-v2-service.js`)

- Added `normalizeRoad(item)` with road type validation, default styles per type, and renderHint normalization
- Added `ROAD_TYPE_STYLES` constant for 4 road types: main_road, pedestrian_path, shuttle_route, service_path
- Extended `loadMapV2Data()` to load `roads[]` from layers file
- Extended PUT handler with bounds validation for road points
- Extended public API `handleMapV2Items` to include roads (filtered by active status)

### Editor (`public/tools/map-v2-editor.js`)

- Added road drawing engine: mousedown starts recording, mousemove appends points with preview line, mouseup finishes
- Point simplification via Douglas-Peucker algorithm (tolerance ~2m in lat/lng degrees)
- Road preview line follows cursor during draw with road-type-specific styling
- Map dragging disabled during road draw, re-enabled on mouseup
- Road rendering in `renderData()` with per-type styles
- Road draft preview in `renderDraft()`
- Road mode in `buildDraftItem()` → writes to `roads[]` collection
- Road selection in `selectItem()` → shows road property panel with vertex markers
- Road property sync in `syncPropertyToJSON()`
- Road type change handler: updating road type in sub-selector or property panel auto-fills default style
- Export render spec includes roads

### Editor UI (`public/tools/map-v2-editor.html`)

- Added "路网" mode button to mode bar
- Added road type sub-selector dropdown (主路/人行道/班车路线/服务通道)
- Added road property panel with: type, width, color, dash, surface, curveStyle, status, point count
- Added "路网" layer toggle

### CSS (`public/tools/map-v2-editor.css`)

- Added `--road-color` CSS variable
- Added `.road-draw-mode` cursor style (crosshair)
- Added `.readonly-field` style for read-only display fields

### Validation (`scripts/validate-locations.js`)

- Added `validateRoad()` function: validates id, name, type, points array with bounds
- Added `VALID_ROAD_TYPES` set
- Integrated road validation into main function
- Added roads to cross-collection duplicate ID checking

## Road Data Schema

```json
{
  "id": "road-main-east",
  "name": "东区主路",
  "type": "main_road",
  "points": [{"lat": 18.395, "lng": 110.020}, ...],
  "segments": [],
  "junctionIds": [],
  "style": {
    "color": "#6b7280",
    "weight": 6,
    "dashArray": ""
  },
  "renderHint": {
    "surface": "asphalt",
    "curveStyle": "smooth",
    "edgeStyle": ""
  },
  "interactive": true,
  "status": "active",
  "source": "admin_drawn",
  "updatedAt": ""
}
```

## Road Type Default Styles

| Type | Color | Weight | Dash |
|------|-------|--------|------|
| main_road | #6b7280 | 6 | — |
| pedestrian_path | #9ca3af | 3 | 6 4 |
| shuttle_route | #2563eb | 4 | — |
| service_path | #a3a3a3 | 2 | 4 6 |

## Files Changed

| File | Change |
|------|--------|
| `src/server/map-v2-service.js` | Added normalizeRoad, extended load/save/API for roads[] |
| `public/tools/map-v2-editor.html` | Road mode button, sub-selector, property panel, layer toggle |
| `public/tools/map-v2-editor.js` | Road drawing engine, simplification, rendering, property sync |
| `public/tools/map-v2-editor.css` | Road cursor, readonly field style |
| `scripts/validate-locations.js` | Road validation |

## Verification

```bash
node --check src/server/map-v2-service.js
node --check public/tools/map-v2-editor.js
node --check scripts/validate-locations.js
node scripts/validate-locations.js
```

## Known Gaps

1. No automatic snapping (Phase 1B)
2. No automatic junction detection (Phase 1B)
3. No road splitting at junctions (Phase 1B)
4. No curve classification (Phase 1C)
5. No undo for road drawing

## Next Steps

Per task doc implementation order:

1. **Phase 1B: Road Editing And Junctions**
   - Select existing road → show vertices → drag to adjust
   - Delete road
   - Automatically detect near-endpoint snapping
   - Automatically detect road crossings
   - Automatically create/update junctions[]
   - Automatically split roads into segments[] at generated junctions
   - Allow manual cleanup for false positives

2. **Phase 1C: Curves And Route Semantics**
   - Automatic curve smoothing preview
   - Auto-fill curveType/renderHint.curveStyle from bend geometry
   - Shuttle routes reference existing road segments
   - Export roads, junctions, and route hints to render spec
