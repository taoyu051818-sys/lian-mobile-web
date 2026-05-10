# Frontend Shell/Content Architecture

> Issue #302 — defines the target component decomposition for LIAN mobile web.
> Related: #273 (ShellChrome direction), #275/#292 (ShellChrome foundation), #276 (BottomTabBar migration), #277 (Feed top tabs migration), #278 (chrome transition lifecycle), #307 (ContentFrame), #308 (DetailSheet), #309 (AppShell).

## 1. Problem Statement

Today LIAN's Vue frontend has no formal shell/content decomposition. Ownership boundaries are implicit:

- `App.vue` renders the shell grid, `BottomTabBar`, and manages bottom chrome state.
- `FeedView.vue` renders its own fixed top tabs and owns chrome visibility/progress.
- `PostDetailPanel.vue` owns detail topbar and dock surfaces.
- Layout modes (`content`, `full-bleed`, `composer-safe`) are applied as CSS classes on a grid div inside `App.vue`.
- `floating-chrome.css` mixes motion-capable phase styles with a no-motion override block.

This makes it hard to reason about transitions, detail handoff, and which component owns which DOM. Pages reach into shell concerns; the shell reaches into page chrome.

## 2. Architecture Model (Apple Music Pattern)

LIAN's target architecture follows the same structural pattern as Apple Music's iOS app, applied to Vue's component model:

| Layer | Apple Music equivalent | LIAN target |
|---|---|---|
| App bootstrap | `UIApplicationDelegate` | `App.vue` — thin mount wrapper |
| Shell composition | `UITabBarController` + nav chrome | `AppShell.vue` — owns region composition |
| Persistent chrome | Navigation bar / tab bar | `ShellChrome` — shell-owned top + bottom regions |
| Content frame | Content area with safe-area / layout modes | `ContentFrame` — scroll, safe-area, layout mode |
| Page surface | Individual tab content | `PageSurface` components (Feed, Map, etc.) |
| Detail overlay | Modal / push detail sheet | `DetailSheet` — shell-level persistent overlay |

The key architectural principle:

> **Pages own content. Shell owns chrome, frame, and overlays.**

This is not about copying Apple Music's UI. It is about adopting the same layering that makes iOS apps maintainable: a stable shell that owns layout infrastructure, and pages that are pure content providers.

## 3. Current Component Tree

```
App.vue                              ← shell grid + chrome state + toast
├── main.vue-shell__grid             ← CSS class switches on ShellLayoutMode
│   └── AppViewHost.vue              ← dynamic component switcher
│       ├── FeedView.vue             ← owns top tabs chrome, detail open/close
│       │   ├── FeedItemCard.vue
│       │   ├── FeedAutoLoadSentinel.vue
│       │   └── PostDetailPanel.vue  ← owns detail topbar + dock chrome
│       ├── MapLeafletView.vue       ← lazy-loaded
│       ├── PublishView.vue          ← lazy-loaded
│       ├── MessagesView.vue         ← lazy-loaded
│       └── ProfileView.vue          ← lazy-loaded
│           ├── ProfileSummary.vue
│           ├── ProfileEditorPanel.vue
│           └── AuthPanel.vue
├── BottomTabBar.vue                 ← one-off fixed floating chrome
└── ToastHost.vue                    ← outside shell grid
```

### Current problems

| Problem | Where it lives |
|---|---|
| Pages control floating chrome state | FeedView emits `chrome` events to App.vue |
| Detail surfaces are page-owned fixed panels | PostDetailPanel renders its own topbar/dock |
| Layout mode is a CSS class on a generic grid div | `App.vue` applies `vue-shell__grid--{mode}` |
| No typed chrome spec — pages use imperative emit | FeedView `emit("chrome", true)` |
| BottomTabBar is outside the chrome system | One-off fixed element in App.vue |

## 4. Target Component Tree

