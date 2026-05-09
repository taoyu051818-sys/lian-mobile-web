# Motion and Gesture Contract

Date: 2026-05-08
Status: **Draft** -- documentation slice for issue #163. No runtime code changes.
Scope: `src/motion/`, `src/views/`, `src/styles/`, `public/lian-tokens.css`

## Non-goals

This document does **not** change any runtime code. It defines the contract that future implementation work must follow. No `src/**`, `public/**`, `scripts/**`, package files, or CI configuration are modified by this PR.

---

## 1. Phase / State-Machine Semantics

### 1.1 Floating Chrome Controller

Source: `src/motion/floatingChrome.ts`

The `useFloatingChromeController` composable manages visibility of "floating chrome" surfaces (top bars, bottom tab bars, dock bars). It is purely reactive -- no timers, rAF, or event listeners.

#### Phase definitions

| Phase | CSS `data-floating-state` | Meaning |
|-------|---------------------------|---------|
| `visible` | `"visible"` | Chrome fully visible, no transition active. |
| `exiting` | `"exiting"` | CSS transition toward hidden has started. |
| `exiting-to-hidden` | `"exiting-to-hidden"` | Exit transition in progress (progress 0->1). |
| `hidden` | `"hidden"` | Chrome fully hidden, no transition active. |
| `entering` | `"entering"` | CSS transition toward visible has started. |
| `entering-to-visible` | `"entering-to-visible"` | Enter transition in progress (progress 0->1). |
| `progress` | `"progress"` | Continuous gesture-driven interpolation (e.g., drag). Uses `--bottom-chrome-visibility-progress` with `transition: none`. |

#### State machine transitions

```
visible ──[hide]──> exiting ──[transitionstart]──> exiting-to-hidden ──[transitionend]──> hidden
hidden ──[show]──> entering ──[transitionstart]──> entering-to-visible ──[transitionend]──> visible
any ──[drag start]──> progress ──[drag end]──> visible | hidden
```

#### Contract rules

1. The composable MUST NOT own any timers or rAF handles. All animation timing is CSS-owned.
2. Phase transitions driven by CSS MUST fire on `transitionstart` / `transitionend` events.
3. The `progress` phase sets `transition: none` on the element; the CSS custom property `--bottom-chrome-visibility-progress` (range 0-1) is updated per-frame by the gesture caller.
4. When entering `progress` from `visible` or `hidden`, the composable MUST snapshot the current progress value to avoid jumps.

### 1.2 Card Camera Transition

Source: `FeedView.vue` (`startCardTransition`, `closeDetailWithCardify`)

The card camera transition morphs a feed card into the detail panel (open) or reverses the morph (close).

#### Phase definitions

| Phase | Description |
|-------|-------------|
| `idle` | No transition active. `cardTransition === null`. |
| `mounting` | Transition element inserted into DOM, rAF queued to add `.is-active`. |
| `active` | CSS transition running (360ms via `--card-camera-motion-duration`). |
| `completing` | `setTimeout` fires at 320ms; element removed, state reset. |
| `returning` | Close path: detail panel animates back to card origin (380ms). |

#### Contract rules

1. The `mounting` -> `active` handoff MUST use exactly one `requestAnimationFrame` to defer the `.is-active` class addition, ensuring the browser has painted the initial state before the transition triggers.
2. The `completing` cleanup timeout MUST match `--card-camera-motion-duration` (currently 360ms; code uses 320ms -- see "Remaining work").
3. The `returning` phase timeout MUST match `RETURN_ANIMATION_MS` (380ms).
4. On unmount, all pending rAF and timeout handles MUST be cancelled.

---

## 2. Timer and rAF Cleanup Expectations

### 2.1 Current state

| Location | Timer type | Cleanup on unmount |
|----------|-----------|-------------------|
| `FeedView.vue:startCardTransition` | `requestAnimationFrame` | **Not saved** -- handle discarded |
| `FeedView.vue:startCardTransition` | `setTimeout(320)` | **Not saved** -- handle discarded |
| `FeedView.vue:closeDetailWithCardify` | `setTimeout(RETURN_ANIMATION_MS)` | **Not saved** -- handle discarded |
| `FeedItemCard.vue:handlePointerDown` | `setTimeout(CARD_CLICK_MAX_DURATION_MS)` | Module-level variable, cleared on pointerup/cancel |

### 2.2 Contract rules

1. Every `requestAnimationFrame` call MUST save its handle to a component-scoped variable.
2. Every `setTimeout` used for animation timing MUST save its handle.
3. On `onBeforeUnmount`, all saved handles MUST be passed to `cancelAnimationFrame()` / `clearTimeout()`.
4. Components that create animation timers MUST expose an internal `cancelPendingTimers()` function called from both the unmount hook and any "abort" path (e.g., `onDetailPointerCancel`).
5. Pattern:

