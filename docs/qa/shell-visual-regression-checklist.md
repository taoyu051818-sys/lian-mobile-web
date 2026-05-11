# Shell Visual & Interaction Regression Checklist

Date: 2026-05-11
Status: **Active** -- QA coverage for profile/messages/motion refactor wave
Issue: #261

## How to Use

Each item has an ID, a description, the component/file it covers, and expected behavior.
Mark `[x]` when verified, `[ ]` when pending. Update this file as part of QA cycles.

Automated structure tests in `tests/shell/`, `tests/messages/`, `tests/profile/`, `tests/motion/`
cover source-level contracts. This checklist covers runtime/visual behavior that requires a browser.

---

## 1. Shell Layout

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| SL-1 | Open app on feed view | Content area uses `content` layout mode (max-width ~760px, centered) | |
| SL-2 | Switch to map view | Content area uses `full-bleed` mode (100% width, no max-width) | |
| SL-3 | Switch to messages view | Content area uses `composer-safe` mode (extra bottom padding) | |
| SL-4 | Switch to profile view | Content area uses `content` mode | |
| SL-5 | Switch between tabs rapidly | No layout flash; chrome stays visible during transitions | |
| SL-6 | Bottom tab bar always visible on feed/map/publish/profile | Tab bar renders 5 tabs: feed, map, publish, messages, profile | |
| SL-7 | Active tab indicator matches current view | Active tab has visual distinction from inactive tabs | |

## 2. Safe-Area Spacing

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| SA-1 | iPhone with notch (or simulator with safe-area insets) | Top chrome does not overlap status bar area | |
| SA-2 | iPhone with home indicator | Bottom tab bar sits above home indicator | |
| SA-3 | Messages view on iPhone | Floating tabs clear notch; composer clears home indicator | |
| SA-4 | Map view post-detail panel | Sticky panel sits above tab bar and home indicator | |
| SA-5 | Desktop browser (no safe-area insets) | Layout looks correct with fallback spacing | |
| SA-6 | Toast notification on iPhone | Toast does not overlap notch area | |

## 3. Floating Chrome

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| FC-1 | Open post detail from feed | Bottom tab bar exits downward (translate + fade) | |
| FC-2 | Close post detail | Bottom tab bar enters upward (translate + fade) | |
| FC-3 | Drag detail panel partially | Tab bar visibility tracks drag progress | |
| FC-4 | Switch to messages tab | Shell bottom tab bar hides; messages composer shows | |
| FC-5 | Switch away from messages | Composer hides; shell bottom tab bar shows | |
| FC-6 | Floating chrome glass effect | Top/bottom chrome has backdrop-blur and translucent background | |
| FC-7 | Rapid tab switching | No ghost chrome states; all transitions complete cleanly | |

## 4. Map Sizing

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| MS-1 | Map view on desktop | Map fills full viewport width (no side margins) | |
| MS-2 | Map view on mobile (< 640px) | Map stage has min-height of 300px | |
| MS-3 | Map view on tablet/desktop | Map stage has min-height of 360px | |
| MS-4 | Map stage wrapper border-radius | Full-bleed mode removes border-radius on map stage | |
| MS-5 | Select a place on map | Post-detail panel appears sticky above tab bar | |
| MS-6 | Map filter buttons (top chrome) | Filter buttons render in top chrome region | |

## 5. Messages Composer

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| MC-1 | Open messages view, channel tab | Composer appears as floating bottom chrome | |
| MC-2 | Switch to notifications tab | Composer hides (floating chrome exit) | |
| MC-3 | Switch back to channel tab | Composer re-appears (floating chrome enter) | |
| MC-4 | Composer compact state (empty, unfocused) | Composer shows minimal compact bar | |
| MC-5 | Focus composer textarea | Composer expands to full state | |
| MC-6 | Composer does not duplicate glass styles | Composer inherits glass from parent floating chrome | |
| MC-7 | Channel thread clears fixed composer | Message list bottom padding prevents content from hiding behind composer | |

## 6. Profile Hero

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| PH-1 | Profile view with user logged in | Hero gradient background visible at top | |
| PH-2 | Profile hero gradient | Uses `--lian-primary-soft` color, fades to transparent | |
| PH-3 | Profile header avatar | 80px centered orb at top of hero | |
| PH-4 | Profile header name | Large bold display name below avatar | |
| PH-5 | Profile tabs | Underline-style tabs with ARIA tablist semantics | |
| PH-6 | Profile actions | Text-style buttons (not LianButton) with divider | |
| PH-7 | Profile collection cards | Shadow-based cards (no border) | |
| PH-8 | Guest state | AuthPanel renders without GlassPanel wrapper | |
| PH-9 | Editor toggle | Toggling editor shows/hides ProfileEditorPanel | |

## 7. Reduced Motion

| ID | Scenario | Expected | Status |
|----|----------|----------|--------|
| RM-1 | System `prefers-reduced-motion: reduce` | All floating chrome transitions disabled (instant show/hide) | |
| RM-2 | Reduced motion: feed card hover | No translateY lift or shadow transition | |
| RM-3 | Reduced motion: open post detail | Detail opens instantly (no card camera morph) | |
| RM-4 | Reduced motion: close post detail | Detail closes instantly (no return animation) | |
| RM-5 | Reduced motion: tab switch | Tab indicator changes instantly (no slide transition) | |
| RM-6 | Reduced motion: floating chrome | `transition: none`, `transform: none`, `filter: none` enforced | |
| RM-7 | Reduced motion: probe/feed update animation | Disabled; probe appears/disappears instantly | |
| RM-8 | Spinners exempt from reduced motion | `lian-spin` animation continues under reduced motion | |

---

## Automated Test Coverage Map

| Checklist Section | Structure Test File | Runtime Test File |
|-------------------|--------------------|--------------------|
| Shell Layout | `tests/shell/shell-regression.structure.test.mjs` | `tests/shell/shell-layout-modes.test.ts` |
| Safe-Area Spacing | `tests/shell/safe-area-spacing.structure.test.mjs` | -- (CSS-only, manual verify) |
| Floating Chrome | `tests/shell/shell-regression.structure.test.mjs` | `tests/shell/shell-chrome.test.ts` |
| Map Sizing | `tests/shell/map-sizing-regression.structure.test.mjs` | `tests/shell/map-chrome.test.ts` |
| Messages Composer | `tests/messages/messages-composer-regression.structure.test.mjs` | -- |
| Profile Hero | `tests/profile/profile-hero-regression.structure.test.mjs` | `tests/profile/profile-chrome.test.ts` |
| Reduced Motion | `tests/motion/reduced-motion-regression.structure.test.mjs` | `tests/motion/useReducedMotion.test.ts` |

---

## Sign-Off

| Date | Tester | Sections Tested | Pass/Fail | Notes |
|------|--------|-----------------|-----------|-------|
| | | | | |

---

## References

- [Motion verification checklist](motion-verification.md)
- [A11y test checklist](a11y-test-checklist.md)
- [Testing strategy](TESTING_STRATEGY.md)
- [Issue #261 -- shell regression QA coverage](https://github.com/taoyu051818-sys/lian-mobile-web/issues/261)
