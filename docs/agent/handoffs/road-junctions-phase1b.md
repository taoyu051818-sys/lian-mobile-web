# Handoff: Road Junctions (Phase 1B)

Date: 2026-05-02

## What Was Done

Implemented Phase 1B of the road network: automatic junction detection from road geometry, road splitting into logical segments, and junction management UI.

### Geometry Utilities (`map-v2-editor.js`)

- `haversineDist(a, b)` — distance in meters between two lat/lng points
- `segmentIntersection(p1, p2, p3, p4)` — line segment intersection using cross-product method
- `closestPointOnSegment(p, a, b)` — nearest point on a segment with distance and parameter t
- `findSnapTarget(p, roadPoints)` — find nearest vertex or segment within SNAP_DISTANCE (5m)
- `insertPointIntoRoad(road, point, segIndex)` — splice a point into a road's points array
- `generateJunctionId(position)` — junction ID from coordinates + timestamp
- `classifyJunction(roadCount)` — "endpoint" (1), "T" (2-3), "cross" (4+)

### Detection Pipeline (`map-v2-editor.js`)

- `detectJunctions(roads, existingJunctions)` — three-phase detection:
  - Phase A: endpoint-to-endpoint snap (merge within 5m to midpoint)
  - Phase B: endpoint-to-segment snap (insert point into other road)
  - Phase C: segment-segment crossings (insert intersection into both roads)
  - Index drift fix: collect intersections per road pair, sort by descending index, apply in reverse
- `upsertJunction()` — find/create junction within 1m merge distance
- `recalculateSegments(road, junctions)` — build segment ranges from junction point indices
- `runJunctionDetection()` — orchestration: parse → detect → recalculate → write → render

### Trigger Points

- Auto-runs after `commitDraft()` when target is roads
- Manual "Detect Junctions" button for re-scanning after vertex edits or deletion
- Junction cleanup on road deletion (removes junctionIds, cleans segments)

### Server Schema (`map-v2-service.js`)

- `normalizeJunction(item)` — validates id, type (endpoint/T/cross/multi), position (in bounds), connectedRoadIds, connectionRefs, status
- Extended `loadMapV2Data()` with `junctions: []` in fallback and returned layers
- Extended PUT handler with bounds validation for junction positions
- Extended public API to include active junctions

### UI (`map-v2-editor.html` + `.css`)

- Layer toggle for "路口"
- Junction properties panel (type, status, connected road count, coordinates, connected roads list)
- "Detect Junctions" button
- Road properties: "跳过检测" (noSnap) select field
- Junction marker rendering with type-specific shapes:
  - Endpoint: yellow circle (12px)
  - T-junction: blue diamond (14px)
  - Cross: red square (16px)

### Data Model Changes

- Added `junctions: []` to `DEFAULT_LAYERS_FALLBACK`
- Added `noSnap` field to road schema
- Junction schema: `{id, type, position, connectedRoadIds, connectionRefs[], status}`
- Segment schema: `{id, roadId, fromJunctionId, toJunctionId, pointRange, type}`
- Export render spec includes junctions

### Validation (`validate-locations.js`)

- `validateJunction(jx, roadIds, errors, warnings)` — validates id, position bounds, type enum, connectedRoadIds references
- Added junctions to cross-collection duplicate ID checking

## Files Changed

| File | Change |
|------|--------|
| `public/tools/map-v2-editor.js` | Geometry utilities, detection pipeline, junction rendering, cleanup UI |
| `src/server/map-v2-service.js` | normalizeJunction, extended load/save/API for junctions[] |
| `public/tools/map-v2-editor.html` | Junction layer toggle, junction properties panel, road noSnap field, detect button |
| `public/tools/map-v2-editor.css` | Junction marker styles |
| `scripts/validate-locations.js` | validateJunction, junctions in cross-collection check |

## Key Design Decisions

1. Segments are sub-ranges of a road's points[], not separate geometry
2. Detection runs after commitDraft + manual button (not every mouseup)
3. Client-side detection, server-side validation
4. Junction ID stability via 1m merge distance in upsertJunction
5. noSnap per-road flag for false-positive cleanup

## Verification

```bash
node --check src/server/map-v2-service.js
node --check public/tools/map-v2-editor.js
node --check scripts/validate-locations.js
node scripts/validate-locations.js
```

## Known Gaps

1. No merge-junctions UI (can be added as follow-up)
2. Vertex drag doesn't auto-refresh junctions (user must click "Detect Junctions")
3. No angle-based junction classification refinement
4. No undo for junction detection changes

## Next Steps

Per task doc implementation order:

1. **Phase 1C: Curves And Route Semantics**
   - Automatic curve smoothing preview
   - Auto-fill curveType/renderHint.curveStyle from bend geometry
   - Shuttle routes reference existing road segments
   - Export roads, junctions, and route hints to render spec

2. **Phase 2: Asset Placement Mode**
3. **Phase 3: Building Group Hierarchy**