```ts
const pendingRaf = ref<number>(0);
const pendingTimer = ref<ReturnType<typeof setTimeout>>();

function cancelPendingTimers() {
  if (pendingRaf.value) {
    cancelAnimationFrame(pendingRaf.value);
    pendingRaf.value = 0;
  }
  if (pendingTimer.value !== undefined) {
    clearTimeout(pendingTimer.value);
    pendingTimer.value = undefined;
  }
}

onBeforeUnmount(cancelPendingTimers);
```

---

## 3. Reduced-Motion Rules

### 3.1 Strategy

The codebase uses a **dual-layer** approach:

- **CSS layer**: `@media (prefers-reduced-motion: reduce)` blocks disable transitions, transforms, and filters.
- **JS layer**: `prefersReducedMotion()` helper (local to `FeedView.vue`) skips transition orchestration entirely.

### 3.2 Contract rules

1. Every CSS transition/animation MUST have a corresponding `@media (prefers-reduced-motion: reduce)` override that sets `transition: none`, `animation: none`, `transform: none` (where safe), and `filter: none`.
2. JS-driven transitions (card camera, detail return) MUST check `prefersReducedMotion()` **before** creating any rAF or timeout. If true, skip animation and apply final state immediately.
3. The `prefersReducedMotion()` helper MUST be extracted to a shared composable (`src/motion/useReducedMotion.ts`) so all components can import it. Current duplication across `FeedView.vue` is a known debt.
4. The shared composable MUST use `window.matchMedia('(prefers-reduced-motion: reduce)')` with a `change` event listener so it reacts to runtime preference changes.
5. The `progress` phase of floating chrome MUST also respect reduced motion: when active, snap `progress` to 0 or 1 (nearest endpoint) instead of interpolating.

### 3.3 Files with reduced-motion coverage

| File | CSS coverage | JS coverage |
|------|-------------|-------------|
| `floating-chrome.css` | Lines 156-168, 242-319 | N/A (composable is pure state) |
| `card-camera-transition.css` | Lines 191-203 | N/A |
| `FeedView.vue` | Lines 866-882 | Lines 197-199, 230, 265 |
| `FeedItemCard.vue` | Lines 498-506 | None needed |
| `PostDetailPanel.vue` | Lines 1003-1009 | None needed |
| `primitives.css` | None (spinner only) | N/A |

---

## 4. Gesture Hit-Zone Guidance

### 4.1 Interactive target exclusion

Source: `FeedView.vue` -- `isInteractiveTarget()`, `FeedItemCard.vue` -- pointer handlers

Interactive targets that MUST NOT trigger drag/swipe gestures:

