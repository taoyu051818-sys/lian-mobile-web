# Frontend Shell/Content Architecture

> Issue #302 originally defined the shell/content decomposition for LIAN mobile web.
> Refresh follow-up: #371.
> Related: #273, #275/#292, #276, #277, #278, #307, #308, #309, #318, #319, #320, #321.
> Current merged truth checkpoints: #342, #343, #352, #353, #361.

## 1. Historical Problem Statement

Before the shell/content migration, LIAN's Vue frontend had no formal shell/content decomposition. Ownership boundaries were implicit:

- `App.vue` rendered the shell grid, `BottomTabBar`, and managed bottom chrome state.
- `FeedView.vue` rendered its own fixed top tabs and owned chrome visibility/progress.
- `PostDetailPanel.vue` owned detail topbar and dock surfaces.
- Layout modes (`content`, `full-bleed`, `composer-safe`) were applied as CSS classes on a grid div inside `App.vue`.
- `floating-chrome.css` mixed transitional intent and no-motion overrides in ways that made the real lifecycle hard to read.

This made it hard to reason about transitions, detail handoff, and which component owns which DOM. Pages reached into shell concerns; the shell reached into page chrome.

**Status:** The core decomposition is implemented on `main`, and the runtime truth now extends beyond the earlier `#338` checkpoint. The shell/content contract should be read from the merged runtime behavior, not from older migration-era docs.

## 2. Architecture Model

LIAN follows a stable shell/content layering model:

| Layer | Role in LIAN |
|---|---|
| App bootstrap | `App.vue` is a thin mount wrapper |
| Shell composition | `AppShell.vue` owns the page frame and shell composition |
| Persistent chrome | `ShellChrome.vue` owns top and bottom shell regions |
| Content frame | `ContentFrame.vue` owns layout modes and safe-area framing |
| Page surface | Page views own feature content and feature state |
| Detail overlay | `DetailSheet.vue` is the shell-level overlay container, though some views still render details inline |

The governing rule remains:

> **Pages own feature content. The shell owns chrome, frame, and persistent overlay infrastructure.**

## 3. Current Component Tree (main after #361)

```
App.vue                              <- thin bootstrap
└── AppShell.vue                     <- shell composition owner
    ├── ShellChrome.vue [top]        <- shell-owned top region renderer
    │   └── renders typed tab specs or button specs from useShellChrome state
    ├── ContentFrame.vue             <- shell-owned frame and layout mode owner
    │   └── PageSurface.vue          <- content wrapper used by AppShell
    │       └── AppViewHost.vue      <- active page switcher
    │           ├── FeedView.vue     <- page-owned feed content, declares top tabs via shell spec
    │           ├── MapLeafletView.vue <- page-owned map content, declares top/bottom chrome via composable
    │           ├── PublishView.vue  <- page-owned publish content and local publish action bar
    │           ├── MessagesView.vue <- page-owned messages content with shell-declared tabs/composer chrome
    │           └── ProfileView.vue  <- page-owned profile content, declares top actions via shell spec
    ├── ShellChrome.vue [bottom]     <- shell-owned bottom region renderer
    │   └── BottomTabBar.vue         <- shell default bottom navigation
    └── ToastHost.vue

DetailSheet.vue                      <- shell-level overlay primitive, exported and available
```

### Merged checkpoints that changed the runtime truth

| PR | Runtime truth now on `main` |
|---|---|
| #342 | Chrome transition lifecycle is real: `visible -> exiting -> entering -> visible`, with reduced-motion preserving the sequence at zero-duration. |
| #343 | ShellChrome owns top tab rendering through a typed `tabs` spec; Feed no longer injects top tabs with `Teleport`. |
| #352 | Map selection/detail orchestration is more page-scoped and composable, reinforcing page-owned feature state under shell-owned frame/chrome. |
| #353 | Publish actions moved back inside `PublishView` via `PublishActionBar`; shell keeps the global bottom tab bar visible. |
| #361 | Messages content/UI evolution continues inside the page layer; shell/content ownership remains unchanged by that follow-up. |

## 4. Current Chrome Integration by View

