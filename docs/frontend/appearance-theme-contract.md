# Appearance and Theme Contract — LIAN Mobile Web

Date: 2026-05-09
Status: Draft — docs-only contract slice for #150

Related to #150.
Part of #150.
Does not close #150.

## Scope

This contract defines the frontend appearance model for the Vue canary shell across light, dark, and system-driven themes. It covers appearance modes, semantic token ownership, theme-color and PWA status-bar behavior, contrast expectations for shared UI surfaces, map/theme policy, preference persistence, and verification.

This document is a planning/implementation contract only. It does not change runtime CSS, tokens, Vue components, manifests, scripts, package configuration, or CI.

## Appearance modes

| Mode | Source of truth | Primary goal |
|---|---|---|
| `light` | explicit user choice | Stable bright theme for current default LIAN surfaces |
| `dark` | explicit user choice | Reduce glare while preserving readable content and image-heavy surfaces |
| `system` | user choice resolves to OS/browser preference | Respect device-level preference without inventing a fourth token set |

### Resolution rules

1. If a signed-in account setting exists, it may override local preference in a later implementation slice, but MVP persistence starts with local client state.
2. If the stored preference is `light` or `dark`, apply it directly.
3. If the stored preference is `system` or absent, resolve through `prefers-color-scheme`.
4. If `prefers-color-scheme` is unavailable, fall back to `light`.

Contract rule: implementation must expose only `light | dark | system`. Do not add ad hoc modes such as `auto-dark`, `dim`, or per-view theme toggles in MVP.

## Root theme ownership

### Root selectors

Implementation should standardize on one root theme selector:

- preferred: `data-theme="light|dark"` on `<html>` or `<body>`
- allowed fallback: root class with the same two resolved states

`system` is a stored preference, not a third resolved DOM theme. The DOM should still resolve to `light` or `dark` for token application.

### `color-scheme` contract

- If resolved theme is light-only in an early rollout, explicitly declare `color-scheme: light`.
- Once dark mode is supported, the root should expose `color-scheme: light dark` and keep resolved UI state in sync with actual tokens.
- Native form controls, scrollbars, and browser chrome should not drift from the resolved theme.

## Semantic token contract

### Token layers

| Layer | Purpose | Examples |
|---|---|---|
| foundation | raw palette primitives | neutral, accent, success, warning, error ramps |
| semantic surface | page and container meaning | `bg`, `surface`, `surface-2`, `card`, `overlay`, `glass` |
| semantic content | readable text/icon meaning | `ink`, `muted`, `faint`, `inverse`, `link` |
| semantic border/effect | separation and depth | `border`, `border-strong`, `shadow`, `focus-ring` |
| semantic feedback | state and status meaning | `success`, `warning`, `error`, `info`, `disabled` |

Rules:

- Components should consume semantic tokens, not hard-coded color literals.
- Theme work must define both light and dark values for each semantic token family before shipping a resolved dark mode.
- Temporary one-off color overrides must be treated as debt and documented or blocked by token allowlists.

### Required shared surfaces

The following surfaces must receive explicit light and dark semantic values before dark mode is considered implementation-ready:

- app background and content background
- cards and raised panels
- glass surfaces and glass borders
- headers, tab bars, side rails, floating chrome
- chips, badges, pills, toasts, sheets, and popovers
- form fields and placeholders
- focus ring and selected state
- map controls, legends, markers, and popups
- image/lightbox overlays and avatar fallbacks

## Contrast matrix expectations

### Minimum semantic pairs

| Surface pair | Expectation |
|---|---|
| body text on background/surface | primary reading contrast, safe for dense feed/detail text |
| muted text on background/surface | readable secondary metadata without disappearing in glass UI |
| inverse text on filled accent surfaces | safe for buttons, selected tabs, chips |
| border on background/surface | visible separation without heavy outlines |
| focus ring on light and dark surfaces | keyboard-visible in all themes |
| toast/sheet text on feedback surfaces | readable for success, warning, error, info |
| map control text/icon on control surfaces | readable over map tiles and image overlays |
| overlay label text on images | readable on both bright and dark media |

Rules:

- Contrast decisions must be made at the token level first, not per-component patching.
- Glass surfaces require both fill and border decisions in dark mode; reusing translucent white is not sufficient.
- Reduced-opacity muted text is not an acceptable substitute for semantic secondary text design.

