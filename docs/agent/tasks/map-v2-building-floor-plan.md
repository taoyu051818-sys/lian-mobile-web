# Task: Map v2 Building And Floor Plan View

## Goal

Add the user-facing second-level map experience: clicking a building or building group opens a more detailed 2D planar view with floors, rooms, functions, and related posts.

This is a frontend display and data modeling task. It should use Map v2 objects as the entry point and must not depend on the legacy map.

## Product Scope

Campus overview:

- shows natural base map;
- shows roads, routes, buildings, icons, and post cards;
- clicking a building icon or building polygon opens the building detail view.

Building detail view:

- shows building or building-group summary;
- shows floor selector;
- shows 2D floor plan;
- shows room/function polygons;
- shows room icons/labels;
- shows posts related to the building, floor, room, or function category.

Room/function detail:

- shows room name and function;
- shows current/related posts;
- supports future status hints such as open/closed/busy if such data exists later.

## Data Objects

Building:

```json
{
  "id": "building-library",
  "name": "图书馆",
  "polygon": [],
  "icon": {},
  "floorPlanIds": ["floor-library-1"],
  "relatedLocationIds": ["library"],
  "clickAction": "open_floor_plan"
}
```

Floor plan:

```json
{
  "id": "floor-library-1",
  "buildingId": "building-library",
  "name": "一层",
  "imageUrl": "",
  "imageSize": { "width": 1600, "height": 1200 },
  "rooms": []
}
```

Room:

```json
{
  "id": "room-library-reading-a",
  "floorId": "floor-library-1",
  "name": "自习区 A",
  "functionType": "study",
  "polygon": [],
  "icon": {},
  "locationId": "",
  "tags": ["自习", "安静"]
}
```

## Post Association Rules

Posts can be associated by:

- `locationId`
- `locationArea`
- `buildingId`
- `floorId`
- `roomId`
- content type / function tags

First version should prefer exact IDs when present, then fall back to `locationArea`.

Do not let AI invent `buildingId`, `floorId`, or `roomId`; these must come from trusted map data or user selection.

## Frontend Pages/States

Affected user-facing surfaces:

- Map v2 overview
- Building detail panel/page
- Floor plan view
- Room/function detail panel
- Related post list
- Publish location picker, so users can select building/floor/room when appropriate

## API Requirements

Expected frontend APIs:

```text
GET /api/map-v2
GET /api/map-v2/buildings/:id
GET /api/map-v2/floors/:id
GET /api/map-v2/rooms/:id/posts
```

Post lists must apply future audience filtering before returning data.

## Non-Goals

- No 3D building view.
- No indoor positioning.
- No live occupancy detection.
- No automatic floor-plan generation.
- No new recommendation algorithm.

## Validation

- clicking overview building opens the correct building view;
- floor selector changes floor plan without layout breakage;
- room polygon click opens room detail;
- related post list respects post visibility rules;
- publish location picker can store the selected building/floor/room draft fields when available.
