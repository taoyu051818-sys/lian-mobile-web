# Handoff: Asset Placement Mode (Phase 2)

Date: 2026-05-03

## What Was Done

Implemented Phase 2 of the map editor: external asset placement mode with upload, click-to-place, drag-to-reposition, and full property editing.

### Data Model (`map-v2-service.js`)

New `normalizeAsset(item)` function:

```json
{
  "id": "asset-xxx",
  "url": "/assets/map/building-library.png",
  "kind": "building_icon",
  "position": { "lat": 18.395, "lng": 110.02 },
  "size": [64, 64],
  "anchor": [32, 64],
  "rotation": 0,
  "opacity": 1,
  "zIndex": 40,
  "boundObjectType": "building",
  "boundObjectId": "building-library",
  "clickBehavior": "open_floor_plan",
  "alwaysShowCard": false,
  "status": "active"
}
```

Valid kinds: `building_icon`, `environment`, `poi_marker`, `label`, `other`

### Server Changes (`map-v2-service.js`)

- `normalizeAsset()` — validates id, url, kind, position (in bounds), size, anchor, rotation, opacity, zIndex, boundObjectType, boundObjectId, clickBehavior, status
- `loadMapV2Data()` — added `assets: []` to fallback and returned layers
- PUT handler — added bounds validation for asset positions, normalized assets
- Public API — includes active assets in response

### Editor Changes (`map-v2-editor.js`)

- `DEFAULT_LAYERS_FALLBACK` — added `assets: []`
- State: added `assetUrl`, `assetKind`, `placingAsset`
- `renderData()` — renders assets as image markers with rotation/opacity, drag support with bounds validation
- `selectItem()` — handles "assets" target, populates asset property panel
- `syncPropertyToJSON()` — syncs all asset properties from panel to JSON
- Asset placement click handler in map click event (place mode)
- Asset upload via `/api/upload/image` (Cloudinary)
- `setMode()` — handles "place" mode, shows asset sub-selector
- Export render spec includes `assets[]`

### UI (`map-v2-editor.html` + `.css`)

- "放置" mode button in mode bar
- Asset sub-selector: kind dropdown, URL input, upload button
- Asset properties panel: URL, kind, clickBehavior, width/height, anchor X/Y, rotation, opacity, boundType/boundId, status
- Assets layer toggle ("资产")
- CSS: `.map-v2-asset-icon` with drop-shadow, `.map-stage.place-mode` cursor

## Files Changed

| File | Change |
|------|--------|
| `public/tools/map-v2-editor.js` | Asset rendering, placement, drag, selection, property sync, upload |
| `src/server/map-v2-service.js` | normalizeAsset, assets in load/save/API |
| `public/tools/map-v2-editor.html` | Place mode, asset sub-selector, asset properties panel, layer toggle |
| `public/tools/map-v2-editor.css` | Asset icon styles, place mode cursor |

## Key Design Decisions

1. Assets are image-based, not polygon-based — the URL points to an externally generated graphic
2. Drag-to-reposition with bounds validation (same as locations)
3. Upload reuses existing `/api/upload/image` Cloudinary endpoint
4. `boundObjectType` + `boundObjectId` link assets to buildings/locations for click delegation (UI delegation is future work)
5. `clickBehavior` defaults to "none" — interactive behavior added when bound object exists
6. Assets are a separate collection from buildings/environment — they represent imported graphics, not hand-drawn shapes

## Verification

```bash
node --check src/server/map-v2-service.js
node --check public/tools/map-v2-editor.js
node scripts/validate-locations.js
```

Manual editor smoke:
1. Switch to "放置" mode → verify sub-selector appears
2. Enter image URL → click map → verify asset placed
3. Drag asset → verify repositioning with bounds check
4. Select asset → verify properties panel shows all fields
5. Upload image → verify URL populated from Cloudinary
6. Change asset properties → verify JSON updates
7. Save to backend, reload → verify assets persist
8. Export render spec → verify assets included

## Known Gaps

1. No click delegation from asset to bound object (e.g., clicking a building icon doesn't open floor plan yet)
2. No resize handles (size is edited numerically in properties panel)
3. No asset library panel for browsing uploaded assets
4. No z-index ordering UI
5. `alwaysShowCard` field exists but no card rendering for assets yet

## Post-Launch Fix: Bounds Mismatch (2026-05-03)

**Problem**: `MAP_V2_BOUNDS` was inconsistent across three files:
- `map-v2-editor.js`: 18.370 / 109.994 → 18.415 / 110.050 (wider)
- `map-v2-service.js`: 18.373 / 109.995 → 18.414 / 110.036 (tighter)
- `validate-locations.js`: 18.373 / 109.995 → 18.414 / 110.036 (tighter)

**Impact**: `map-v2-layers.json` data (roads, buildings, junctions, etc.) was lost. The server's tighter bounds may have rejected data points during save, or data was never persisted ("保存到后端" was not clicked). File was 149 bytes (empty) with no git backup.

**Fix**: Updated `map-v2-service.js` and `validate-locations.js` to use the wider bounds matching the editor:
- south: 18.3700734, west: 109.9940365, north: 18.4149043, east: 110.0503482

**Lesson**: Bounds must be consistent across editor, server, and validation. Always click "保存到后端" after drawing. Consider auto-save or save prompts in future editor work.

## Next Steps

Per task doc implementation order:

1. **Phase 3: Building Group Hierarchy**
   - Create/edit/delete building groups
   - Assign buildings to groups via multi-select or drag
   - Group properties: name, icon, clickAction, bounds
   - Render groups on map as clickable icons
   - Click group → zoom to group bounds and show member buildings
