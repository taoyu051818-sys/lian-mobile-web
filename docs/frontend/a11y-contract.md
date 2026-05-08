# Accessibility Contract — LIAN Mobile Web

Date: 2026-05-08
Status: **Draft** — documentation slice for #147. Runtime implementation tracked separately.
Scope: `docs/frontend/` and `docs/qa/` only; no source or infrastructure changes.

---

## 1. Semantic Interaction Rules

### 1.1 Interactive elements must be native or explicitly roled

- Clickable regions that perform an action MUST use `<button>`, `<a>`, or an element with `role="button"` + `tabindex="0"` + Enter/Space handlers.
- Non-interactive elements (`<div>`, `<article>`, `<span>`) MUST NOT have click handlers without corresponding keyboard support and ARIA role.
- Cards that contain interactive children (e.g., like button inside a feed card) MUST NOT wrap the entire card in `role="button"`. Instead, use an explicit primary action element (title link, overlay button) while preserving the card's semantic role.

### 1.2 Feed cards

- The card container uses `<article>` to preserve content semantics.
- The primary navigation action (open detail) is an explicit `<a>` or `<button>` inside the card (e.g., title link or card-level action button).
- Secondary actions (like, share) are standalone `<button>` elements with clear `aria-label` text.
- `@click.stop` / `@keydown.*.stop` on nested buttons prevents event bubbling to the card action.
- `aria-label` on the primary action includes title, author, and location when available.

### 1.3 Map place list items

- Each place item in the list is a `<button>` or contains an explicit `<button>` child.
- Selected/active state is communicated via `aria-pressed="true"` or `aria-current="true"`.
- Enter/Space triggers place selection.

### 1.4 Map markers

- Marker buttons injected via Leaflet `divIcon` have `aria-label` describing the place (e.g., "Select place: X").
- Non-interactive markers (routes, areas, assets) use `aria-hidden="true"` or `tabindex="-1"`.
- If the map itself is not fully keyboard-accessible, the place list MUST provide an equivalent path for all map operations.

### 1.5 Toast / notification

- Toast close buttons are `<button>` elements with `aria-label="Close"`.
- Toast action links (if any) are focusable `<a>` or `<button>` elements.

---

## 2. Keyboard Navigation Expectations

### 2.1 Tab order

- All interactive elements participate in a logical tab order that follows visual layout (left-to-right, top-to-bottom).
- No positive `tabindex` values. Use `tabindex="0"` to include, `tabindex="-1"` to exclude from tab order but allow programmatic focus.
- Skip links or landmark navigation SHOULD be considered for dense pages (Feed, Map).

### 2.2 Activation

| Element | Enter | Space | Escape |
|---------|-------|-------|--------|
| `<button>` | Activate | Activate | — |
| `<a href>` | Navigate | — | — |
| `role="button"` | Activate | Activate | — |
| Dialog / Sheet | Trap focus | — | Close (return focus to trigger) |
| Toast close | Activate | Activate | Dismiss toast |

### 2.3 Focus management

- Opening a dialog/sheet: focus moves to the first focusable element or the dialog itself (`tabindex="-1"`).
- Closing a dialog/sheet: focus returns to the trigger element.
- Toast appearance: does NOT steal focus from the current context (polite announcement only).
- Route/view change: focus moves to the main heading or `<main>` landmark.

### 2.4 Focus visible

- All interactive elements MUST have a visible `:focus-visible` outline.
- Custom focus styles MUST meet 3:1 contrast ratio against adjacent colors.
- `:focus` styles MUST NOT be removed without a `:focus-visible` replacement.

---

## 3. Live-Region Policy

### 3.1 Region types

| Region | `aria-live` | Use case |
|--------|-------------|----------|
| Toast container | `polite` | Non-critical info, success confirmations |
| Toast container (error) | `assertive` | Critical errors that require user attention |
| Loading status | `polite` | "Loading feed…", "Sending…" — only on user-initiated or long operations |
| Background refresh | — | Do NOT announce; new content appears silently |
| New messages/notifications | `polite` | "New messages available" — non-interrupting |

