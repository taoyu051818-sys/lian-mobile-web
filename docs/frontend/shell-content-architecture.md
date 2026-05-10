# Frontend Shell/Content Architecture

> Issue #302 — defines the component decomposition for LIAN mobile web.
> Related: #273 (ShellChrome direction), #275/#292 (ShellChrome foundation), #276 (BottomTabBar migration), #277 (Feed top tabs migration), #278 (chrome transition lifecycle), #307 (ContentFrame), #308 (DetailSheet), #309 (AppShell), #318 (Publish actions), #319 (Messages chrome), #320 (Map chrome), #321 (Profile chrome).

## 1. Problem Statement (Historical)

Before the shell/content migration, LIAN's Vue frontend had no formal shell/content decomposition. Ownership boundaries were implicit:

- `App.vue` rendered the shell grid, `BottomTabBar`, and managed bottom chrome state.
- `FeedView.vue` rendered its own fixed top tabs and owned chrome visibility/progress.
- `PostDetailPanel.vue` owned detail topbar and dock surfaces.
- Layout modes (`content`, `full-bleed`, `composer-safe`) were applied as CSS classes on a grid div inside `App.vue`.
- `floating-chrome.css` mixed motion-capable phase styles with a no-motion override block.

This made it hard to reason about transitions, detail handoff, and which component owns which DOM. Pages reached into shell concerns; the shell reached into page chrome.

**Status:** This decomposition is now implemented. All shell/content migration PRs through #338 are merged to main.

## 2. Architecture Model (Apple Music Pattern)

LIAN's architecture follows the same structural pattern as Apple Music's iOS app, applied to Vue's component model:

| Layer | Apple Music equivalent | LIAN implementation |
|---|---|---|
| App bootstrap | `UIApplicationDelegate` | `App.vue` — thin mount wrapper |
| Shell composition | `UITabBarController` + nav chrome | `AppShell.vue` — owns region composition |
| Persistent chrome | Navigation bar / tab bar | `ShellChrome` — shell-owned top + bottom regions |
| Content frame | Content area with safe-area / layout modes | `ContentFrame` — scroll, safe-area, layout mode |
| Page surface | Individual tab content | Page components (Feed, Map, etc.) |
| Detail overlay | Modal / push detail sheet | `DetailSheet` — shell-level persistent overlay |

The key architectural principle:

> **Pages own content. Shell owns chrome, frame, and overlays.**

This is not about copying Apple Music's UI. It is about adopting the same layering that makes iOS apps maintainable: a stable shell that owns layout infrastructure, and pages that are pure content providers.

## 3. Current Component Tree (as of PR #338)

```
App.vue                              ← thin bootstrap: mount, provide, error boundary
└── AppShell.vue                     ← shell composition owner
    ├── ShellChrome.vue [top]        ← shell-owned persistent top region
    │   └── (slot: page-provided chrome content via Teleport / useShellChrome)
    ├── ContentFrame.vue             ← shell-owned content area
    │   ├── PageSurface.vue          ← content surface wrapper (padding, bleed)
    │   │   └── AppViewHost.vue      ← dynamic page switcher
    │   │       ├── FeedView.vue     ← provides top chrome spec (tabs), owns content
    │   │       ├── MapLeafletView.vue ← provides top (filters) + bottom (actions) chrome
    │   │       ├── PublishView.vue  ← provides bottom chrome spec (Clear/Publish actions)
    │   │       ├── MessagesView.vue ← provides top (tabs) + bottom (composer) chrome
    │   │       └── ProfileView.vue  ← provides top chrome spec (edit/logout actions)
    ├── ShellChrome.vue [bottom]     ← shell-owned persistent bottom region
    │   └── BottomTabBar.vue         ← rendered in tabs mode
    └── ToastHost.vue                ← outside content frame

DetailSheet.vue                      ← shell-level overlay (Teleport to body)
    └── (slot: post detail / place sheet / profile editor / image preview)
```

