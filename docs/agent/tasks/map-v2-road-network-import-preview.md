# Task: Map v2 Road Network Import Preview And Alignment

Status: **待审核** — 实现完成，路网车道线渲染在探索页面和编辑器

## Goal

Render the exported public-map road network data as a preview overlay in the Map v2 admin/editor tool, then let a human drag/align it against the Gaode base map and current campus visual base.

This task is for import preview and alignment only. It must not directly overwrite the official Map v2 road layer without human approval.

## Human Input Provided

The user provided concrete road network export files:

```text
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/junctions.csv
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lane_nodes.csv
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lanes.csv
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/lanes.geojson
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/road_network_summary.json
F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH/roads.csv
```

Known summary:

```json
{
  "map_name": "sanya_area",
  "projection": "+proj=tmerc +lat_0=18.393453 +lon_0=110.01582099999999",
  "counts": {
    "lanes": 1572,
    "roads": 154,
    "junctions": 50
  }
}
```

The source coordinates are local projected x/y meters, not directly usable Gaode lat/lng. They need conversion/alignment before product use.

## Product Decision

The road network should be shown as a movable preview overlay so the human can align it.

Required UX:

- Load road network preview into the admin/editor map.
- Display lanes/roads as a semi-transparent overlay above Gaode tiles and below interactive LIAN markers/cards.
- Provide an alignment mode where the human can drag the whole imported road network.
- Prefer also supporting numeric transform controls:
  - translate X/Y;
  - scale;
  - rotation;
  - opacity;
  - line width;
  - show/hide lanes, roads, junctions.
- Save/export alignment parameters separately from official map data.
- After alignment, export a draft converted road layer for human review.

## Source Of Truth Rule

The imported road data is a reference layer, not automatically trusted product data.

Allowed source flow:

```text
road_network_mapWITH raw exports
-> preview import
-> human visual alignment
-> draft road layer export
-> human review
-> separate approval before merging into official map-v2 layers
```

Forbidden in this task:

```text
raw road import
-> automatic overwrite of data/map-v2-layers.json
```

## Implementation Scope

### 1. Add a road import parser/converter

Create a script or frontend loader that can read:

- `road_network_summary.json`
- `lane_nodes.csv`
- `lanes.csv`
- `roads.csv`
- `junctions.csv`
- optionally `lanes.geojson`

First cut can use `lanes.geojson` for faster preview if coordinate conversion/alignment is handled consistently.

The parser should produce a preview model:

```json
{
  "source": "road_network_mapWITH",
  "projection": "+proj=tmerc +lat_0=18.393453 +lon_0=110.01582099999999",
  "lanes": [],
  "roads": [],
  "junctions": [],
  "transform": {
    "translateX": 0,
    "translateY": 0,
    "scale": 1,
    "rotation": 0
  }
}
```

### 2. Render preview overlay in editor

Add an editor layer:

```text
Road import preview
```

Controls:

- show/hide preview;
- opacity slider;
- lane/road/junction toggle;
- road width multiplier;
- color override;
- clear preview.

The preview layer must not be shown to normal student users.

### 3. Alignment mode

Add a management-only alignment mode:

```text
路网对齐
```

Required behavior:

- Drag the imported road network as one group.
- Keep the base map fixed.
- Alignment transform applies to the preview overlay only.
- Show current transform values in the side panel.
- Allow reset to original transform.

Recommended additional controls:

- shift-drag or handle to rotate;
- slider/input for scale;
- arrow-key nudge;
- snap small movement increments;
- copy/export transform JSON.

### 4. Export draft

After alignment, export:

```text
outputs/map-v2-road-network-preview.json
```

or another clearly generated preview file.

Draft export should include:

- transform parameters;
- converted/aligned road polylines;
- junction preview points;
- source file metadata;
- generatedAt;
- warning that this is not official map data.

Do not write official `data/map-v2-layers.json` in this task unless the user explicitly approves after visual review.

### 5. Optional future conversion to official roads

If the human approves the aligned draft in a later task, convert road preview to official Map v2 roads:

```json
{
  "id": "road-import-200000000",
  "type": "main_road",
  "source": "public_map_import",
  "points": [{ "lat": 18.39, "lng": 110.01 }],
  "style": {},
  "status": "draft"
}
```

This is not part of the first cut.

## Coordinate Notes

The export projection is:

```text
+proj=tmerc +lat_0=18.393453 +lon_0=110.01582099999999
```

The raw `x/y` values appear to be local meters around that origin. For Gaode overlay, implementation should either:

1. convert projected x/y to WGS84 lon/lat and then to GCJ-02; or
2. use a local affine alignment workflow where the preview is rendered in map pixel/layer space and the human transform is stored.

Preferred first cut:

- get a visually usable overlay quickly;
- store transform explicitly;
- avoid pretending the converted geometry is authoritative before human alignment.

## Affected Files

Allowed files:

- `public/tools/map-v2-editor.html`
- `public/tools/map-v2-editor.js`
- `public/tools/map-v2-editor.css`
- `public/map-v2.js`, only if a shared preview layer helper is truly needed
- `src/server/map-v2-service.js`, only if adding a read-only import-preview API is needed
- `scripts/import-road-network-preview.js` or similarly named script
- `outputs/*` generated preview output
- `docs/agent/tasks/map-v2-road-network-import-preview.md`
- `docs/agent/handoffs/map-v2-road-network-import-preview.md`

Forbidden files without explicit human approval:

- `data/map-v2-layers.json`
- `data/locations.json`
- `data/feed-rules.json`
- `data/post-metadata.json`
- feed, publish, NodeBB, auth, AI services

## Validation Commands

At minimum:

```bash
node --check public/tools/map-v2-editor.js
node --check public/map-v2.js
node --check src/server/map-v2-service.js
node scripts/validate-locations.js
```

If a new script is added:

```bash
node --check scripts/import-road-network-preview.js
node scripts/import-road-network-preview.js --input F:/26.3.13/lian-campusmind-agent/campusmind/exports/road_network_mapWITH --out outputs/map-v2-road-network-preview.json
```

## Manual Acceptance

Human review is mandatory.

1. Open `/tools/map-v2-editor.html`.
2. Load the road network preview.
3. Confirm roads/lanes render as an overlay.
4. Drag the road network as one group.
5. Adjust opacity/scale/rotation if implemented.
6. Align it against known campus roads on Gaode/base map.
7. Toggle lanes/roads/junctions to inspect quality.
8. Export draft preview JSON.
9. Confirm no official map data was overwritten.
10. Human decides whether the aligned draft is good enough for a later official merge task.

## Acceptance Criteria

- The road network can be rendered in the admin/editor frontend.
- The human can drag-align the whole road network overlay.
- Alignment transform is visible and exportable.
- Preview can be cleared/reset.
- Official `data/map-v2-layers.json` is not modified automatically.
- A generated draft output can be reviewed separately.

## Risks

- Projection mismatch can make the raw data appear offset or rotated.
- Lanes are too detailed for final product display; first cut should allow hiding lanes and showing aggregated roads.
- Rendering 1572 lanes may be heavy. Implement layer toggles or simplify for preview if needed.
- Imported public-map data may not match the visual campus base exactly; human alignment is expected.

## Rollback

- Remove the preview layer controls from editor.
- Delete generated preview output.
- Do not touch official map data rollback because this task should not write official map data.
