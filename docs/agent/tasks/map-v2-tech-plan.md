# Task: Map V2 Tech Plan

## Goal

Produce a design-only technical plan for Map v2 before any implementation.

## Scope

- Define illustrated map vs Leaflet responsibilities.
- Define the `locationId`, `locationArea`, `geoPoint`, and `imagePoint` model.
- Plan marker rendering for exact and area-level locations.
- Plan compatibility for old metadata.
- Plan publishing location picker phases.
- Produce `../MAP_V2_TECH_PLAN.md`.

## Out of Scope

- Modifying `public/app.js`.
- Adding Leaflet.
- Changing locations API implementation.
- Implementing map UI.
- Building a separate food map product.
- Full place detail pages.
- Full GIS routing.
- AI automatic location inference without manual confirmation.

## Inputs

- `../04_DECISIONS.md`
- `../05_TASK_BOARD.md`
- `../domains/MAP_SYSTEM.md`
- existing map code and data may be read only for planning;
- no code or data edits until the technical plan is accepted.

## Validation

For this planning task:

- confirm no code/data files changed;
- confirm the plan keeps illustrated map as the exploration surface;
- confirm Leaflet is limited to precise workflows;
- confirm `locationId` is the formal key;
- confirm `locationArea` is compatibility/display fallback;
- confirm implementation phases are separated from design.

For future implementation:

- add browser checks for desktop/mobile map alignment;
- verify marker stability after responsive scaling;
- verify fallbacks for posts with only `locationArea`.

## Deliverables

- `../MAP_V2_TECH_PLAN.md`
- phased implementation plan;
- data model recommendation;
- validation checklist;
- risks and compatibility notes.

## Handoff file

Use:

- `../handoffs/map-v2-tech-plan.md`

