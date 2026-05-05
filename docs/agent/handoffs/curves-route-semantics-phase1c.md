# Handoff: Curves And Route Semantics (Phase 1C)

Date: 2026-05-02

## What Was Done

Implemented Phase 1C of the road network: curve smoothing preview, automatic bend classification, shuttle route references, and curve hint export.

### Curve Smoothing (`map-v2-editor.js`)

- `smoothPolylineChaikin(points, iterations)` — Chaikin corner-cutting algorithm, display-only smoothing
  - Preserves first/last points (junction anchors)
  - Iterates twice by default for smooth curves
  - Returns `[[lat, lng], ...]` for Leaflet polyline consumption

### Bend Classification (`map-v2-editor.js`)

- `calculateBendAngles(points)` — calculates deflection angle at each interior point
  - Returns `[{index, angle, deflection}, ...]` where deflection = 180 - angle
- `classifyRoadCurvature(points)` — classifies overall road curvature
  - `SHARP_BEND_THRESHOLD = 30°`
  - If >30% of bends exceed threshold → "corner"
  - Otherwise → "smooth"
  - Returns "" if < 3 points or no bends
- `autoClassifyCurves()` — batch classification for all active roads
  - Skips roads that already have `renderHint.curveStyle` set
  - Writes result to `renderHint.curveStyle` and re-renders

### Curve Smoothing Toggle

- `state.showSmoothCurves` boolean, toggled by "平滑预览" button
- When enabled, renders a second polyline per road with Chaikin smoothing (40% opacity, dashed, non-interactive)
- Original `points[]` polyline stays as the editable source of truth

### Shuttle Route References

- `routeRef` field on road objects: references another road's ID
- Editor resolves `routeRef` at render time: if a shuttle route has `routeRef`, the referenced road's `points[]` are used for rendering
- `routeRef` input field in road properties panel, shown only when `type === "shuttle_route"`
- Server `normalizeRoad()` persists `routeRef` (compactText, max 80 chars)

### Server Schema (`map-v2-service.js`)

- `normalizeRoad()`: added `routeRef: compactText(item.routeRef || "", 80)`
- `normalizeRoute()`: added `routeRef: compactText(item.routeRef || "", 80)`
- `renderHint.curveStyle` was already normalized; no change needed

### UI (`map-v2-editor.html` + `.css`)

- Road properties: added "曲线类型" (readonly curveHint display), "路线引用" (routeRef input, shown only for shuttle routes)
- Action row: added "曲线分类" button (`data-auto-classify-curves`), "平滑预览" toggle button (`data-toggle-smooth`)
- CSS: `.action-row button.is-active` style for toggle state

### Export Render Spec

- Roads in export include `curveHint` (from `renderHint.curveStyle`) and `routeRef`

## Files Changed

| File | Change |
|------|--------|
| `public/tools/map-v2-editor.js` | Chaikin smoothing, bend classification, auto-classify, curve toggle, shuttle route ref resolution |
| `src/server/map-v2-service.js` | normalizeRoad + routeRef, normalizeRoute + routeRef |
| `public/tools/map-v2-editor.html` | curveHint display, routeRef input, classify/smooth buttons |
| `public/tools/map-v2-editor.css` | toggle button active state |

## Key Design Decisions

1. Chaikin smoothing is display-only — `points[]` is never replaced by smoothed data
2. Auto-classify skips roads with existing `curveStyle` to preserve manual overrides
3. Bend classification is per-road (overall character), not per-segment
4. Shuttle route `routeRef` resolves at render time, not stored as copied geometry
5. Curve smoothing toggle is session-only (not persisted to JSON)

## Verification

```bash
node --check src/server/map-v2-service.js
node --check public/tools/map-v2-editor.js
node scripts/validate-locations.js
```

Manual editor smoke:
1. Draw a road with sharp bends → auto-classify → verify "corner" in curveHint
2. Draw a gentle curve road → auto-classify → verify "smooth" in curveHint
3. Toggle "平滑预览" → verify smoothed overlay appears on roads
4. Create shuttle route with `routeRef` pointing to a main road → verify it renders the referenced road's geometry
5. Export render spec → verify `curveHint` and `routeRef` fields present on roads
6. Save to backend, reload → verify `routeRef` and `renderHint.curveStyle` persist

## Known Gaps

1. No per-segment curve classification (only per-road overall)
2. Curve smoothing toggle is not persisted across sessions
3. No undo for auto-classify changes
4. `routeRef` does not validate that the referenced road exists (editor silently falls back to own points)

## Next Steps

Per task doc implementation order:

1. **Phase 2: Asset Placement Mode**
   - Upload or paste asset URL
   - Click map to place, drag to reposition
   - Set anchor, size, click behavior
   - Building icons and environment elements

2. **Phase 3: Building Group Hierarchy**