### What was migrated

| Phase | PR | Issue | Status |
|---|---|---|---|
| ShellChrome foundation | #292 | #275 | **MERGED** |
| BottomTabBar into ShellChrome bottom | #326 | #276 | **MERGED** |
| Feed top tabs into ShellChrome top | #335 | #277 | **MERGED** |
| ContentFrame | #330 | #307 | **MERGED** |
| DetailSheet foundation | #334 | #308 | **MERGED** |
| AppShell extraction | #332 | #309 | **MERGED** |
| Profile chrome spec | #333 | #321 | **MERGED** |
| Publish actions into bottom chrome | #336 | #318 | **MERGED** |
| Map filters/actions into chrome | #337 | #320 | **MERGED** |
| Messages tabs/composer into chrome | #338 | #319 | **MERGED** |

## 4. Per-View Chrome Integration

| View | `useShellChrome()` | Emits `chrome` event | Teleport to ShellChrome | Own floating chrome | Layout mode |
|---|---|---|---|---|---|
| FeedView | Yes (top region) | Yes | Yes (top tabs) | Yes (2 controllers) | `content` |
| MapLeafletView | Yes (via `useMapChrome`) | No | No | No | `full-bleed` |
| PublishView | Yes (via `usePublishChromeActions`) | Yes | No | No | `content` |
| MessagesView | Yes (top + bottom) | Yes | No | No | `composer-safe` |
| ProfileView | Yes (top region) | No | No | No | `content` |

### Chrome integration patterns

**Centralized ShellChrome pattern (primary):** Views call `useShellChrome()` to declaratively configure top/bottom regions. `ShellChrome.vue` renders those regions. Used by all five views.

**Teleport pattern (FeedView):** FeedView uses `Teleport to="aside.shell-chrome--top"` to inject feed category tabs into the top ShellChrome region. This coexists with the declarative `useShellChrome()` spec.

**Composable wrappers:** Some views use domain-specific composables that wrap `useShellChrome()`:
- `useMapChrome()` — configures top (filter buttons) and bottom (place action buttons) for the map
- `usePublishChromeActions()` — configures bottom region with "Clear" and "Publish" buttons

## 5. Component Definitions

### 5.1 `App.vue`

Thin bootstrap wrapper. Responsibilities:

- `createApp`, provide/inject, mount to `#vue-root`
- Global error boundary
- Renders `AppShell` and `ToastHost`

Does **not** own chrome state, layout mode switching, or view routing directly.

### 5.2 `AppShell.vue`

Shell composition owner. Responsibilities:

- Renders `ShellChrome[top]`, `ContentFrame`, `ShellChrome[bottom]` in correct z-order
- Manages app-level chrome state (bottom bar visibility for detail open/close)
- Coordinates chrome handoff when active view changes
- Manages `useFloatingChromeController` for the bottom tab bar's show/hide state

Props: `activeViewKey` (AppViewKey), `layoutMode` (ShellLayoutMode), `tabs` (AppShellTab[]).

### 5.3 `ShellChrome.vue`

Persistent chrome region renderer. Two instances: top and bottom.

Responsibilities:

- Renders region content based on active chrome spec from `useShellChrome()`
- Manages region visibility, safe-area insets, z-index
- Two rendering modes:
  - **Tabs mode** (`slot === "tabs"`): passes through a `<slot />` for parent-injected tab content
  - **Button mode**: renders a button bar from `ChromeButtonSpec[]` in the chrome state
- Emits `button-click` events for action buttons

Props: `region: "top" | "bottom"`.

Companion composable: `useShellChrome()` — module-level singleton reactive store. Exposes `setRegion(key, spec)`, `applyRegions(map)`, and `resetRegions()`.

### 5.4 `ContentFrame.vue`

Shell-owned content area. Responsibilities:

