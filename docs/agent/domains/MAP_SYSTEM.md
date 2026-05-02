# Map System

## Purpose

The map system supports campus exploration, route awareness, and location-attached content.

## Current Status

Map v2 implementation has started after product approval.

Current Map v2 direction:

- Gaode raster tiles are the base map.
- LIAN renders areas, routes, location icons, and post cards as overlays.
- The publisher uses Map v2 for user-selected location drafts.
- Admins can edit the first version of `locations.json` and `map-v2-layers.json` through a lightweight JSON editor.

## Product Split

- Gaode map: default map surface and precise location picker.
- LIAN overlays: product-specific campus areas, routes, location icons, and post cards.
- Old illustrated map: hidden compatibility layer during migration.

## Location Rules

- `locationId` is the formal place key.
- `locationArea` is compatibility/display text for old or fuzzy data.
- If confidence is low, store area-level location instead of pretending a pin is exact.
- Future map rendering should support posts with only `locationArea`.

## Plan Requirements

`MAP_V2_TECH_PLAN.md` should define:

- illustrated map vs Leaflet responsibilities;
- `locationId` / `locationArea` / `geoPoint` / `imagePoint` model;
- marker rendering rules;
- fallback behavior for old metadata;
- publishing location picker phases;
- validation before implementation.

## Related Files

- `../04_DECISIONS.md`
- `../tasks/map-v2-tech-plan.md`
- `../MAP_V2_TECH_PLAN.md`
