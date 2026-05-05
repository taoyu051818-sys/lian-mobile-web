# Map System

## Purpose

The map system supports campus exploration, route awareness, and location-attached content.

## Current Status

Map v2 has Gaode tiles + campus grass base layer. Admin editor supports locations, areas, routes, buildings, environment elements, building groups, roads, junctions, and assets.

Layers in `data/map-v2-layers.json`: areas, routes, roads, junctions, buildings, environmentElements, buildingGroups, assets.
Locations in `data/locations.json` with GCJ-02 coordinates.

## Product Split

- Gaode map: default map surface and precise location picker.
- LIAN overlays: campus areas, roads, routes, buildings, environment, location icons, post cards, assets.
- Campus grass texture as base layer with Gaode tiles at 35% opacity.
- Old illustrated map: hidden compatibility layer during migration.

## Admin Editor

Standalone tool at `/tools/map-v2-editor.html`. Modes: 浏览/选择/点/多边形/路线/路网/放置/截取.

### Completed Phases

**Phase 1A — Road Draw MVP**: game-engine-style click-drag, 4 road types (main_road, pedestrian_path, shuttle_route, service_path), Douglas-Peucker point simplification, property panel, vertex editing.

**Phase 1B — Road Editing & Junctions**: automatic junction detection (endpoint snap, segment snap, crossing detection), road splitting into segments, junction rendering with type-specific markers (endpoint/T/cross), junction properties panel, noSnap per-road flag, cleanup on deletion.

**Phase 1C — Curves & Route Semantics**: Chaikin curve smoothing preview (display-only, toggle button), bend angle classification (30° threshold, corner/smooth), auto-classify button for batch curveHint assignment, shuttle route `routeRef` field for referencing existing road geometry, curve hint export in render spec.

**Phase 2 — Asset Placement Mode**: "放置" mode with asset kind selector, image upload via Cloudinary, click-to-place, drag-to-reposition, asset properties panel (URL/kind/size/anchor/rotation/opacity/clickBehavior/boundObject/status), `assets[]` data model with server normalization.

### Remaining

- Phase 3: building group hierarchy (navigation hierarchy, group→buildings→floor plans).

## Data Model

Road object: id, name, type, points[], segments[], junctionIds[], style, renderHint (surface/curveStyle/edgeStyle), noSnap, routeRef.

Junction object: id, type (endpoint/T/cross/multi), position, connectedRoadIds[], connectionRefs[{roadId, pointIndex}], status.

Asset object: id, url, kind, position, size, anchor, rotation, opacity, zIndex, boundObjectType, boundObjectId, clickBehavior, alwaysShowCard, status.

## Render Workflow

Task doc: `../tasks/map-v2-render-workflow.md`. Export structured JSON to external renderers, upload rendered output, preview with overlays, approve/publish map version.

## Location Rules

- `locationId` is the formal place key.
- `locationArea` is compatibility/display text for old or fuzzy data.
- If confidence is low, store area-level location instead of pretending a pin is exact.

## Bounds (Critical)

Canonical bounds: south 18.3700734, west 109.9940365, north 18.4149043, east 110.0503482.

Bounds are defined in three places — `map-v2-editor.js`, `map-v2-service.js`, `validate-locations.js`. All must match. A mismatch on 2026-05-03 caused data loss. See `04_DECISIONS.md` "Map V2 Bounds Must Be Single Source Of Truth".

## Related Files

- `../04_DECISIONS.md`
- `../tasks/map-v2-admin-editor.md`
- `../tasks/map-v2-render-workflow.md`
- `../handoffs/road-draw-mvp.md`
- `../handoffs/road-junctions-phase1b.md`
- `../handoffs/curves-route-semantics-phase1c.md`
- `../handoffs/asset-placement-phase2.md`
