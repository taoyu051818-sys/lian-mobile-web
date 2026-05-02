# Task: Map v2 Admin Editor (Revised)

Date: 2026-05-02

## Goal

Build the management-facing map editor into a campus spatial asset editor. The editor is for administrators/operators, not normal student users.

Core principle: **the editor places and configures assets, not illustrates them.** Buildings and environment elements are generated externally (by AI renderers or design tools) and imported/placed in the editor. The editor's unique job is road network drawing, asset placement, property editing, and building group hierarchy management.

## Design Direction (from product review)

1. **Environment elements and buildings** — externally generated graphic assets, placed and positioned in the editor. Not hand-drawn polygon by polygon.
2. **Building groups** — a navigation hierarchy. Click a building group on the map → see individual building icons within it. Click a building → see floor plan (future).
3. **Road network** — game-engine-style drawing. Click and drag on the map to draw polylines smoothly, not click-one-point-at-a-time. Should feel intuitive and fast.
4. **Export render spec** — structured JSON output that external renderers can consume to produce the visual assets that get imported back.

## Editor Capabilities

### A. Road Network Drawing (Priority)

Game-engine-style interactive road/path drawing:

- Click and drag to draw smooth polylines on the map
- Support multiple road types: main road, pedestrian path, shuttle route
- Visual feedback while drawing (preview line following cursor)
- Snap-to-end when drawing near an existing road endpoint (optional)
- Select existing road → drag vertices to adjust
- Delete road segment
- Road properties: type, name, width, style (solid/dashed)

This replaces the current click-one-point-at-a-time route/area mode with a fluid drawing experience.

#### Road Topology: Intersections And Curves

The road engine must not treat roads as decorative lines only. It should store enough topology for intersections, bends, routing hints, and later rendered visuals.

Roads are stored as editable geometry plus optional topology metadata:

- **geometry**: sampled points from click-drag drawing.
- **segments**: logical sub-ranges between junctions or important bends.
- **junctions**: intersection nodes where two or more roads meet.
- **curves**: smoothed visual interpretation of geometry, not the source of truth.

Cross intersections:

- When a newly drawn road crosses, touches, or ends near an existing road, the editor should automatically create or update a junction node.
- Users should not manually place normal crossroad nodes. The engine infers them from line geometry.
- Phase 1A may only show auto-detected junction hints while saving the raw road, but the UI wording should still present this as engine detection, not manual work.
- Phase 1B should automatically split affected roads at detected junctions and store `junctions[]` / `segments[]`.
- Users may correct false positives by deleting/merging a generated junction, but manual correction is an exception path.
- Junctions should preserve connected road ids and connection point indexes.

Bends and curved roads:

- The source geometry remains a polyline of points.
- The display layer may smooth the line with a curve renderer, but saved data should remain point-based for editability.
- The editor should remove excessive sampled points with a simplification threshold, while keeping visible turns.
- The engine should automatically classify bends from angle and point spacing.
- Sharp bends can be tagged as `curveType: "corner"`; soft bends can be tagged as `curveType: "smooth"`.
- Users should not need to tag normal bends by hand. Manual override is only for cleanup.

Automatic geometry processing rules:

- **Line crossing detection**: compare every new road segment against existing road segments; create a junction at the intersection point when two segments cross within tolerance.
- **Endpoint snap detection**: if a new road endpoint is within snap distance of an existing endpoint or segment, snap it and create/update a junction.
- **Road splitting**: when a junction lies on an existing road segment, split the road into logical segments while keeping the original road id.
- **Curve simplification**: apply point simplification after drawing; keep points that create meaningful turns.
- **Curve classification**: calculate angle changes between adjacent segments; tag sharp corners and smooth bends automatically.
- **Visual smoothing**: apply curve rendering only for display/render export. Never replace editable `points[]` with opaque curve data.

Road object source-of-truth rule:

- `points[]` is the editable source of truth.
- `renderHint` can ask an external renderer for "soft curve", "tree-lined path", "paved road", etc.
- Imported road graphics can decorate or replace the visual style, but cannot be the only stored road data.

#### Road Types: Main Roads, Small Paths, Shuttle Routes

The editor must distinguish road purpose from visual style.

Required first-cut road types:

| Type | Use | Default Visual | Interaction Meaning |
|---|---|---|---|
| `main_road` | Vehicle-capable campus roads | wide solid line, gray/asphalt | important navigation spine |
| `pedestrian_path` | walking paths, small lanes, shortcuts | thinner line, light color or dashed | pedestrian movement and location access |
| `shuttle_route` | bus/shuttle route overlay | colored line, optional dashed/arrow style | route overlay, may share geometry with main road |
| `service_path` | maintenance/service-only path | muted dashed line | usually not prominent to students |

Settings per type:

