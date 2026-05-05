# Handoff: Admin Editor V1 (Implementation + Design Revision)

Date: 2026-05-02

## What Was Done

Implemented the initial Admin Editor expansion based on the original task doc. All 9 phases completed:

### Backend (`src/server/map-v2-service.js`)

- Added `normalizeEntrance`, `normalizeBuilding`, `normalizeEnvironmentElement`, `normalizeBuildingGroup`
- Extended `loadMapV2Data()` to load buildings, environmentElements, buildingGroups from layers file
- Extended PUT handler with bounds validation for new collections
- Extended public API `handleMapV2Items` to include new collections

### Editor (`public/tools/map-v2-editor.js`, `.html`, `.css`)

- Merged mode system: 选择/浏览/点/多边形/路线/截取 with sub-type selectors
- Building polygon rendering (purple styled)
- Environment element rendering (styled by type)
- Entrance point markers (orange)
- Property panels per type (location/building/environment/area/route)
- Property panel → JSON sync with debounce
- Vertex editing on selected polygons
- Building group CRUD (add/delete/list)
- Export render spec JSON download
- Layer toggles for buildings, environment

### Validation (`scripts/validate-locations.js`)

- Building validation: required fields, polygon >= 3 points, bounds
- Environment validation: required fields, bounds
- Building group validation: referenced buildingIds exist
- Cross-collection duplicate ID checking

## Design Revision (from product review)

The initial implementation assumed manual polygon drawing for buildings and environment. The product direction changed:

1. **Buildings and environment** — externally generated assets, placed in editor, not hand-drawn
2. **Road network** — game-engine-style click-drag drawing (the core new feature)
3. **Building groups** — navigation hierarchy (click group → see buildings → click building → floor plan)
4. **Editor focus** shifts from "draw everything" to "place assets + draw roads + configure properties"

## Additional Product Clarification

Road drawing must handle campus-road semantics, not only visual strokes.

Implementation guidance:

- store roads as editable `points[]` first;
- add road types for `main_road`, `pedestrian_path`, `shuttle_route`, and `service_path`;
- infer cross intersections automatically from line geometry and store them as `junctions[]`; users should only clean up false positives;
- infer bends automatically from angle changes and store curve/render hints; users should not tag normal bends manually;
- keep imported road/building/environment graphics as assets bound to structured map objects, not as the only source of truth;
- clicking an imported asset should delegate to its bound object when one exists.

The next implementation should not only draw a Leaflet polyline. It should establish the `roads[]` data shape so intersections, curves, external render specs, and later route behavior can build on it.

## What Changed In The Task Doc

`docs/agent/tasks/map-v2-admin-editor.md` was rewritten with:

- Revised editor modes: 浏览/选择/路网/放置/截取
- Road network drawing as priority feature
- Asset placement instead of manual polygon drawing
- Building group hierarchy with zoom-to-buildings behavior
- Export/import render workflow

## Files Changed

| File | Lines Added/Modified | Purpose |
|------|---------------------|---------|
| `src/server/map-v2-service.js` | ~80 lines added | New normalizers, extended load/save/API |
| `public/tools/map-v2-editor.html` | ~60 lines added | New mode buttons, property panels, building groups, export |
| `public/tools/map-v2-editor.js` | ~250 lines added/modified | Mode system, rendering, property sync, vertex edit, groups, export |
| `public/tools/map-v2-editor.css` | ~50 lines added | Sub-selectors, prop sections, colors, groups |
| `scripts/validate-locations.js` | ~100 lines added | Building/env/group validation, cross-collection checks |
| `docs/agent/tasks/map-v2-admin-editor.md` | Rewritten | Revised design direction |

## Known Gaps

1. Road network drawing engine (game-engine style) — not yet implemented
2. Asset placement mode (upload + click to place) — not yet implemented
3. Building group zoom-to-buildings behavior — not yet implemented
4. The current polygon drawing modes (point/polygon) work but don't match the revised design direction
5. Property panel input → JSON sync works but has no undo

## Verification

```bash
node --check src/server/map-v2-service.js
node --check public/tools/map-v2-editor.js
node --check scripts/validate-locations.js
node scripts/validate-locations.js
```

## Next Steps

Per revised task doc, implementation order:

1. **Phase 1: Road Network Drawing Engine** — the core new feature
   - Phase 1A: click-drag road drawing, road type, save/reload/export, bounds validation
   - Phase 1B: vertex editing, delete, automatic snapping, automatic junction generation, segment splitting
   - Phase 1C: automatic curve classification, route semantics, render hints
2. **Phase 2: Asset Placement Mode** — replace manual polygon drawing with imported graphics bound to structured objects
3. **Phase 3: Building Group Hierarchy** — navigation from group to buildings
4. **Phase 4: Property Panel + Vertex Editing** — refine existing
5. **Phase 5: Export/Import** — render spec + image upload
