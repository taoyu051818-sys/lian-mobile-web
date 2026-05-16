# Frontend Shell/Content Architecture

> Historical source issue: #302.
> Refresh issue: #371.
> Related shell/runtime lanes: #273, #275, #276, #277, #278, #307, #308, #309, #318, #319, #320, #321, #340, #348, #349, #354.

## 1. Current Snapshot

This document describes the current shell/content ownership model on `main` after the original shell/content migration and the follow-up corrections merged through PRs #342, #343, #352, #353, and #361.

The current architectural rule is unchanged:

> **Shell owns app chrome, frame, and shared overlay infrastructure. Pages own feature content and page-local interaction UI.**

What changed since the earlier #302 refresh is the runtime truth around a few important boundaries:

- Feed top tabs are now rendered by `ShellChrome` from typed shell state, not by `FeedView` teleporting DOM into shell-owned markup.
- The shell chrome transition lifecycle is now implemented, including reduced-motion-safe phase handling.
- Publish actions are no longer routed through shell bottom chrome. They live back inside `PublishView` as page-owned actions while the global bottom navigation remains shell-owned and visible.
- Map selection/detail orchestration was narrowed into a map-local composable, which is useful context because it confirms that selection logic remains page-owned rather than becoming a shell concern.
- Messages layout has continued to evolve inside page-owned content; for example, non-self sender identity now sits above the message bubble, which is a page/UI detail rather than shell chrome.

## 2. Why This Architecture Exists

Before the shell/content migration, the Vue frontend mixed shell structure and page behavior too freely:

- `App.vue` owned shell layout directly.
- views rendered their own floating chrome or reached into shell-owned DOM.
- layout modes were applied ad hoc from the app root.
- motion, tabs, detail surfaces, and page actions crossed ownership boundaries.

The refactor introduced a stable shell layer so the app could answer three questions cleanly:

1. Which component owns persistent app chrome?
2. Which component owns content width, layout mode, and safe-area behavior?
3. Which interactions are shell infrastructure versus page-local behavior?

That separation is now the main value of the shell/content architecture doc. It is less a migration plan now and more a truth source for current ownership boundaries.

## 3. Current Component Tree

```
App.vue                              ← thin bootstrap and app mount
└── AppShell.vue                     ← shell composition owner
    ├── ShellChrome.vue [top]        ← shell-owned persistent top region
    │   └── renders typed tab/button chrome from shell state
    ├── ContentFrame.vue             ← shell-owned content frame and layout mode owner
    │   ├── PageSurface.vue          ← generic content surface wrapper
    │   │   └── AppViewHost.vue      ← active page switcher
    │   │       ├── FeedView.vue
    │   │       ├── MapLeafletView.vue
    │   │       ├── PublishView.vue
    │   │       ├── MessagesView.vue
    │   │       └── ProfileView.vue
    ├── ShellChrome.vue [bottom]     ← shell-owned bottom region / tab shell
    │   └── BottomTabBar.vue         ← shell-owned global navigation
    └── ToastHost.vue                ← app-level feedback host

DetailSheet.vue                      ← shell-level overlay infrastructure
    └── page-specific detail content (adoption still partial)
```

### Important current reading of this tree

- `ShellChrome` owns the DOM for shell chrome regions.
- Pages describe shell chrome intent through typed shell state when they need shell chrome.
- Pages still own page-local controls that are part of feature content rather than app chrome.
- `DetailSheet` exists as shell infrastructure, but not every detail flow has migrated onto it yet.

## 4. What Is Shipped Now

### Original shell/content migration shipped

The original foundation and page chrome migration work is merged:

| Area                                             | PR / issue lane | Status                                       |
| ------------------------------------------------ | --------------- | -------------------------------------------- |
| ShellChrome foundation                           | #292 / #275     | merged                                       |
| BottomTabBar through shell bottom region         | #326 / #276     | merged                                       |
| Feed top tabs into shell top region              | #335 / #277     | merged                                       |
| ContentFrame                                     | #330 / #307     | merged                                       |
| DetailSheet foundation                           | #334 / #308     | merged                                       |
| AppShell extraction                              | #332 / #309     | merged                                       |
| Profile shell chrome integration                 | #333 / #321     | merged                                       |
| Publish shell chrome migration (historical step) | #336 / #318     | merged historically, later corrected by #353 |
| Map shell chrome integration                     | #337 / #320     | merged                                       |
| Messages shell chrome integration                | #338 / #319     | merged                                       |

### Post-#338 corrections that matter for current truth

| PR   | Current truth it established                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #342 | Shell chrome transition lifecycle is implemented; reduced-motion keeps the state sequence while skipping motion-heavy effects.                                                                 |
| #343 | Feed top tabs are rendered by `ShellChrome` from typed tab specs; Teleport-based feed tab DOM is no longer the active pattern.                                                                 |
| #352 | Map selection/detail orchestration moved into a map-local composable, confirming that selection state remains page-owned logic rather than shell infrastructure.                               |
| #353 | Publish actions moved back into `PublishView`; `usePublishChromeActions` is gone, and the shell keeps owning global bottom navigation instead of swapping it out for publish-specific actions. |
| #361 | Messages continued page-level UI refinement; sender identity placement above non-self bubbles is page content truth, not shell chrome truth.                                                   |

