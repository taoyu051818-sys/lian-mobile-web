# Motion and Gesture Verification Checklist

Date: 2026-05-08
Status: **Draft** -- QA companion to `docs/frontend/motion-contract.md`
Contract: Issue #163

## How to use

Each item has an **ID**, a **description**, a **component/file reference**, and an **expected behavior**. Check items as implementation work lands. Items marked `[TODO]` require runtime code changes not yet implemented.

---

## 1. Floating Chrome Phase Transitions

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| FC-1 | Navigate from feed to detail view | Bottom tab bar transitions: `visible` -> `exiting` -> `exiting-to-hidden` -> `hidden` | Verify |
| FC-2 | Navigate back from detail to feed | Bottom tab bar transitions: `hidden` -> `entering` -> `entering-to-visible` -> `visible` | Verify |
| FC-3 | Drag detail panel (partial gesture) | Tab bar enters `progress` phase; `--bottom-chrome-visibility-progress` tracks drag position | Verify |
| FC-4 | Release partial drag (snap back) | Tab bar returns to `visible` via `entering-to-visible` | Verify |
| FC-5 | Rapid open/close detail | No phase skips; each transition completes or is properly cancelled | Verify |
| FC-6 | Unmount during transition | No console errors; no orphaned timers | `[TODO]` |

## 2. Card Camera Transition

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| CC-1 | Tap feed card | Card morphs to detail panel over 360ms (`--card-camera-motion-duration`) | Verify |
| CC-2 | Swipe detail to dismiss | Detail panel morphs back to card origin over 380ms (`RETURN_ANIMATION_MS`) | Verify |
| CC-3 | Tap card with reduced motion enabled | Detail opens instantly (no morph animation) | Verify |
| CC-4 | Swipe to dismiss with reduced motion | Detail closes instantly (no return animation) | Verify |
| CC-5 | Card camera transition cleanup | After transition completes, `.feed-view__card-transition` element is removed from DOM | Verify |
| CC-6 | Duration consistency | JS cleanup timeout matches CSS `--card-camera-motion-duration` (360ms) | `[TODO]` Fix D-2 |

## 3. Timer and rAF Cleanup

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| TC-1 | Navigate away during card camera open | `cancelAnimationFrame` called; no late callback | `[TODO]` Fix D-1 |
| TC-2 | Navigate away during card camera close | `clearTimeout` called; no late `resetDetailState` | `[TODO]` Fix D-1 |
| TC-3 | Unmount FeedView during any transition | All pending timers cancelled in `onBeforeUnmount` | `[TODO]` Fix D-1 |
| TC-4 | Unmount FeedItemCard during long-press | `longPressTimer` cleared; no ghost `pointerWasLongPress` set | Verify |
| TC-5 | Memory leak check | Open/close detail 100 times; `setTimeout` handle count stays bounded | `[TODO]` |
| TC-6 | `cancelPendingTimers()` idempotency | Calling twice does not throw or clear unrelated handles | `[TODO]` |

## 4. Reduced Motion

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| RM-1 | System preference `prefers-reduced-motion: reduce` | All CSS transitions set to `none`; no transform/filter animations | Verify |
| RM-2 | Toggle reduced motion at runtime | `useReducedMotion` composable reacts to `change` event; next gesture skips animation | `[TODO]` Fix D-3 |
| RM-3 | Floating chrome in reduced motion | Chrome shows/hides instantly (no blur, translate, scale) | Verify |
| RM-4 | Card hover in reduced motion | No `translateY(-1px)` lift; no box-shadow transition | Verify |
| RM-5 | Probe animation in reduced motion | `feed-update-probe-motion` transition disabled; probe appears/disappears instantly | Verify |
| RM-6 | Spinner in reduced motion | `lian-spin` animation continues (spinners are exempt from reduced motion) | Verify |

## 5. Gesture Hit Zones

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| GZ-1 | Tap like button on feed card | Like toggles; card does NOT open detail | Verify |
| GZ-2 | Long-press like button | Like toggles; no context menu; no card long-press action | Verify |
| GZ-3 | Swipe horizontally on detail panel (center) | Detail drags; if >96px, dismisses | Verify |
| GZ-4 | Swipe horizontally on detail panel (within 28px of edge) | Edge guard suppresses drag; system back gesture may trigger | Verify |
| GZ-5 | Swipe vertically on detail panel | Vertical scroll occurs; no horizontal drag | Verify |
| GZ-6 | Swipe diagonally (more vertical than horizontal) | If vertical delta >52px before horizontal lock, gesture is vertical scroll | Verify |
| GZ-7 | Swipe gallery image horizontally | Gallery swipe occurs; detail does NOT drag | Verify |
| GZ-8 | Tap gallery image after small movement | Click suppressed (pointer moved >tolerance) | Verify |
| GZ-9 | `touch-action` on detail panel | `pan-y` when idle; `none` when `.is-dragging` | Verify |

## 6. Motion Token Consistency

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| MT-1 | CSS `transition` declarations | All use `var(--motion-*)` or component token; no raw `ms` values in new code | `[TODO]` Enforce lint |
| MT-2 | JS `setTimeout` durations | Match corresponding CSS token or shared constant | `[TODO]` Fix D-2, D-8 |
| MT-3 | New animations documented | Any new `transition`, `animation`, or `@keyframes` added to Section 5 of contract | Ongoing |

## 7. Edge Cases

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| EC-1 | Double-tap card rapidly | Second tap does not open detail while first transition is mounting | Verify |
| EC-2 | Start drag, then rotate device | Gesture cancels via `pointercancel`; state resets cleanly | Verify |
| EC-3 | Detail open, then press browser back | Detail closes with animation (not instant state drop) | Verify |
| EC-4 | Multiple pointer IDs on detail panel | Only first pointer drives drag; additional pointers ignored | Verify |
| EC-5 | Tab switch during card camera transition | Transition completes or cancels; no orphaned DOM nodes | `[TODO]` |

---

## Test automation targets

The following scenarios should be covered by unit/E2E tests (not yet implemented):

1. **Phase transition sequence**: Mock pointer events; assert floating chrome phases in order.
2. **Timer cleanup**: Mount/unmount FeedView during active transition; assert no pending timers.
3. **Reduced motion**: Set `matchMedia` mock to `reduce`; assert no rAF/timeout created.
4. **Edge guard**: Dispatch `pointermove` within 28px of left edge; assert no drag.
5. **Direction lock**: Dispatch vertical then horizontal moves; assert gesture stays vertical.
6. **Long-press discrimination**: Hold pointer >500ms with <8px movement; assert long-press fires.
