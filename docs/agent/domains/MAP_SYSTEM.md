# Map System

## Purpose

The map system supports campus exploration, route awareness, and location-attached content.

## Current Status

Map v2 is not ready for direct implementation.

The next step is design-only:

```text
docs/agent/MAP_V2_TECH_PLAN.md
```

Do not modify `public/app.js`, add Leaflet, or change locations API implementation until the technical plan is reviewed.

## Product Split

- Illustrated map: default visual exploration surface.
- Leaflet: precise map layer for coordinate calibration, location picking, and coordinate verification.

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