### 3.2 Announcement rules

- Announce **additions** only. Do NOT use `aria-relevant="removals"` — removal announcements create noise for screen readers.
- Loading spinners that last < 1 second do not need announcements.
- Loading that exceeds 3 seconds SHOULD announce start and completion.
- Form validation errors announce via `aria-describedby` on the field, not via live region.
- Success toasts auto-dismiss after ~5 seconds; error toasts persist until user closes.

### 3.3 Implementation pattern

```html
<!-- Toast host -->
<div aria-live="polite" aria-relevant="additions" role="status">
  <!-- Toast items injected here -->
</div>

<!-- Critical error toast override -->
<div aria-live="assertive" aria-relevant="additions" role="alert">
  <!-- Critical error toasts -->
</div>
```

---

## 4. Landmark and Page Title Guidance

### 4.1 Landmark structure

Every page/view MUST have:

- One `<main>` landmark (already present in `App.vue` via `aria-label="LIAN 主内容"`).
- Each primary view (Feed, Map, Messages, Profile, Auth, Publish, Detail) defines a `<section>` or view-level landmark with an `aria-label`.
- Navigation regions (tab bars, sidebars) use `<nav>` with `aria-label`.

### 4.2 Heading hierarchy

- Each view has exactly one `<h1>` or `<h2>` as the primary heading.
- Sub-headings (`<h2>`, `<h3>`) follow a strict hierarchy — no skipped levels.
- Card titles within a list are `<h3>` or lower, nested under the view heading.

### 4.3 Document title

- Route/view changes update `document.title` to reflect the current view.
- Pattern: `"View Name — LIAN"` (e.g., "Feed — LIAN", "Map — LIAN").
- Deep links (shared URLs) set the title on initial load.

---

## 5. Reduced Motion

- All CSS transitions and animations MUST respect `prefers-reduced-motion: reduce`.
- Use the existing motion tokens if available; otherwise wrap in the media query.
- Hover/transform effects that are purely decorative are disabled under reduced motion.
- Functional animations (e.g., loading indicator) slow down but do not stop entirely.

---

## 6. Follow-Up Work (Out of Scope for This PR)

This documentation slice does NOT include runtime code changes. The following items require implementation tracked under related issues:

| Item | Related Issue | Description |
|------|---------------|-------------|
| Feed card refactor | #147 P1 | Replace `role="button"` card wrapper with explicit action element |
| Map list keyboard support | #147 P1 | Add `tabindex`, keyboard handlers, and `aria-pressed` to place items |
| Marker a11y contract | #147 P1 | `aria-label` on marker buttons, `aria-hidden` on non-interactive markers |
| Toast severity split | #147 P1 | Separate `polite` vs `assertive` toast containers; remove `aria-relevant="removals"` |
| Live region helper | #147 P1 | Centralized announcement utility for loading/success/error |
| Landmark + title audit | #147 P1 | Add view-level landmarks, `document.title` sync, heading hierarchy |
| Contrast matrix | #147 P1 | Token-based contrast audit; stylelint guard for low-contrast additions |
| Reduced motion guard | #147 P1 | Audit all transitions/animations against `prefers-reduced-motion` |
| Form a11y checklist | #147 P2 | Label/error association, `aria-describedby`, disabled-state messaging |
| a11y test tooling | #147 P2 | axe-core / Playwright a11y smoke tests |

---

## 7. References

- [Issue #147 — semantic accessibility audit](https://github.com/taoyu051818-sys/lian-mobile-web/issues/147)
- [Issue #107 — dialog/focus/accessibility contract](https://github.com/taoyu051818-sys/lian-mobile-web/issues/107)
- [Issue #113 — form validation / aria errors](https://github.com/taoyu051818-sys/lian-mobile-web/issues/113)
- [Issue #130 — mobile keyboard / visual viewport](https://github.com/taoyu051818-sys/lian-mobile-web/issues/130)
- [Issue #135 — overlay z-index / focus trap / scroll lock](https://github.com/taoyu051818-sys/lian-mobile-web/issues/135)
- [QA test checklist](../qa/a11y-test-checklist.md)
