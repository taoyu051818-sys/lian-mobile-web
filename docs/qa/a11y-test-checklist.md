# A11y Test Checklist — LIAN Mobile Web

Date: 2026-05-08
Status: **Draft** — documentation slice for #147. No automated tests added in this PR.
Contract: [docs/frontend/a11y-contract.md](../frontend/a11y-contract.md)

---

## How to Use

Each item has a checkbox, the page/region it applies to, and pass/fail criteria.
Mark `[x]` when verified, `[ ]` when pending. Update this file as part of QA cycles.

---

## 1. Keyboard Navigation

### 1.1 Global

- [ ] All interactive elements are reachable via Tab (no keyboard traps except modal dialogs)
- [ ] Tab order follows visual layout (no positive `tabindex` values)
- [ ] `:focus-visible` outline is visible on every focusable element
- [ ] Focus outline has >= 3:1 contrast ratio against background
- [ ] Escape closes the topmost overlay (dialog, sheet, dropdown) and returns focus to trigger

### 1.2 Feed

- [ ] Tab into feed card: focus lands on the primary action (title link / card button), not the `<article>` wrapper
- [ ] Enter on card primary action opens the post detail
- [ ] Tab from card primary action to like button; Space activates like
- [ ] Like button does NOT bubble to card action (`@click.stop` / `@keydown.*.stop` verified)
- [ ] Tab continues to next card after secondary actions

### 1.3 Map

- [ ] Place list items are focusable via Tab
- [ ] Enter/Space on a place item selects it (triggers `selectLocation`)
- [ ] Active/selected place has `aria-pressed="true"` or `aria-current="true"`
- [ ] If map markers are keyboard-accessible: Tab to marker, Enter/Space selects
- [ ] If map is NOT keyboard-accessible: place list provides full equivalent operations

### 1.4 Dialogs / Sheets

- [ ] Opening a dialog moves focus to the first focusable element or dialog container
- [ ] Tab cycles within the dialog (focus trap)
- [ ] Shift+Tab cycles backward within the dialog
- [ ] Closing dialog (Escape or close button) returns focus to the trigger element

### 1.5 Toast

- [ ] Toast appearance does NOT steal focus from current context
- [ ] Toast close button is focusable via Tab (if toast is still visible)
- [ ] Enter/Space on toast close button dismisses the toast

---

## 2. Screen Reader Announcements

### 2.1 Live Regions

- [ ] Toast container has `aria-live="polite"` and `aria-relevant="additions"` (NOT `removals`)
- [ ] Critical error toasts use `aria-live="assertive"` / `role="alert"`
- [ ] Loading status (user-initiated, > 3s) announces via `role="status"` / `aria-live="polite"`
- [ ] Background refresh / new content does NOT announce (silent update)
- [ ] New messages/notifications announce via `aria-live="polite"` without interrupting current reading

### 2.2 Feed

- [ ] Card primary action `aria-label` includes title, author, and location (when available)
- [ ] Like button `aria-label` changes state text (e.g., "Like" / "Unlike", not just icon change)
- [ ] Feed loading state is announced to screen readers
- [ ] Empty feed state is announced

### 2.3 Map

- [ ] Place list item `aria-label` includes place name and type
- [ ] Marker button `aria-label` includes place name (e.g., "Select place: X")
- [ ] Non-interactive markers/overlays have `aria-hidden="true"`
- [ ] Active place selection is announced to screen readers

### 2.4 Page / View

- [ ] View change (route navigation) announces the new page title or moves focus to heading
- [ ] `document.title` updates on view change (pattern: "View Name — LIAN")

---

## 3. Landmarks and Headings

- [ ] Page has exactly one `<main>` landmark
- [ ] Each primary view has a labeled `<section>` or landmark with `aria-label`
- [ ] Navigation regions use `<nav>` with descriptive `aria-label`
- [ ] Each view has exactly one `<h1>` or `<h2>` as primary heading
- [ ] Sub-headings follow strict hierarchy (no skipped levels: h2 -> h3, not h2 -> h4)
- [ ] Screen reader landmark navigation (rotor) shows meaningful structure

---

## 4. Forms

- [ ] Every `<input>`, `<select>`, `<textarea>` has an associated `<label>` (via `for`/`id` or wrapping)
- [ ] Inline error messages are linked to fields via `aria-describedby`
- [ ] Required fields have `aria-required="true"` or visual indicator with screen reader text
- [ ] Disabled submit buttons have explanatory text (not just `disabled` attribute)
- [ ] Countdown/cooldown states (429, rate limit) are announced to screen readers

---

## 5. Visual / Motion

- [ ] All text meets WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text)
- [ ] Interactive element outlines meet 3:1 contrast ratio
- [ ] `prefers-reduced-motion: reduce` disables non-essential animations
- [ ] Hover-only feedback has an equivalent `:focus-visible` state
- [ ] Glass/blur backgrounds do not reduce text contrast below AA thresholds

---

## 6. Automated Checks (Future)

These are NOT implemented in this PR. Track under #147 P2 and #133.

- [ ] axe-core integrated into Playwright smoke tests
- [ ] Keyboard-only test path covers Feed, Map, Auth, Publish, Detail, Messages
- [ ] CI gate fails on new a11y violations (axe-core baseline)
- [ ] Lint rule: no `@click` on non-interactive elements without keyboard equivalent

---

## 7. Sign-Off

| Date | Tester | Pages Tested | Pass/Fail | Notes |
|------|--------|--------------|-----------|-------|
| | | | | |

---

## References

- [Accessibility contract](../frontend/a11y-contract.md)
- [Issue #147 — semantic accessibility audit](https://github.com/taoyu051818-sys/lian-mobile-web/issues/147)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
