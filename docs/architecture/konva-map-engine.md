# Konva Map Engine

Status: active architecture from 2026-08-27.

## Runtime

```text
/api/map/v2/items
        ↓
MapV2ItemsResponse
        ↓
buildMapScene()
        ↓
MapScene v1 (JSON-first)
        ↓
MapCanvas.vue (vue-konva)
        ↓
Konva Stage / Layer / Shape
```

`MapScene` is the boundary between business data and drawing. Konva never owns a merchant, post,
place, errand, or device record. A rendered object carries only a stable `linkedEntity` reference;
clicks return to the existing feature composables and APIs.

## Business linkage

| Scene object    | Link                              | Existing behavior                                                                  |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| Location        | `{ kind: "place", id: placeId }`  | Place sheet and publish/errand selection                                           |
| Post            | `{ kind: "post", id: tid }`       | Global post detail                                                                 |
| Asset           | `{ kind: "device", id: assetId }` | Editable position/rotation event; persistence remains an authenticated API concern |
| Road/area/route | Scene path id                     | Display and viewport discovery                                                     |

The existing `/api/map/v2/items` response remains the read source. Publish and errand continue to
store `PostLocation` (`placeId`, label, latitude, longitude). Manual text edits must clear stale
structured identity before submit.

## Editor boundary

`MapCanvas` accepts `editable`, binds the selected asset to a Konva `Transformer`, and emits
`object-select` / `object-change` events for dragging, scaling and rotation. `AdminMapEditorBlock`
owns the authenticated draft and calls `GET/PUT /api/admin/map-v2`; uploads use the same-origin,
ops-token-protected `POST /api/admin/map-v2/assets` endpoint. Authorization identity and request ownership are retired on token or
auth-epoch change and on unmount. Public standalone HTML tools, inline ops-token JavaScript, and
CDN-loaded Leaflet are retired and must not be reintroduced.

## Retired files

- `src/platform/leaflet.ts`
- `src/features/map/MapLeafletView.vue`
- Leaflet layer, road, icon-scale and HTML-marker helpers
- `public/tools/map-v2-editor.*`
- `public/tools/map-georef.html`
- `public/tools/map-coastline-align.html`

There is no dual-engine mode and no runtime fallback to Leaflet.