```
App.vue                              ← thin bootstrap: mount, provide, error boundary
└── AppShell.vue                     ← shell composition owner
    ├── ShellChrome.vue [top]        ← shell-owned persistent top region
    │   └── (slot: page-provided chrome content via ChromeSpec)
    ├── ContentFrame.vue             ← shell-owned content area
    │   └── AppViewHost.vue          ← dynamic page switcher (unchanged)
    │       ├── FeedView.vue         ← provides chrome spec, owns only content
    │       ├── MapLeafletView.vue   ← provides chrome spec
    │       ├── PublishView.vue      ← provides chrome spec
    │       ├── MessagesView.vue     ← provides chrome spec
    │       └── ProfileView.vue      ← provides chrome spec
    ├── ShellChrome.vue [bottom]     ← shell-owned persistent bottom region
    │   └── (slot: tabs / composer / actions / none)
    └── ToastHost.vue                ← outside content frame

DetailSheet.vue                      ← shell-level overlay (separate from AppShell tree)
    └── (slot: post detail / place sheet / profile editor / image preview)
```

### What changed

| Current | Target | Why |
|---|---|---|
| `App.vue` owns everything | `App.vue` is a thin wrapper | Separation of concerns |
| No `AppShell` | `AppShell.vue` owns shell composition | Single owner for chrome + frame |
| No `ShellChrome` | `ShellChrome.vue` owns top + bottom regions | Pages declare, shell renders |
| No `ContentFrame` | `ContentFrame.vue` owns layout modes | One frame, one set of layout rules |
| Pages render detail panels inline | `DetailSheet` is shell-level overlay | Consistent focus, safe-area, close behavior |
| No typed chrome spec | `useShellChrome` composable + `ChromeSpec` type | Declarative, testable chrome contract |

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

Props: none (reads active view from `useActiveView`).
Slots: none (composition is internal).

### 5.3 `ShellChrome.vue`

Persistent chrome region renderer. Two instances: top and bottom.

Responsibilities:

- Renders region content based on active `ChromeSpec`
- Manages region visibility, safe-area insets, z-index
- Drives the chrome transition lifecycle: `visible -> exiting -> swap -> entering -> visible`
- Respects `prefers-reduced-motion`

Props: `region: "top" | "bottom"`, `spec: ChromeSpec`.
Slots: fallback content per mode (tabs, title, actions, composer, none).

### 5.4 `ContentFrame.vue`

Shell-owned content area. Responsibilities:

- Applies layout mode (`content`, `full-bleed`, `composer-safe`) as internal CSS
- Manages safe-area padding, scroll container, overflow
- Hosts `AppViewHost` as its content slot

Props: `layoutMode: ShellLayoutMode` (derived from active view).
Slots: default content (the active page).

### 5.5 `DetailSheet`

Shell-level persistent overlay for detail surfaces. Responsibilities:

- Manages overlay z-index, backdrop, safe-area, focus trap, close gesture
- Renders page-provided detail content (post detail, place sheet, profile editor, image preview)
- Coordinates with ShellChrome for detail-specific chrome spec changes
- Respects `prefers-reduced-motion` (no card-camera motion in reduced-motion mode)

Props: `mode: DetailSheetMode`, `content: Component`.
Emits: `close`.

### 5.6 Page Components (FeedView, MapLeafletView, etc.)

Page responsibilities shrink to:

- Provide a `ChromeSpec` via `useShellChrome()` composable
- Render page content only (no chrome DOM, no detail overlay DOM)
- Open detail surfaces by requesting the shell's `DetailSheet`

Page components do **not** render floating chrome, fixed overlays, or layout-mode CSS.

## 6. Ownership Rules

| Concern | Owner | Notes |
|---|---|---|
| Shell composition | `AppShell` | Renders chrome regions + content frame |
| Top chrome content | Active page (via spec) | Page declares what top chrome shows |
| Bottom chrome content | Active page (via spec) or shell default | Tab bar is shell default; composer is page-specific |
| Layout mode | `ContentFrame` | Derived from active view's declared mode |
| Scroll / safe-area | `ContentFrame` | Shell owns the scroll container |
| Detail overlays | `DetailSheet` + page content component | Shell owns container, page owns content |
| Chrome transition lifecycle | `ShellChrome` | Shell owns phase machine, pages trigger |
| Design tokens | `lian-tokens.css` | Unchanged — shared across all layers |
| Page business logic | Page components | Fetch, state, interactions |

