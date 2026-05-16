# Public Assets

Static assets served directly by Vite. Files here are referenced by URL at runtime.

## Ownership

| Directory / File | Owner | Status | Notes |
|---|---|---|---|
| `aliases/` | cross-repo contract | active | Alias identity SVGs shared with `lian-platform-server`. Do not rename or remove without backend coordination. |
| `campus-*.png`, `campus-grass.png` | map system | active | Campus map base textures. |
| `lian-*.png`, `lian-illustrated-map.webp` | map system | active | Map visual assets. |
| `*-transparent.png` | map system | active | Transparent overlay variants for map icons. |
| `road-network-preview.json` | map system | active | Road network preview data for admin editor. |
| `share-cover.png` | share/OG | active | Default share cover image. |
| `shuttle-cart.png` | map system | active | Shuttle cart map icon. |

## Rules

- Do not add files here without updating this table.
- `aliases/` is a cross-repo contract — changes require backend coordination.
- Map assets (`campus-*`, `lian-*`, `*-transparent`) are owned by the map system and should not be repurposed.