| View | Declares shell chrome via `useShellChrome()` or wrapper | Renders fixed shell chrome DOM itself | Owns feature-local action/content UI | Layout mode |
|---|---|---|---|---|
| FeedView | Yes, top region typed tabs | No | Yes, feed list/detail interactions remain page-owned | `content` |
| MapLeafletView | Yes, via `useMapChrome()` | No | Yes, map interactions and selection state are page-owned | `full-bleed` |
| PublishView | No page-specific publish/clear actions are routed through shell chrome | No | Yes, `PublishActionBar` is local to the page | `content` |
| MessagesView | Yes, top and bottom regions | No | Yes, message content and channel surfaces stay page-owned | `composer-safe` |
| ProfileView | Yes, top region | No | Yes, profile content and edit flows remain page-owned | `content` |

### Current integration patterns

**Primary pattern: declarative shell specs.** Views declare top/bottom chrome through `useShellChrome()` or a small wrapper around it. `ShellChrome.vue` renders those regions.

**Typed tabs are shell-owned.** Feed top tabs now flow through the `tabs` spec rendered by `ShellChrome.vue`; the older Teleport-based top-tab pattern is historical only.

**Page-local actions stay in the page when they are not global chrome.** `PublishView` now owns its clear/publish action bar locally instead of routing that feature-specific UI through the shell bottom region.

## 5. Component Definitions (Current)

### 5.1 `App.vue`

Thin bootstrap wrapper. Responsibilities:

- mount the Vue app
- provide app-level setup and error boundaries
- render `AppShell` as the runtime shell

It does not own shell chrome state, page routing policy, or layout switching logic directly.

### 5.2 `AppShell.vue`

Shell composition owner. Responsibilities:

- render `ShellChrome[top]`, `ContentFrame`, and `ShellChrome[bottom]`
- keep shell-level chrome composition stable while views change
- manage bottom-tab visibility/lifecycle through floating chrome state
- coordinate shell-owned frame behavior around active view changes

### 5.3 `ShellChrome.vue`

Persistent chrome region renderer. Responsibilities:

- render shell regions from `useShellChrome()` state
- render typed tabs when a region provides a `tabs` spec
- render button bars when a region provides button specs
- bind chrome phase state to `data-floating-state`
- disable interaction during entering/exiting transitions

This is the important current truth change from the old doc: top tabs are now rendered by the shell itself, not injected into shell DOM through `Teleport`.

### 5.4 `ContentFrame.vue`

Shell-owned content frame. Responsibilities:

- apply layout mode (`content`, `full-bleed`, `composer-safe`)
- own frame padding, width constraints, and safe-area behavior
- keep frame-level layout decisions out of individual pages

### 5.5 `DetailSheet.vue`

Shell-level detail overlay primitive. Responsibilities:

- provide the reusable shell container for detail overlays
- keep overlay infrastructure out of page-specific layout code
- support keyboard/backdrop behaviors centrally

**Current status:** the primitive exists and is part of the shell architecture, but full adoption across page detail surfaces is still follow-up work.

### 5.6 Page Views

Page responsibilities remain:

- own feature content, feature state, and page-specific interactions
- declare shell chrome needs rather than rendering shell chrome directly
- keep feature-specific inline surfaces local unless/until they move into shared shell overlay infrastructure

## 6. Ownership Rules

| Concern | Owner | Current note |
|---|---|---|
| Shell composition | `AppShell` | Stable on `main` |
| Top chrome rendering | `ShellChrome` | Feed/message tabs render through typed shell specs |
| Bottom shell navigation | `AppShell` + `ShellChrome` | Global bottom nav remains shell-owned |
| Page-specific action bars | Page views when feature-local | Publish actions are local to `PublishView` after #353 |
| Layout mode | `ContentFrame` | Stable on `main` |
| Scroll and safe-area framing | `ContentFrame` | Stable on `main` |
| Detail overlay infrastructure | `DetailSheet` | Available, but not yet the only detail path |
| Feature business logic | Page views/composables | Feed/map/messages/profile state remains page-owned |

### Rules

1. Pages should declare shell chrome, not render their own shell-level fixed bars.
2. Shell-level chrome should stay reusable and feature-agnostic.
3. Feature-local controls should stay inside the page unless they truly represent shared shell chrome.
4. Layout mode should be declared through the frame, not by mutating shell classes from pages.
5. Detail overlay infrastructure belongs to the shell, while detail content belongs to the feature surface.

## 7. Known Remaining Deviations and Follow-up Work

These are the real remaining gaps. They should not be confused with already-merged work.