### Rules

1. **Pages never render fixed-position chrome.** All floating bars are ShellChrome regions.
2. **Pages never render detail overlays.** All overlays are DetailSheet modes.
3. **Pages never mutate shell CSS classes.** Layout mode is declared, not applied.
4. **Shell never imports page components.** Shell renders specs and slots.
5. **DetailSheet never imports page detail components.** Pages register themselves as sheet content providers.

## 7. ChromeSpec Type

```typescript
type ChromeTopMode = "tabs" | "title" | "search" | "actions" | "none";
type ChromeBottomMode = "tabs" | "composer" | "actions" | "none";

interface ChromeAction {
  id: string;
  icon: LianIconName;
  label: string;
  disabled?: boolean;
  active?: boolean;
}

interface ChromeSpec {
  top?: {
    visible: boolean;
    mode: ChromeTopMode;
    title?: string;
    leading?: ChromeAction[];
    trailing?: ChromeAction[];
  };
  bottom?: {
    visible: boolean;
    mode: ChromeBottomMode;
    actions?: ChromeAction[];
  };
}
```

Pages provide a `ChromeSpec` via `useShellChrome()`. The shell renders the corresponding region content. When the active view changes, the spec changes and the shell transitions chrome.

## 8. Migration Order

Migration is sequenced so each step is independently shippable and does not break existing behavior.

### Phase 1: ShellChrome foundation (PR #292, issue #275) — **IN PROGRESS**

- Add `src/shell/` module with `ShellChrome.vue`, `useShellChrome.ts`, region spec types
- Render ShellChrome top/bottom regions in `App.vue` **alongside** existing `BottomTabBar` (no migration)
- Regions render empty by default — no visual change
- This is the foundation everything else depends on

### Phase 2: BottomTabBar migration (issue #276) — **BLOCKED on #292**

- Move `BottomTabBar` rendering into ShellChrome bottom `tabs` mode
- Remove one-off BottomTabBar from `App.vue`
- Preserve all existing navigation behavior

### Phase 3: Feed top tabs migration (issue #277) — **BLOCKED on #292**

- Move Feed top tabs from `FeedView.vue` fixed DOM into ShellChrome top region
- Feed provides a top chrome spec instead of rendering its own floating chrome root
- Remove duplicate Feed floating chrome lifecycle code

### Phase 4: Chrome transition lifecycle (issue #278) — **BLOCKED on #276, #277**

- Implement `visible -> exiting -> swap -> entering -> visible` lifecycle in ShellChrome
- Resolve `floating-chrome.css` motion-capable vs no-motion conflict
- Ensure `prefers-reduced-motion` skips movement while preserving phase logic

### Phase 5: ContentFrame (issue #307) — **BLOCKED on #292**

- Add `ContentFrame.vue` around `AppViewHost`
- Move layout-mode handling from scattered page CSS into ContentFrame
- Pages stop needing viewport magic numbers

### Phase 6: DetailSheet (issue #308) — **BLOCKED on #292, recommended after #307**

- Add shell-level `DetailSheet` foundation
- Define sheet modes (`post`, `place`, `profile-editor`, `image-preview`)
- Migrate one low-risk sheet (e.g., profile editor) as proof

### Phase 7: AppShell extraction (issue #309) — **BLOCKED on #292, #307**

- Introduce `AppShell.vue` as structural owner
- `App.vue` becomes thin bootstrap wrapper
- Shell composition moves into AppShell

### Phase 8: Page chrome migration — **BLOCKED on all above**

- Migrate remaining pages to provide chrome specs via `useShellChrome()`
- Remove page-owned floating chrome DOM
- Remove legacy `floating-chrome.css` where no longer needed

#### Profile chrome spec integration (#321)

ProfileView now declares its top chrome spec via `useShellChrome()`:

