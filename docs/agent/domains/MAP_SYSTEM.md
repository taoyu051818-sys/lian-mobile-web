# Map System

## Purpose

The map system supports campus exploration, route awareness, and location-attached content.

## Current Status

Map v2 has Gaode tiles + campus grass base layer. Admin editor supports locations, areas, routes, buildings, environment elements, building groups, and roads (Phase 1A complete).

Layers in `data/map-v2-layers.json`: areas, routes, roads, buildings, environmentElements, buildingGroups.
Locations in `data/locations.json` with GCJ-02 coordinates.

## Product Split

- Gaode map: default map surface and precise location picker.
- LIAN overlays: campus areas, roads, routes, buildings, environment, location icons, post cards.
- Campus grass texture as base layer with Gaode tiles at 35% opacity.
- Old illustrated map: hidden compatibility layer during migration.

## Admin Editor

Standalone tool at `/tools/map-v2-editor.html`. Modes: 浏览/选择/点/多边形/路线/路网/截取.

Road network drawing (Phase 1A): game-engine-style click-drag, 4 road types (main_road, pedestrian_path, shuttle_route, service_path), Douglas-Peucker point simplification, property panel, vertex editing.

Remaining: Phase 1B (junctions), Phase 1C (curves), Phase 2 (asset placement), Phase 3 (building group hierarchy).

## Render Workflow

Task doc: `../tasks/map-v2-render-workflow.md`. Export structured JSON to external renderers, upload rendered output, preview with overlays, approve/publish map version.

## Location Rules

- `locationId` is the formal place key.
- `locationArea` is compatibility/display text for old or fuzzy data.
- If confidence is low, store area-level location instead of pretending a pin is exact.

## Related Files

- `../04_DECISIONS.md`
- `../tasks/map-v2-admin-editor.md`
- `../tasks/map-v2-render-workflow.md`
- `../handoffs/road-draw-mvp.md`