## PWA and browser chrome contract

### Theme-color behavior

| State | Expected browser chrome behavior |
|---|---|
| resolved light theme | `theme-color` and equivalent manifest values align with the light shell background |
| resolved dark theme | `theme-color` and equivalent manifest values align with the dark shell background |
| `system` preference changes | runtime or media-aware metadata updates keep browser chrome in sync with resolved theme |

Required surfaces:

- HTML `meta[name="theme-color"]`
- manifest `theme_color`
- manifest `background_color`
- iOS standalone/status-bar strategy when PWA install work from #109 is implemented

Rules:

- Theme-color should reflect the resolved shell, not a fixed light default once dark mode exists.
- Release smoke from #134 must verify that theme-color and manifest values match the resolved appearance contract.
- If the product remains light-only temporarily, that limitation must be explicit in docs and `color-scheme`.

## Preference persistence

### Local storage and sync

| Item | Contract |
|---|---|
| storage key | `lian.appearance` |
| allowed values | `light`, `dark`, `system` |
| default | `system` when no stored value exists |
| cross-tab behavior | sync through the `storage` event |
| logout behavior | keep local preference unless future account-setting policy says otherwise |

Rules:

- Account sync may be added later, but local storage is the MVP source for persistence.
- Preference changes must update both resolved theme state and browser-chrome metadata.
- Settings/profile UX may expose appearance later; this slice only defines the contract.

## Map and media policy

### Map theme strategy

Desktop/mobile map work must not assume the base map automatically supports dark mode.

| Surface | Contract |
|---|---|
| base map tiles | may remain light in MVP if dark tiles are not product-approved |
| surrounding shell | must still adapt to light/dark without making the map feel visually broken |
| map controls and popups | must use theme tokens and remain readable over tile imagery |
| image overlays / labels | must use readable overlay tokens, not raw translucent white text chips |

If the map stays light in a dark shell, implementation must design the transition intentionally rather than treating it as an accidental mismatch.

### Media-adjacent surfaces

- gallery/lightbox backdrops
- avatar fallback backgrounds and initials
- image badges, tags, and overlays
- toast/sheet surfaces shown over images or maps

These surfaces must use semantic overlay tokens rather than page-background tokens.

## Form and feedback surfaces

The appearance contract also applies to:

- input, textarea, select, placeholder, disabled, and validation states
- auth, publish, messages composer, and profile editor surfaces
- toast, inline feedback, sheet, modal, and floating action chrome

Rules:

- Feedback colors must not reuse light-mode-only values in dark mode.
- Focus and error states must remain readable independent of theme.
- Theme work should align with accessibility expectations tracked in #147.

## Verification checklist

### Required theme states

- resolved light
- resolved dark
- stored `system` with light OS preference
- stored `system` with dark OS preference

### Required view set

- Feed
- Detail/gallery/lightbox
- Map
- Publish
- Auth
- Messages
- Profile
- toast/sheet/floating chrome surfaces

### What to verify

- root resolved theme and `color-scheme` stay in sync
- semantic tokens cover the shared surfaces listed in this contract
- theme-color/manifest/browser-chrome behavior matches the resolved theme
- glass, muted text, and feedback surfaces remain readable in both themes
- map controls and image overlays remain readable even if the base map stays light
- stored preference sync works across tabs
- reduced-motion/a11y follow-up work can consume the same theme semantics cleanly

## Relationship to adjacent issues

- #109 defines the broader PWA/service-worker/install contract that will consume this theme-color and status-bar policy.
- #123 covers browser support and progressive enhancement, including fallback behavior when media queries or platform features differ.
- #134 defines release, rollback, and deployment verification that should later enforce theme-color and manifest checks.
- #144 defines responsive layout rules that theme work must not fight with, especially for floating chrome and wide-screen shells.
- #147 defines accessibility, contrast, focus, and reduced-motion expectations that should validate this contract during implementation.

## Implementation follow-up

This contract intentionally leaves implementation to later bounded slices. Expected follow-up categories:

1. Root theme state and storage synchronization
2. Light/dark semantic token definitions
3. Browser-chrome and manifest/theme-color synchronization
4. Map/control/media overlay theming
5. Screenshot and contrast verification for the required view set