- **Authenticated state**: top region with `slot: "tabs"` and two action buttons (`profile:toggle-editor` tonal, `profile:logout` ghost)
- **Guest state**: chrome reset to defaults via `resetRegions()`
- **Editor toggle**: button label switches between "编辑资料" / "收起编辑"
- **Cleanup**: `resetRegions()` on component unmount

The existing `ProfileActions` and `ProfileTabs` components remain in the view template as the primary UI until ShellChrome button-click events are wired through AppShell to views.

## 9. Dependency Graph

```
#275 / PR #292  ShellChrome foundation
    ├── #276  BottomTabBar migration
    ├── #277  Feed top tabs migration
    ├── #307  ContentFrame
    └── #308  DetailSheet (recommended after #307)
    └── #309  AppShell extraction

#276 + #277 ──→ #278  Chrome transition lifecycle

#292 + #307 ──→ #309  AppShell extraction

All above ──→ Page chrome migration (#321 Profile, remaining views TBD)
```

## 10. Safe Parallel Work vs Blocked Work

### Safe to start now (no dependency on PR #292)

| Work | Why it is safe |
|---|---|
| Design token additions in `lian-tokens.css` | Tokens are shared, additive only |
| New UI primitives in `src/ui/` | Independent of shell decomposition |
| Page content refactors (simplifying FeedView data fetching, etc.) | Does not touch chrome or shell |
| API layer improvements | Independent of shell architecture |
| New composables (non-shell) | No dependency on ShellChrome |
| Accessibility improvements to existing components | Independent of shell decomposition |
| Documentation updates | Docs-only |

### Blocked on PR #292 (issue #275) merge

| Work | Issue | Why blocked |
|---|---|---|
| BottomTabBar into shell chrome | #276 | Needs ShellChrome regions to exist |
| Feed top tabs into shell chrome | #277 | Needs ShellChrome regions to exist |
| ContentFrame | #307 | Touches `App.vue`, shell layout, imports |
| DetailSheet | #308 | Needs ShellChrome for chrome coordination |
| AppShell extraction | #309 | Needs ShellChrome + ContentFrame |
| Chrome transition lifecycle | #278 | Needs at least one surface using ShellChrome |

### Blocked on #276 + #277

| Work | Issue | Why blocked |
|---|---|---|
| Chrome transition lifecycle | #278 | Needs top + bottom surfaces using ShellChrome to test lifecycle |

## 11. Migration Safety Rules

1. **Each migration step preserves existing behavior.** No visual or functional regression is acceptable at any step.
2. **ShellChrome regions render empty by default.** Adding a region does not change what users see until a page provides a spec.
3. **Old and new coexist during migration.** `BottomTabBar` stays in `App.vue` until ShellChrome bottom `tabs` mode is verified. Feed top tabs stay in `FeedView` until ShellChrome top mode is verified.
4. **One surface at a time.** Do not migrate multiple chrome surfaces in the same PR.
5. **Tests pass at every step.** `npm run check`, `npm run test:unit`, `npm run build` must pass before merging.
6. **Reduced-motion is tested at every step.** `prefers-reduced-motion: reduce` must not break layout or pointer behavior.

## 12. Folder Structure (Target)

```
src/
  App.vue                        ← thin bootstrap
  shell/
    AppShell.vue                 ← shell composition
    ShellChrome.vue              ← chrome region renderer
    useShellChrome.ts            ← chrome spec composable
    shell-chrome.css             ← chrome region styles
    chrome-types.ts              ← ChromeSpec, ChromeAction types
  content/
    ContentFrame.vue             ← layout mode + safe-area + scroll
    content-frame.css            ← frame styles
  sheets/
    DetailSheet.vue              ← shell-level detail overlay
    detail-sheet.css             ← sheet styles
  views/                         ← page components (unchanged location)
    FeedView.vue
    MapLeafletView.vue
    MessagesView.vue
    ProfileView.vue
    PublishView.vue
  ui/                            ← primitives (unchanged)
  styles/                        ← tokens, motion (unchanged)
  api/                           ← API layer (unchanged)
  types/                         ← shared types (unchanged)
```

## 13. Apple Music Comparison

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