- Applies layout mode (`content`, `full-bleed`, `composer-safe`) as CSS modifier classes
- Constrains content width (default `min(100%, 760px)`)
- Full-bleed removes max-width; composer-safe adds bottom padding

Props: `layoutMode: ShellLayoutMode`.

### 5.5 `PageSurface.vue`

Generic content surface wrapper (UI primitive). Responsibilities:

- Applies standard padding and bleed behavior
- Configurable element tag (`as` prop)
- `bleed` and `padded` boolean props

Used inside ContentFrame by AppShell with `as="div" :padded="false"`.

### 5.6 `DetailSheet.vue`

Shell-level persistent overlay for detail surfaces. Responsibilities:

- Teleports to `<body>` and renders when `state.open === true`
- Shows backdrop + slide-up panel with header and scrollable body
- Keyboard support: Escape key closes the sheet
- Slot exposes `kind` and `payload` from the state

Companion composable: `useDetailSheet()` — module-level singleton. Exposes `open(kind, payload)` and `close()`.

Payload kinds: `DetailSheetPostPayload` (postId), `DetailSheetPlacePayload` (placeId), `DetailSheetProfilePayload` (actorId).

**Note:** DetailSheet is defined and exported from the shell barrel but is not yet adopted by view components. FeedView, MapLeafletView, and MapView currently render their detail panels inline. Migration to DetailSheet is a follow-up task.

### 5.7 Page Components

Page responsibilities:

- Provide a chrome spec via `useShellChrome()` composable (or domain-specific wrapper)
- Render page content only (no chrome DOM in most cases)
- Open detail surfaces (currently inline; DetailSheet adoption is a follow-up)

## 6. Ownership Rules

| Concern | Owner | Notes |
|---|---|---|
| Shell composition | `AppShell` | Renders chrome regions + content frame |
| Top chrome content | Active page (via spec) | Page declares what top chrome shows |
| Bottom chrome content | Active page (via spec) or shell default | Tab bar is shell default; composer/actions are page-specific |
| Layout mode | `ContentFrame` | Derived from active view's declared mode |
| Scroll / safe-area | `ContentFrame` | Shell owns the scroll container |
| Detail overlays | `DetailSheet` + page content component | Shell owns container, page owns content (pending adoption) |
| Chrome transition lifecycle | `ShellChrome` | Shell owns phase machine, pages trigger |
| Design tokens | `lian-tokens.css` | Unchanged — shared across all layers |
| Page business logic | Page components | Fetch, state, interactions |

### Rules

1. **Pages never render fixed-position chrome.** All floating bars are ShellChrome regions.
2. **Pages never render detail overlays.** All overlays are DetailSheet modes.
3. **Pages never mutate shell CSS classes.** Layout mode is declared, not applied.
4. **Shell never imports page components.** Shell renders specs and slots.
5. **DetailSheet never imports page detail components.** Pages register themselves as sheet content providers.

### Known deviations from ownership rules

