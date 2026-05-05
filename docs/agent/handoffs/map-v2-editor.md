---
task: map-v2-editor
status: done
date: 2026-05-02
files_changed:
  - public/tools/map-v2-editor.html
  - public/tools/map-v2-editor.css
  - public/tools/map-v2-editor.js
  - public/assets/campus-grass.png
  - public/map-v2.js
  - public/styles.css
  - public/index.html
  - src/server/alias-service.js
  - src/server/post-service.js
  - src/server/ai-light-publish.js
  - src/server/api-router.js
  - src/server/auth-routes.js
---

# Handoff: Map v2 Editor + Grass Base Layer

## What was done

### 1. Standalone editor tool page
- `public/tools/map-v2-editor.html` — internal admin page, not in user navigation
- Four modes: browse, place location, draw area, draw route
- JSON editing for locations.json and map-v2-layers.json
- Icon/card preview with alwaysShow support
- Saves via `PUT /api/admin/map-v2` (admin token required)

### 2. Grass base layer
- `public/assets/campus-grass.png` (1672x941, 3MB) from user's design assets
- `L.imageOverlay` over campus bounds, Gaode tiles at 35% opacity on top
- Applied to both user map (map-v2.js) and editor

### 3. Editor layer controls
- Layer visibility toggles: grass, tiles, bounds, areas, routes, locations, draft
- Opacity sliders for grass base and Gaode tiles
- Real-time adjustment

### 4. CSS additions to styles.css
- `.map-v2-place-asset` — custom icon image rendering
- `.map-v2-location-card` — always-show location card
- Removed duplicate `.map-v2-post-card` block

### 5. Encoding fix (index.html)
- Commit 3340f65 corrupted Chinese text via double UTF-8 encoding
- Restored from 90bd682, re-applied map-v2 shell with correct encoding
- Removed BOM

### 6. Alias publish identity
- `updatePublishIdentityNote()` shows current alias or real name in publish sheet
- `aliasId` added to AI publish payload
- CSS for `.publish-identity-note` and `.profile-identity-section`

## How to verify
- User map: http://localhost:4100 — map tab shows grass base + Gaode overlay
- Editor: http://localhost:4100/tools/map-v2-editor.html — layer controls work
- Chinese text renders correctly everywhere

## Known limits
- Grass image is a texture, not a georeferenced aerial view — alignment is approximate
- 7 more art assets in user's Downloads/图形资源 not yet integrated
- Editor has no authentication beyond admin token prompt

## Follow-up
- User will provide more art assets to layer on top of grass
- Consider georeferencing the grass image more precisely
- Consider adding route/area editing (move/delete points) to editor

---

## Update 2026-05-02: Editor synced with user-facing map

### What changed

Editor now renders the same data as the user-facing map (map-v2.js):

1. **Type-specific SVG icons** — location markers show different icons per type (food=utensils, transport=bus, sports=globe, village/life=house, campus=pin), matching map-v2.js `TYPE_COLORS` + `iconSvg()`
2. **Posts layer** — fetches posts from `GET /api/map/v2/items` (public API) and renders as cards with image + title
3. **Cloudinary image proxy** — `displayImageUrl()` routes Cloudinary URLs through `/api/image-proxy`
4. **Post-aware popups** — popups show name, type, and "Open post" button for items with `tid`
5. **API center/zoom** — map initializes with center/zoom from API response instead of hardcoded defaults
6. **Click-to-select** — clicking a location fills the side panel form fields (ID, name, type, icon URL, card settings)
7. **Posts layer toggle** — "帖子图层" checkbox in layer controls

### Files changed

- `public/tools/map-v2-editor.js` — added TYPE_COLORS, iconSvg, displayImageUrl, placeIcon, postIcon, placeCardIcon, popupHtml, selectItem, renderPosts, popupopen handler, posts layer group
- `public/tools/map-v2-editor.html` — added posts layer toggle
- `public/tools/map-v2-editor.css` — replaced old editor icon styles with map-v2 styles (map-v2-place-glyph, map-v2-place-asset, map-v2-post-card, map-v2-location-card, map-v2-popup)

### How to verify

- Editor: http://localhost:4100/tools/map-v2-editor.html
- Locations show type-specific icons (not just first character)
- Posts appear as cards (if any posts have coordinates)
- Click a location → form fields auto-fill
- Layer toggle shows/hides posts