| Target | Detection | Reason |
|--------|-----------|--------|
| Like button | `closest('.feed-item-card__like')` | Has its own `pointerdown.stop` / `pointerup.stop` |
| Links / anchors | `closest('a, [href]`)` | Navigation intent |
| Buttons | `closest('button, [role="button"]`)` | Action intent |
| Gallery images | `closest('.post-detail-gallery__item')` | Has own pointer discrimination for swipe-vs-click |
| Text selection areas | `closest('input, textarea, [contenteditable]`)` | Text interaction |
| Scroll containers | `closest('[data-scroll-container]')` | Scroll intent |

### 4.2 Edge guard semantics

| Constant | Value | Purpose |
|----------|-------|---------|
| `DETAIL_DRAG_EDGE_GUARD` | 28px | Horizontal inset from screen edges where drag gesture is suppressed (avoids conflict with system back gesture). |
| `SWIPE_VERTICAL_GUARD` | 52px | Vertical delta threshold: if vertical movement exceeds this before horizontal lock, gesture is classified as vertical scroll, not horizontal swipe. |

### 4.3 Direction locking

1. On `pointerdown`, the gesture is "candidate" -- no direction committed.
2. On `pointermove`, if `|dx| > |dy|` AND `|dx| > DETAIL_DRAG_EDGE_GUARD`, lock to **horizontal**.
3. On `pointermove`, if `|dy| > |dx|` AND `|dy| > SWIPE_VERTICAL_GUARD`, lock to **vertical** (pass through to scroll).
4. Once locked, the direction cannot change for the duration of the gesture.
5. On `pointercancel` or `pointerup`, the lock resets.

### 4.4 Swipe thresholds

| Constant | Value | Meaning |
|----------|-------|---------|
| `SWIPE_THRESHOLD` | 96px | Minimum horizontal drag distance to trigger dismiss. Below this, the panel snaps back. |
| `CARDIFY_DISTANCE` | 320px | Maximum drag distance for the cardify close animation progress mapping. |
| `DRAG_STAGE_MIN_SCALE` | 0.9 | Minimum scale factor for the detail panel stage during drag (prevents over-shrink). |

### 4.5 `touch-action` assignments

| Element | `touch-action` | Reason |
|---------|---------------|--------|
| `.feed-view__detail` | `pan-y` | Allows vertical scroll, reserves horizontal for swipe-to-dismiss. |
| `.feed-view__detail.is-dragging` | `none` | During active drag, all touch actions are suppressed. |
| `.feed-item-card` | `manipulation` | Allows scroll and pinch-zoom, disables double-tap-to-zoom. |
| `.post-detail-gallery__item` | `pan-y` | Allows vertical scroll within gallery. |
| `.post-detail-panel__report` | `pan-y` | Allows vertical scroll within report section. |

---

## 5. Motion Design Tokens

Source: `public/lian-tokens.css` (lines 67-70)

| Token | Value | Usage |
|-------|-------|-------|
| `--motion-fast` | 160ms | Tab transitions, card hover lift, quick feedback |
| `--motion-standard` | 220ms | Content transitions, feed content opacity/filter |
| `--motion-page` | 280ms | Page-level transitions, pseudo-element reveals |
| `--motion-ease-standard` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Default easing for all motion |

### Component-level tokens

| Token | File | Value | Usage |
|-------|------|-------|-------|
| `--floating-chrome-motion-duration` | `floating-chrome.css` | 260ms | Floating chrome show/hide transitions |
| `--card-camera-motion-duration` | `card-camera-transition.css` | 360ms | Card-to-detail morph |
| `--card-camera-ease` | `card-camera-transition.css` | `cubic-bezier(0.2, 0.86, 0.24, 1)` | Card morph easing (snappier) |

### Contract rules

1. All new motion durations MUST reference a CSS custom property, never a raw `ms` value.
2. Hardcoded durations in JS (e.g., `setTimeout(320)`) MUST reference the corresponding CSS token value or a shared constant. Drift between JS and CSS durations is a bug.
3. New component-level tokens MUST be documented in this table.

---

## 6. `data-motion-*` Attribute Contract

Source: `FeedItemCard.vue` (lines 202-249)

Feed item cards expose `data-motion-role` and `data-motion-*` attributes for animation targeting:

| Attribute | Element | Purpose |
|-----------|---------|---------|
| `data-motion-role="image-frame"` | Image container | Card camera source/destination |
| `data-motion-role="image"` | `<img>` | Image scale/saturate transition |
| `data-motion-role="tag"` | Tag chip | Staggered reveal (70ms delay) |
| `data-motion-role="title"` | Title `<strong>` | Slide-up reveal |
| `data-motion-role="meta-row"` | Meta container | Parent for author/time/like |
| `data-motion-role="author"` | Author name | Reference point |
| `data-motion-role="avatar"` | Avatar image | Reference point |
| `data-motion-role="time"` | Time label | Reference point |
| `data-motion-role="like"` | Like button | Excluded from gesture targets |
| `data-motion-title` | Card root | Title text for morph matching |
| `data-motion-tag` | Card root | Tag text for morph matching |

### Contract rules

1. New motion-targetable elements MUST be tagged with `data-motion-role`.
2. The `data-motion-role` value MUST be unique within a card instance.
3. Elements with `data-motion-role="like"` MUST have `pointerdown.stop` and `pointerup.stop` to prevent gesture capture.

---

## 7. Known Debt and Remaining Implementation Work

This documentation slice identifies but does **not** resolve the following:

| ID | Issue | Severity | Notes |
|----|-------|----------|-------|
| D-1 | Timer/rAF handles not saved on unmount | P1 | `FeedView.vue` discards rAF and setTimeout handles. See Section 2. |
| D-2 | Duration drift: JS 320ms vs CSS 360ms | P1 | `startCardTransition` cleanup timeout (320ms) does not match `--card-camera-motion-duration` (360ms). |
| D-3 | `prefersReducedMotion()` not shared | P1 | Duplicated in `FeedView.vue`; needs extraction to `src/motion/useReducedMotion.ts`. |
| D-4 | Gesture logic monolith in `FeedView.vue` | P2 | Detail drag gesture is not reusable; should be extracted to a composable. |
| D-5 | `closeDetailWithCardify` coupling | P2 | Handles animation, chrome state, browser history, and detail state reset in one function. |
| D-6 | Floating chrome no-motion override | P2 | `floating-chrome.css` lines 242-319 disable all chrome motion. Unclear if this is permanent or temporary. |
| D-7 | No unit tests for phase transitions | P2 | See `docs/qa/motion-verification.md` for required test scenarios. |
| D-8 | Magic numbers not tokenized | P2 | `SWIPE_THRESHOLD=96`, `CARDIFY_DISTANCE=320`, `RETURN_ANIMATION_MS=380` are raw constants, not CSS tokens. |