| Deviation | Where | Issue |
|---|---|---|
| FeedView renders `PostDetailPanel` inline (not via DetailSheet) | `src/views/FeedView.vue` | Follow-up |
| FeedView owns two `useFloatingChromeController` instances for internal chrome | `src/views/FeedView.vue` | Follow-up |
| MessagesView previously bypassed ShellChrome (now migrated as of #338) | Resolved | — |
| `usePublishChromeActions` uses MutationObserver to wire button click handlers | `src/views/publish/usePublishChromeActions.ts` | Gap in ShellChrome event API |

## 7. ChromeSpec Type (Current Implementation)

```typescript
// src/shell/shell-chrome-types.ts
type ShellRegionKey = "top" | "bottom";

interface ChromeButtonSpec {
  id: string;
  label: string;
  icon?: string;
  variant?: "ghost" | "tonal" | "danger";
  disabled?: boolean;
}

interface ShellChromeRegionSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  slot?: "tabs";
}

interface ShellChromeState {
  top: ShellChromeRegionSpec;
  bottom: ShellChromeRegionSpec;
}
```

The `useShellChrome()` composable provides `setRegion(key, spec)`, `applyRegions(map)`, and `resetRegions()`. Pages call these to declare their chrome needs; ShellChrome renders accordingly.

## 8. Migration Status

All eight migration phases are complete. The shell/content architecture is fully implemented.

### Completed phases

| Phase | PR | Issue | Description |
|---|---|---|---|
| 1. ShellChrome foundation | #292 | #275 | `src/shell/` module with `ShellChrome.vue`, `useShellChrome.ts`, region spec types |
| 2. BottomTabBar migration | #326 | #276 | BottomTabBar rendered through ShellChrome bottom `tabs` mode |
| 3. Feed top tabs migration | #335 | #277 | Feed top tabs moved from FeedView fixed DOM into ShellChrome top region |
| 4. ContentFrame | #330 | #307 | ContentFrame wraps AppViewHost with layout-mode CSS |
| 5. DetailSheet foundation | #334 | #308 | Shell-level DetailSheet with backdrop, keyboard, slot-based content |
| 6. AppShell extraction | #332 | #309 | AppShell.vue owns shell composition; App.vue is thin bootstrap |
| 7. Profile chrome | #333 | #321 | ProfileView declares top chrome spec via useShellChrome() |
| 8. Page chrome migration | #336–#338 | #318–#320 | Publish, Map, Messages migrated to ShellChrome |

## 9. Remaining Issues

### #274 — Motion layer cleanup

`src/styles/floating-chrome.css` contains conflicting motion-capable and no-motion override blocks. The first part defines motion phases (entering/exiting with blur/scale/translate transitions); a later block forces `--floating-chrome-motion-duration: 0ms` and `transition: none !important`. This needs cleanup: either commit to no-motion until #278 lands, or quarantine the motion-capable code behind a flag.

### #278 — Chrome transition lifecycle

Implement shell-owned `visible -> exiting -> swap -> entering -> visible` lifecycle for chrome spec changes. Currently, chrome transitions are instant (no animated handoff between page chrome specs). Reduced-motion users should keep the same state sequence while skipping movement/blur animations. Depends on #274 motion cleanup.

### #281 — FloatingChromePhase narrowing

`src/motion/floatingChrome.ts` exposes phases (`visible`, `exiting`, `hidden`, `entering`, `progress`) but the controller largely collapses `entering` to visible and `exiting` to hidden. The public type suggests a lifecycle that does not actually run. This should be narrowed to implemented behavior or documented as deferred until #278.

## 10. Dependency Graph (Historical)

```
#275 / PR #292  ShellChrome foundation                    ✓ MERGED
    ├── #276  BottomTabBar migration                      ✓ MERGED (#326)
    ├── #277  Feed top tabs migration                     ✓ MERGED (#335)
    ├── #307  ContentFrame                                ✓ MERGED (#330)
    └── #308  DetailSheet                                 ✓ MERGED (#334)
    └── #309  AppShell extraction                         ✓ MERGED (#332)

#276 + #277 ──→ #278  Chrome transition lifecycle         OPEN

#292 + #307 ──→ #309  AppShell extraction                 ✓ MERGED (#332)

All above ──→ Page chrome migration (#321, #318, #320, #319)  ✓ MERGED

#274  Motion cleanup ──→ #278  Chrome transition lifecycle    OPEN
#274 ──→ #281  FloatingChromePhase narrowing                 OPEN
```

## 11. Safe Parallel Work vs Blocked Work

### All core migration work is complete

The shell/content architecture is fully implemented. All views use `useShellChrome()`. AppShell, ShellChrome, ContentFrame, DetailSheet, and PageSurface are all in place.

### Remaining follow-up work

| Work | Issue | Status |
|---|---|---|
| Motion layer cleanup | #274 | **OPEN** — remove conflicting floating-chrome.css blocks |
| Chrome transition lifecycle | #278 | **OPEN** — depends on #274 |
| FloatingChromePhase narrowing | #281 | **OPEN** — depends on #274 |
| DetailSheet adoption by views | — | **OPEN** — views still render detail panels inline |
| FeedView floating chrome consolidation | — | **OPEN** — FeedView still owns 2 floating chrome controllers |
| ShellChrome button-click event API | — | **OPEN** — MutationObserver workaround in usePublishChromeActions |

## 12. Migration Safety Rules

1. **Each migration step preserves existing behavior.** No visual or functional regression is acceptable at any step.
2. **ShellChrome regions render empty by default.** Adding a region does not change what users see until a page provides a spec.
3. **Old and new coexist during migration.** Legacy code stays until the new path is verified.
4. **One surface at a time.** Do not migrate multiple chrome surfaces in the same PR.
5. **Tests pass at every step.** `npm run check`, `npm run test:unit`, `npm run build` must pass before merging.
6. **Reduced-motion is tested at every step.** `prefers-reduced-motion: reduce` must not break layout or pointer behavior.

## 13. Folder Structure (Current)

```
src/
  App.vue                        ← thin bootstrap
  shell/
    AppShell.vue                 ← shell composition
    ShellChrome.vue              ← chrome region renderer
    useShellChrome.ts            ← chrome spec composable
    shell-chrome.css             ← chrome region styles
    shell-chrome-types.ts        ← ShellRegionKey, ChromeButtonSpec, ShellChromeRegionSpec
    ContentFrame.vue             ← layout mode + safe-area
    content-frame.css            ← frame styles
    DetailSheet.vue              ← shell-level detail overlay
    useDetailSheet.ts            ← detail sheet composable
    detail-sheet-types.ts        ← DetailSheetPostPayload, PlacePayload, ProfilePayload
    detail-sheet.css             ← sheet styles
    index.ts                     ← barrel export
  ui/
    layout/
      PageSurface.vue            ← content surface wrapper
    Sheet.vue                    ← generic sheet primitive
    ...                          ← other UI primitives
  views/
    FeedView.vue                 ← provides top chrome spec (tabs), owns content
    MapLeafletView.vue           ← provides top + bottom chrome via useMapChrome()
    MessagesView.vue             ← provides top (tabs) + bottom (composer) chrome
    ProfileView.vue              ← provides top chrome spec (edit/logout actions)
    PublishView.vue              ← provides bottom chrome spec via usePublishChromeActions()
  styles/                        ← tokens, motion (unchanged)
  api/                           ← API layer (unchanged)
  types/                         ← shared types (unchanged)
```

## 14. Apple Music Comparison

This section explains the architectural parallels without implying UI similarity.

### What Apple Music does

Apple Music's iOS app uses a `UITabBarController` as the shell. Each tab is a `UINavigationController`. The tab bar and navigation bar are owned by the system, not by individual view controllers. Detail views (album, playlist, artist) are presented as modal sheets or push transitions managed by the navigation controller, not by the content view controller.

### What LIAN adopts

- **Shell owns chrome:** Just as `UITabBarController` owns the tab bar, `AppShell` owns ShellChrome regions. Pages declare what they need; the shell renders it.
- **Shell owns the content frame:** Just as the tab controller manages the content area, `ContentFrame` manages layout modes and safe-area.
- **Shell owns detail overlays:** Just as navigation controllers manage push/modal presentation, `DetailSheet` manages detail surfaces.
- **Pages are content providers:** Just as view controllers provide `viewDidLoad` content, LIAN pages provide content and chrome specs.

### What LIAN does NOT adopt

- No navigation controller stack (LIAN uses a single-level view switcher, not push/pop navigation).
- No UIKit styling or layout system (LIAN uses CSS custom properties and Vue's reactivity).
- No Apple Music UI patterns (album art, Now Playing bar, etc.) — this is purely a structural pattern.

The value is in the decomposition, not the aesthetics.