- `main_road`: larger width, smoother curves, intersection priority, can host shuttle route overlay.
- `pedestrian_path`: smaller width, may use dashed or textured style, can pass through plazas/green areas.
- `shuttle_route`: should support stop markers and direction arrows later; it may reference an existing `main_road` segment instead of duplicating geometry.
- `service_path`: hidden or low-emphasis in public map unless enabled.

Implementation note: do not hard-code all styling in rendering functions. Store a `type` plus editable `style` override so future visual themes can reuse the same data.

### B. Asset Placement

Place externally generated assets onto the map:

- Upload or reference an image/asset URL
- Click on the map to place it
- Drag to reposition
- Resize handles (optional)
- Set anchor point
- Set click behavior (open floor plan, open detail, none)

Applies to:
- Building icons/polygons (from rendered output)
- Environment elements (beach, water, grass textures)
- Clickable map icons (POI markers)
- Labels and always-visible cards

#### External Graphic Asset Handling

Externally generated graphics are first-class assets, but not the spatial source of truth.

The editor must be able to ingest:

- raster images: `png`, `jpg`, `webp`;
- transparent overlays: building icons, trees, plazas, decorative paths;
- rendered base-map images;
- optional future vector assets: `svg`, exported design fragments.

Asset placement should store:

```json
{
  "assetId": "asset-building-library-v1",
  "url": "/assets/map/building-library.png",
  "kind": "building_icon",
  "position": { "lat": 18.395, "lng": 110.02 },
  "size": [96, 96],
  "anchor": [48, 84],
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

Response behavior:

- Clicking a graphic asset should delegate to the bound object when `boundObjectId` exists.
- If a building icon is clicked, the app opens the building/floor-plan behavior defined by the building object.
- If an environment asset is clicked and has no bound object, it should be non-interactive by default.
- If an asset fails to load, the editor should show the bound object's fallback geometry/icon.
- Replacing an asset URL must not delete the bound building, road, environment element, or location data.

Asset versioning:

- imported graphics should have stable `assetId`;
- replacement should create a new asset version or at least preserve the old URL in notes/history;
- render specs should reference both the structured object and the current asset, so external renderers can keep alignment.

### C. Building Group Hierarchy

Building groups are the top-level navigation unit on the campus map:

- Create a building group (e.g., "教学区", "生活区")
- Assign buildings to a group
- Set group icon, name, and click behavior
- On the user-facing map: click group → zoom in and show individual building icons
- On the user-facing map: click building → open floor plan (future)

Data model:

```json
{
  "id": "group-teaching",
  "name": "教学区",
  "buildingIds": ["building-library", "building-lab"],
  "icon": { "url": "/assets/group-teaching.png", "size": [48, 48] },
  "clickAction": "zoom_to_buildings",
  "bounds": { "southWest": {...}, "northEast": {...} }
}
```

### D. Property Editing

Select any map object → edit its properties in the side panel:

- Building: name, icon, clickAction, floorPlanIds, relatedLocationIds, entrances
- Environment: type, style (fill/opacity), renderHint
- Road: type, name, width, style
- Location: name, type, icon, card fields
- Building group: name, buildingIds, icon, clickAction

### E. Export Render Spec

Export the current map state as structured JSON for external renderers:

- Campus bounds and center
- All buildings with polygons and properties
- All environment elements with positions and render hints
- All roads and paths with styles
- Building groups with hierarchy
- Desired output dimensions
- Excludes: API keys, auth data, user data

### F. Import Rendered Output

After external rendering:

- Upload rendered base map image
- Preview it under existing interactive overlays
- Approve and bind to a map version
- Interactive overlays (buildings, icons, posts) remain separate and editable

## Data Schema

Extend `data/map-v2-layers.json`:

```json
{
  "version": "map-v2.1",
  "coordSystem": "gcj02",
  "center": { "lat": 18.3935, "lng": 110.0159 },
  "zoom": 16,
  "areas": [],
  "roads": [],
  "buildings": [],
  "environmentElements": [],
  "buildingGroups": [],
  "locations": []
}
```

Road object:

```json
{
  "id": "road-main-east",
  "name": "东区主路",
  "type": "main_road",
  "points": [{ "lat": 18.395, "lng": 110.020 }, ...],
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
    "edgeStyle": "soft"
  },
  "interactive": true,
  "status": "active",
  "source": "admin_drawn",
  "updatedAt": ""
}
```

Junction object:

```json
{
  "id": "junction-east-gate",
  "type": "cross",
  "position": { "lat": 18.395, "lng": 110.020 },
  "connectedRoadIds": ["road-main-east", "road-campus-north"],
  "connectionRefs": [
    { "roadId": "road-main-east", "pointIndex": 12 },
    { "roadId": "road-campus-north", "pointIndex": 4 }
  ],
  "status": "active"
}
```

Road segment object (optional in Phase 1B+):

```json
{
  "id": "segment-main-east-01",
  "roadId": "road-main-east",
  "fromJunctionId": "junction-east-gate",
  "toJunctionId": "junction-library",
  "pointRange": [0, 18],
  "type": "main_road"
}
```

Building object:

```json
{
  "id": "building-library",
  "name": "图书馆",
  "type": "building",
  "polygon": [],
  "entrances": [],
  "icon": { "url": "/assets/buildings/library.png", "size": [48, 48], "anchor": [24, 48] },
  "clickAction": "open_floor_plan",
  "floorPlanIds": [],
  "relatedLocationIds": [],
  "status": "active"
}
```

## Editor Modes (Revised)

| Mode | Interaction | Description |
|------|------------|-------------|
| 浏览 | Pan/zoom | View only |
| 选择 | Click to select | Select and edit existing objects |
| 路网 | Click + drag to draw | Game-engine-style road/path drawing |
| 放置 | Click to place | Place uploaded asset at clicked position |
| 截取 | Two-click crop | Crop base map image |

Sub-selectors:
- 放置 mode: select asset type (building / environment / icon)
- 路网 mode: select road type (main road / pedestrian / shuttle route)

## Affected Files

| File | Change |
|------|--------|
| `src/server/map-v2-service.js` | Add road normalization, extend load/save |
| `public/tools/map-v2-editor.html` | Revised mode bar, road drawing UI, asset placement UI, building group panel |
| `public/tools/map-v2-editor.js` | Road drawing engine, asset placement, building group hierarchy, revised rendering |
| `public/tools/map-v2-editor.css` | Road drawing styles, placement cursor, group hierarchy styles |
| `data/map-v2-layers.json` | Add `roads[]` array |
| `scripts/validate-locations.js` | Validate roads |

## Implementation Phases

### Phase 1: Road Network Drawing Engine

Core feature. Implement in three cuts instead of one large release.

#### Phase 1A: Road Draw MVP ✅

Implement game-engine-style click-drag road drawing:

- Mouse down → start recording points
- Mouse move → append points at interval, render preview line
- Mouse up → finish road segment
- Visual feedback: thick preview line following cursor
- Road types with different styles (main road: wide gray, pedestrian: thin dashed, shuttle: colored)
- Road properties panel: type, name, width, surface, curveStyle, status, point count
- Save to `roads[]`, reload, and export in render spec
- Validate every point stays inside the approved campus bounds
- Simplify excessive sampled points (Douglas-Peucker, tolerance ~2m) while preserving visible bends

Phase 1A does **not** need automatic snapping, segment splitting, or full junction editing.

Handoff: `docs/agent/handoffs/road-draw-mvp.md`

#### Phase 1B: Road Editing And Junctions

- Select existing road → show vertices → drag to adjust
- Delete road
- Automatically detect near-endpoint snapping
- Automatically detect road crossings
- Automatically create/update `junctions[]`
- Automatically split roads into optional `segments[]` at generated junctions
- Allow manual cleanup only for false positives: delete junction, merge junctions, or disable snapping for one road

#### Phase 1C: Curves And Route Semantics

- Add automatic curve smoothing preview while keeping `points[]` as source of truth
- Auto-fill `curveType` / `renderHint.curveStyle` from bend geometry
- Allow shuttle routes to reference existing road segments instead of duplicating geometry
- Export roads, junctions, and route hints to render spec

### Phase 2: Asset Placement Mode

Replace manual polygon drawing with asset placement:

- Upload or paste asset URL
- Click map to place
- Drag to reposition
- Set anchor, size, click behavior
- Buildings: place icon, optionally draw bounding polygon by clicking corners (quick 4-click)
- Environment: place image overlay at position with scale

Building polygons in this phase are **hit areas / bounds / alignment guides**, not hand-drawn visual building art. The visible building graphic should come from an imported asset or a rendered base map.

### Phase 3: Building Group Hierarchy

- Create/edit/delete building groups
- Assign buildings to groups via multi-select or drag
- Group properties: name, icon, clickAction, bounds
- Render groups on map as clickable icons
- Click group → zoom to group bounds and show member buildings

### Phase 4: Property Panel + Vertex Editing

- Select any object → show type-specific property panel
- Edit properties → sync to JSON
- Polygon/polyline vertices draggable on selection
- Delete selected object

### Phase 5: Export/Import

- Export render spec JSON
- Upload rendered image as base layer
- Preview with overlays
- Approve/publish map version

## Non-Goals

- No student-facing edit UI.
- No automatic AI rendering in the editor.
- No feed ranking changes.
- No NodeBB publish changes.
- No manual polygon-by-polygon illustration (external tools do this).

## Validation

- `node --check src/server/map-v2-service.js`
- `node scripts/validate-locations.js`
- Manual editor smoke:
  1. Draw a road by click-drag
  2. Place a building asset
  3. Create a building group
  4. Export render spec
  5. Save to backend
