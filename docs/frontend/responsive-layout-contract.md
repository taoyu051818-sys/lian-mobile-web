# Responsive Layout Contract — LIAN Mobile Web

Date: 2026-05-09
Status: Draft — docs-only contract slice for #144

Related to #144.
Part of #144.
Does not close #144.

## Scope

This contract defines the responsive layout rules for the Vue canary shell across mobile, tablet, desktop, and wide screens. It covers layout modes, navigation variants, Feed column policy, wide-screen detail behavior, primary-view composition, and viewport verification.

This document is a planning/implementation contract only. It does not change runtime CSS, Vue components, scripts, package configuration, or CI.

## Layout modes

| Mode | Viewport rule | Primary goal |
|---|---|---|
| Mobile | width < 720px | Optimize thumb reach, one-column reading, bottom-priority navigation |
| Tablet | 720px <= width < 1024px | Keep mobile mental model while using extra width for denser content |
| Desktop | 1024px <= width < 1440px | Introduce stable side navigation and split-pane workflows |
| Wide | width >= 1440px | Preserve readability while allowing higher information density |

### Secondary modifiers

| Modifier | Rule | Effect |
|---|---|---|
| Short height | height < 520px | Prefer compact navigation, reduce fixed chrome, avoid tall stacked toolbars |
| Landscape mobile | width >= 720px and height < 520px | Treat as compact tablet for navigation/chrome decisions |
| Foldable fallback | dual-screen/segment unknown | Fall back to the nearest width-based mode; no hinge-specific layout required in MVP |

## App-shell rules

### Width and spacing

| Mode | Content max width | Horizontal padding | Notes |
|---|---|---|---|
| Mobile | 100% | 12-16px | Full-width content bands; no artificial desktop gutters |
| Tablet | 960px | 20-24px | Preserve readable line length; allow wider cards and forms |
| Desktop | 1200px | 24-32px | Enable split layouts without stretching text blocks |
| Wide | 1360px | 32-40px | Cap content width; do not let cards/forms become overly wide |

### Navigation variants

| Mode | Primary navigation | Behavior |
|---|---|---|
| Mobile | Bottom tab bar | Persistent unless a modal/detail/input workflow needs the bottom edge |
| Mobile + short landscape | Compact side rail | Replace bottom bar to preserve vertical space |
| Tablet | Bottom tab bar by default | May promote to side rail when a split-pane view is active |
| Desktop | Side rail | Stable left-side navigation; content scrolls independently |
| Wide | Side rail | Same as desktop; extra width goes to content, not larger nav chrome |

Contract rule: navigation primitives should support `bottom`, `side`, and `top` variants, but this issue only requires `bottom` and `side` to be defined for MVP.

## Feed contract

### Column-count policy

| Mode | Feed columns | Notes |
|---|---|---|
| Mobile narrow (< 390px) | 1 | Prevent over-compressed cards and icon collisions |
| Mobile standard (>= 390px) | 2 | Default mobile masonry mode |
| Tablet | 3 | First density step-up |
| Desktop | 3 | Preserve legibility while leaving room for detail panes/chrome |
| Wide | 4 | Use extra width for scanability, not oversized cards |

Rules:

- JS and CSS must derive from the same column-count contract; no permanent "CSS says 2, JS says 2" duplication.
- Column count should be width-driven rather than hard-coded in the component.
- Card width must remain within a readable range; adding more columns is preferred over stretching individual cards.

### Feed/detail behavior

| Mode | Detail presentation |
|---|---|
| Mobile | Full-screen detail overlay/page |
| Tablet | Full-screen by default; split view optional only when width and height are both generous |
| Desktop | Master-detail split view is the default for in-app detail open |
| Wide | Master-detail split view is the default; detail pane may grow but should not exceed readable text width |

Rules:

- Deep links must still be able to open detail as the primary surface even on desktop.
- Desktop split view should preserve list context, scroll position, and currently selected item.
- Mobile gesture-driven detail behavior remains mobile-only; desktop should not depend on drag-dismiss semantics.

## Primary-view composition

| View | Mobile | Tablet | Desktop/Wide MVP |
|---|---|---|---|
| Feed | List/detail single surface | Denser list, optional roomier detail | Master-detail with persistent list context |
| Map | Map-first single surface | Map with bottom sheet/list | Map plus side panel for place/content detail |
| Publish | Single-column form | Wider form, optional grouped sections | Two-column editor + metadata/media/settings |
| Messages | Single-column inbox/thread flow | Single-column or early split depending on density | Two-pane list/thread layout |
| Profile | Single-column tabs/content | Wider content sections | Sidebar/tabs + primary content pane |

MVP rule: if a view does not receive a desktop implementation immediately, it must still declare its intended desktop composition in docs before ad hoc media-query work begins.

## Chrome and low-height rules

- Fixed bottom navigation and fixed input docks must not share the same keyboard/low-height behavior.
- In short-height layouts, only one persistent fixed edge chrome should dominate the viewport at a time.
- Landscape mobile must prefer compact navigation and reduce stacked headers/toolbars.
- Input-heavy flows retain priority over persistent navigation when viewport height is constrained.

## Testing checklist

### Required viewport set

| Viewport | Purpose |
|---|---|
| 390x844 | baseline mobile |
| 430x932 | large mobile |
| 844x390 | landscape mobile / short-height stress |
| 768x1024 | portrait tablet |
| 1024x768 | compact desktop / landscape tablet |
| 1440x900 | wide desktop baseline |

### What to verify

- Active navigation variant matches the contract for the current mode.
- Feed column count matches the policy table.
- Detail behavior matches the mode-specific rule.
- No bottom chrome obscures primary content in short-height layouts.
- Map, Publish, Messages, and Profile follow their declared MVP composition or clearly remain in documented fallback mode.
- Text remains readable and does not stretch beyond the content-width rules.

## Relationship to adjacent issues

- #110 provides the router/view-lifecycle foundation that will eventually express these modes and split layouts cleanly.
- #121 covers route/view-level code-splitting so desktop/tablet composition does not force all heavy views into the mobile first load.
- #123 covers browser support and progressive enhancement, including foldable fallback and reduced-capability environments.
- #130 covers mobile keyboard and fixed-input chrome behavior referenced by this contract's low-height rules.
- #135 covers overlay, scroll-lock, focus-stack, and z-index rules that must stay coherent when layouts split or chrome moves.

## Implementation follow-up

This contract intentionally leaves implementation to later bounded slices. Expected follow-up categories:

1. App-shell layout state and navigation-variant ownership
2. Feed masonry column-count implementation and test coverage
3. Desktop/tablet master-detail behavior for Feed and Map
4. Low-height/landscape chrome behavior validation
5. View-specific desktop composition slices for Publish, Messages, and Profile
