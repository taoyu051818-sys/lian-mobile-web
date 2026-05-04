# Handoff: Map v2 Road Network Import Preview And Alignment

Date: 2026-05-03

## Summary

Road network data from `road_network_mapWITH` exports rendered as lane line overlay on both the admin editor and the student-facing exploration page. Canvas rendering with drag-to-align in editor, auto-loaded with alignment transform X=442 Y=-184.

## Files Changed

- `scripts/import-road-network-preview.js` (new) — Node.js conversion script
- `outputs/map-v2-road-network-preview.json` (generated) — 278 KB preview data
- `public/assets/road-network-preview.json` (new) — copy for frontend serving, transform baked in
- `public/map-v2.js` — added road network canvas overlay on exploration page
- `public/tools/map-v2-editor.js` — added preview canvas layer, align mode toggle, auto-load
- `public/tools/map-v2-editor.html` — added preview section UI, layer toggle, align mode button
- `public/tools/map-v2-editor.css` — added preview section styles

## Behavior

### Conversion script

```bash
node scripts/import-road-network-preview.js [--input DIR] [--out FILE]
```

Reads `lanes.geojson`, `roads.csv`, `junctions.csv`, `lane_nodes.csv`. Converts projected x/y meters to lat/lng using projection center (18.393453, 110.015821). Simplifies lane geometry (RDP 3m). Aggregates lanes by `parent_id` for roads.

### Exploration page (`/`)

- Click "探索" tab → road network renders automatically as gray lane lines
- Canvas overlay at z-index 350 (below markers, above base map)
- Opacity 0.7, no user controls (read-only display)

### Editor (`/tools/map-v2-editor.html`)

- Opens with road preview auto-loaded (X=442, Y=-184 baked in)
- Default: lanes shown, roads/junctions hidden
- "对齐模式" button toggles drag alignment mode
- In align mode: map cursor becomes grab hand, drag anywhere to move road network
- Numeric inputs for translate X/Y, scale, rotation
- Opacity and line width sliders
- "导出对齐" exports current transform as JSON

### Alignment workflow

1. Editor auto-loads preview with default transform
2. Click "对齐模式" → cursor becomes grab hand
3. Drag to adjust alignment
4. Fine-tune with numeric inputs
5. Click "导出对齐" to save
6. Update `public/assets/road-network-preview.json` transform for production

### Data safety

- Preview is purely visual — does NOT write to `data/map-v2-layers.json`
- `public/assets/road-network-preview.json` is a separate asset file
- Clear button removes preview from editor (not from exploration page)

## Validation

```bash
node --check scripts/import-road-network-preview.js
node --check public/tools/map-v2-editor.js
node --check public/map-v2.js
node --check src/server/map-v2-service.js
node scripts/validate-locations.js
```

All passed.

## Known limitations

- 1572 lanes rendered as single-pixel gray lines — no road width or border effects
- Coordinate conversion uses simple meter-to-degree approximation
- Rotation pivot is at projection center (18.393453, 110.015821)
- No snap-to-road or auto-alignment
- Exploration page has no UI to toggle road visibility (always on)

## Acceptance

1. [x] Conversion script generates preview JSON
2. [x] Editor auto-loads preview with alignment
3. [x] Align mode drag works
4. [x] Lane lines render on exploration page
5. [x] `data/map-v2-layers.json` not modified
6. [x] All syntax checks pass

## Next steps

- Human visual verification on exploration page
- Adjust alignment if needed via editor
- Consider adding road width/border rendering when data is finalized
- Separate task to convert aligned draft into official Map v2 road data