| Item | Status | Notes |
|---|---|---|
| DetailSheet adoption by feature views | Open follow-up | Feed and map-related detail surfaces are still not fully routed through `DetailSheet`. |
| Feed internal floating-chrome consolidation | Open follow-up | Feed still owns feature-local floating chrome coordination for its internal detail behavior. |
| Some migration-era docs and issue references | Open follow-up | This issue #371 exists because older docs kept teaching superseded runtime patterns. |

### Historical items that are no longer current runtime truth

- Feed top tabs using `Teleport` into `ShellChrome` are no longer current after #343.
- `usePublishChromeActions()` as the active publish action path is no longer current after #353; `PublishActionBar` is the live page-owned path.
- Chrome transition phases as "reserved" or effectively collapsed are no longer current after #342.

## 8. Current ShellChrome Region Shape

```ts
interface ChromeButtonSpec {
  id: string;
  label: string;
  icon?: string;
  variant?: "ghost" | "tonal" | "danger";
  disabled?: boolean;
}

interface ChromeTabItem {
  id: string;
  label: string;
}

interface ChromeTabSpec {
  kind: "tabs";
  items: ChromeTabItem[];
  activeKey: string;
  ariaLabel?: string;
  floatingState?: string;
}

interface ShellChromeRegionSpec {
  buttons?: ChromeButtonSpec[];
  visible?: boolean;
  slot?: string;
  tabs?: ChromeTabSpec | null;
  onTabSelect?: ((tabId: string) => void) | null;
}
```

This matters because the older doc described only `slot: "tabs"` for top-tab ownership. That is now incomplete. The current runtime path uses typed tab specs for shell-owned top tab rendering.

## 9. Transition Lifecycle Truth

The current shell transition model is no longer "instant only" in the way the old doc described.

### Current merged lifecycle

```text
visible -> exiting -> entering -> visible
```

Notes:

- `useFloatingChromeController.transitionSpec()` drives the lifecycle.
- Interaction is disabled during `exiting` and `entering`.
- Reduced-motion preserves the same phase sequence with zero-duration transitions.
- Direct `show()` / `hide()` still exist for immediate transitions where appropriate.

This is shipped runtime truth after #342 and should be documented as such.

## 10. Migration Status

The core shell/content migration is complete, but the architecture is not "finished forever." The truthful status is:

- Shell composition, frame ownership, and declarative page-to-shell chrome contracts are shipped.
- Feed top-tab shell ownership is shipped.
- Publish action ownership is corrected and shipped locally in the page.
- The shell transition lifecycle is shipped.
- Some follow-up cleanup/adoption work remains, especially around detail-surface consolidation and keeping docs aligned with runtime truth.

## 11. Safe Parallel Work Guidance

Work that is safe to do without reopening the architecture model:

- docs refreshes that describe current merged ownership truth
- focused detail-surface adoption slices that move a page from inline overlays toward `DetailSheet`
- bounded feature-page cleanup that keeps shell/page ownership unchanged

Work that should not be implied as already complete:

- full DetailSheet adoption across all views
- elimination of all page-local floating behavior inside Feed
- broad claim that every historical migration follow-up is closed

## 12. Folder Structure (Current High-Level View)

```text
src/
  App.vue
  shell/
    AppShell.vue
    ShellChrome.vue
    useShellChrome.ts
    shell-chrome.css
    shell-chrome-types.ts
    ContentFrame.vue
    DetailSheet.vue
    useDetailSheet.ts
    index.ts
  ui/
    layout/PageSurface.vue
  views/
    FeedView.vue
    MapLeafletView.vue
    MessagesView.vue
    ProfileView.vue
    PublishView.vue
    map/useMapSelection.ts
    publish/PublishActionBar.vue
```

## 13. Practical Reading Guide

If you want to understand the current runtime quickly, read the code in this order:

1. `src/shell/AppShell.vue`
2. `src/shell/ShellChrome.vue`
3. `src/shell/shell-chrome-types.ts`
4. `src/views/FeedView.vue`
5. `src/views/PublishView.vue`
6. `src/views/MapLeafletView.vue`
7. `src/views/MessagesView.vue`

That order reflects the shipped ownership split more accurately than the older migration-era explanation.

## 14. Issue Linkage

- Related to #371.
- Contributes to #371.
- Does not close #371.
