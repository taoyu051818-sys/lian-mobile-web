# Map V2 Technical Plan

## Status

Design-only draft. Do not implement Map v2 until this plan is reviewed.

Until approval:

- do not modify `public/app.js`;
- do not add Leaflet;
- do not change locations API implementation.

## Goals

- Keep the illustrated campus map as the main exploration surface.
- Use Leaflet only for precise location workflows.
- Make `locationId` the formal place key.
- Keep `locationArea` as compatibility/display fallback.
- Support old metadata without forcing fake exact pins.

## Layer Responsibilities

Illustrated map:

- campus exploration;
- landmark browsing;
- route overlays;
- campus memories;
- location-attached post discovery;
- area-level fallback display.

Leaflet:

- precise coordinate picking;
- GPS/manual point capture;
- calibration between real coordinates and image coordinates;
- debugging spatial alignment.

## Data Model

Recommended location shape:

```json
{
  "locationId": "known-place-id",
  "locationArea": "display area",
  "locationPrecision": "area",
  "geoPoint": {
    "lat": 18.399433,
    "lng": 110.013919
  },
  "imagePoint": {
    "x": 573,
    "y": 567
  }
}
```

Rules:

- `locationId` is stable and formal.
- `locationArea` is display fallback.
- `locationPrecision` should be `exact`, `area`, or `hidden`.
- `geoPoint` is optional until precise picking exists.
- `imagePoint` is optional and only valid for illustrated map rendering.

## Phases

Phase 1: Inventory and calibration design

- list known places and current map points;
- decide canonical `locationId` values;
- document coordinate transform assumptions;
- define validation examples.

Phase 2: Metadata compatibility

- support posts with only `locationArea`;
- avoid exact pins when precision is unknown;
- define fallback grouping by area label.

Phase 3: Location picker design

- choose known landmark;
- optionally refine on illustrated map;
- optionally verify with Leaflet/GPS in a later implementation;
- require user confirmation before saving.

Phase 4: Implementation task

- only after plan approval;
- update frontend map behavior;
- add Leaflet only if the exact workflow needs it;
- add browser checks for desktop/mobile alignment.

## Validation Checklist

Before implementation:

- plan reviewed;
- no code/data changes in design-only thread;
- `locationId` vocabulary agreed;
- old `locationArea`-only posts have fallback behavior;
- Leaflet scope remains precise workflows only.

During implementation:

- desktop and mobile map screenshots checked;
- markers remain aligned after resize;
- area-only posts do not show fake exact pins;
- publishing location confirmation is explicit.

## Risks

- Old metadata may contain inconsistent area strings.
- Illustrated-map image coordinates can drift if asset dimensions or CSS transforms change.
- Leaflet can make the product feel like a generic map if used as the default experience.
- AI location suggestions can be wrong and must remain confirm-before-save.