## 5. Ownership Model

| Concern                                    | Owner                            | Notes                                                                                                     |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| App shell composition                      | `AppShell.vue`                   | Owns shell structure and region composition.                                                              |
| Persistent top and bottom chrome           | `ShellChrome.vue`                | Owns shell chrome DOM and rendering behavior.                                                             |
| Global bottom navigation                   | shell                            | `BottomTabBar` remains shell-owned global navigation.                                                     |
| Layout mode and content frame              | `ContentFrame.vue`               | Owns safe-area/layout framing for page surfaces.                                                          |
| Page business logic and page content       | page components                  | Data loading, feature workflows, and view-specific content remain page-owned.                             |
| Page-local action UI                       | page components                  | Example: publish clear/submit actions now live inside `PublishView` again.                                |
| Shared overlay infrastructure              | `DetailSheet.vue`                | Shell owns the overlay container contract.                                                                |
| Detail content                             | page/detail components           | Pages still own the actual feature-specific detail bodies.                                                |
| Toast/feedback host                        | shell/app layer                  | Shared app feedback infrastructure.                                                                       |
| View-local selection/composer/detail state | page-local composables and views | Example: map selection remains in map-local code; messaging bubble layout remains in messages-local code. |

### Rules of thumb

1. If a UI surface is global, persistent across views, or part of app framing, it belongs to the shell.
2. If a UI surface is feature-specific and meaningful only inside one page workflow, it belongs to that page even if it looks visually prominent.
3. Pages may declare shell chrome intent, but they should not reach into shell-owned DOM to render it.
4. The shell should not absorb feature workflows just because they touch top/bottom edges of the viewport.

## 6. Per-View Ownership Summary

| View           | Current shell-chrome relationship                                            | Page-owned content relationship                                                                           | Notes                                                                  |
| -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| FeedView       | Declares top chrome intent through typed shell state; shell renders the tabs | Feed content, feed detail flow, and feed-local interaction state remain page-owned                        | The old Teleport-based feed top-tab pattern is historical only.        |
| MapLeafletView | Uses shell chrome where appropriate for shared chrome presentation           | Map canvas, selection state, and detail orchestration remain map-owned                                    | `useMapSelection` reinforces page ownership of selection/detail logic. |
| PublishView    | No longer routes publish actions through shell chrome                        | Publish form, clear action, and submit action are page-owned                                              | Bottom nav stays visible; `usePublishChromeActions` is removed.        |
| MessagesView   | Uses shell chrome for page-level chrome surfaces where needed                | Message list rendering, bubble layout, sender identity placement, and composer behavior remain page-owned | Message-author-above-bubble is UI/content truth, not shell truth.      |
| ProfileView    | Uses shell chrome for profile-level shell actions                            | Profile content remains page-owned                                                                        | No special stale doc correction needed in this slice.                  |

## 7. Current ShellChrome Contract

The core shell contract is now more truthful than the earlier migration-era version.

### Shell-owned tab rendering

Feed top tabs are not a page-rendered chrome fragment anymore. The active pattern is:

```text
page owns intent
  -> page sets typed tab spec in shell state
shell owns markup
  -> ShellChrome renders the tab chrome
```

That matters because it keeps event handlers and DOM ownership on the shell side while letting the page describe active key, items, and selection behavior.

### Shell transition lifecycle

The shell now has a real chrome transition lifecycle instead of the earlier placeholder phase vocabulary. The important doc-level truth is:

- shell chrome phase changes are implemented,
- reduced-motion keeps the same lifecycle semantics,
- the doc should no longer describe `#278` / `#281` as still-open foundational work.

### Page-local actions remain page-local when they are not global chrome

The publish correction is the clearest example. Publish-specific actions are important, but they are not global app chrome. They live inside `PublishView`, while the shell keeps ownership of the bottom navigation.

## 8. Current Types and Contracts (High Level)

The exact TypeScript shapes may continue to evolve, but the architectural contract is:

- shell state may describe tabs, buttons, and region visibility for top/bottom shell chrome;
- pages provide shell intent through typed specs rather than DOM injection;
- shell renders chrome from those specs;
- page-local feature actions do not need to become shell chrome just to appear near the bottom of the screen.

A newcomer should read the current shell contract as **typed intent flowing into shell-owned rendering**, not as a license for pages to mix rendering responsibility back into the shell.

## 9. Historical Patterns That Are No Longer Current

These patterns can still appear in older issues, PR descriptions, or earlier docs, but they should be treated as historical context rather than current architecture truth:

| Historical pattern                                                            | Why it is stale now                                 | Current truth                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/views/` as the runtime page directory                                    | Removed during #487 feature-domain reorganization   | Pages live under `src/features/<feature>/`                                          |
| Feed top tabs rendered through Teleport into shell DOM                        | Replaced by shell-owned typed tab rendering in #343 | `ShellChrome` owns the top-tab DOM; pages provide intent only                       |
| `usePublishChromeActions` routing publish buttons through shell bottom chrome | Removed in #353                                     | Publish actions are page-owned inside `PublishView`; shell keeps bottom nav         |
| Motion/chrome docs treating `#278` and `#281` as still-open foundation work   | Superseded by #342                                  | Chrome lifecycle and phase truth are implemented                                    |
| Treating every bottom-of-screen control as shell chrome                       | Too broad and blurs ownership boundaries            | Some bottom-edge controls are global shell chrome; others are page-local feature UI |

## 10. Remaining Follow-Up Work

This refresh should not imply that every shell-adjacent migration is finished. The current truth is more specific:

### Still follow-up work

| Area                                              | Why it is still follow-up                                                                                                                      |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DetailSheet adoption by all views                 | The shell-level overlay infrastructure exists, but not every detail flow is using it yet.                                                      |
| Some page-local cleanup after the shell migration | Views still have local interaction/state cleanup work that should stay in page-owned lanes rather than being misdescribed as shell completion. |
| Broader docs freshness outside this file          | Other docs may still describe older migration-era states or outdated follow-up lists.                                                          |

### Not follow-up anymore

| Area                                                                    | Why              |
| ----------------------------------------------------------------------- | ---------------- |
| Teleport-based feed top tab rendering as the active model               | Replaced by #343 |
| `usePublishChromeActions` as the current publish ownership model        | Removed by #353  |
| Chrome transition lifecycle as an unimplemented future shell foundation | Landed in #342   |

## 11. Folder Map (Current Reading)

```
src/
  App.vue                        ← thin bootstrap
  shell/
    AppShell.vue                 ← shell composition owner
    ShellChrome.vue              ← shell-owned chrome renderer
    useShellChrome.ts            ← shell state/composable
    shell-chrome-types.ts        ← typed shell region contracts
    shell-chrome.css             ← shell-owned chrome styling
    ContentFrame.vue             ← layout mode + safe-area frame
    DetailSheet.vue              ← shell overlay infrastructure
    useDetailSheet.ts            ← shell detail-sheet state
    index.ts                     ← shell barrel
  ui/
    layout/
      PageSurface.vue            ← generic page-surface wrapper
  app/
    AppViewHost.vue              ← active page switcher (maps view keys to feature components)
  features/
    feed/
      FeedView.vue               ← feed content + feed-owned behavior, shell tab intent
    map/
      MapLeafletView.vue         ← map content + map-owned behavior
      useMapSelection.ts         ← map-local selection/detail orchestration
    publish/
      PublishView.vue            ← publish content + local publish actions
    messages/
      MessagesView.vue           ← messages content + page-local composer/bubble behavior
    profile/
      ProfileView.vue            ← profile content
    detail/
      PostDetailContent.vue      ← post detail content
    auth/
      AuthPanel.vue              ← auth panel
```

The main thing to notice here is that the shell folder contains shell infrastructure, while feature folders under `src/features/` continue to own feature workflows. The historical `src/views/` directory was removed during the #487 feature-domain reorganization.

## 12. Apple Music Comparison

The Apple Music comparison is still useful, but only at the structural level.

| Concept                       | Apple Music-style analogy            | LIAN equivalent                |
| ----------------------------- | ------------------------------------ | ------------------------------ |
| Stable app shell              | tab/navigation controller layer      | `AppShell`                     |
| Persistent global chrome      | app-owned nav/tab chrome             | `ShellChrome` + `BottomTabBar` |
| Content frame                 | app-owned content area               | `ContentFrame`                 |
| Feature surface               | individual view controller content   | page components                |
| Shared overlay infrastructure | app-owned modal/sheet infrastructure | `DetailSheet`                  |

What LIAN does **not** copy is the literal Apple Music UI. The borrowed idea is the separation between app-owned infrastructure and view-owned content.

## 13. How To Read This Doc Safely

If this document conflicts with older PR language or migration-era issue text, prefer the following order:

1. current merged runtime truth on `main`
2. this refreshed architecture doc
3. older migration/issues for historical context only

In practical terms, that means:

- do not reintroduce Teleport-based top-tab ownership because an older issue mentions it;
- do not reintroduce shell-owned publish actions because an earlier migration step temporarily did that;
- do not describe chrome lifecycle as missing if your source predates #342;
- do not describe `src/views/` as the current page directory — pages now live under `src/features/` (#487).

## 14. Summary

The shell/content architecture is now in a more stable state than the first #302 refresh described.

The current truth a newcomer should leave with is:

- shell owns app chrome, content frame, and shared overlay infrastructure;
- pages own feature content and page-local behavior;
- shell chrome is rendered from typed shell state, not view-injected DOM;
- publish actions are page-owned again;
- the migration-era shell foundation is largely shipped, but some adoption/cleanup follow-up still remains.
