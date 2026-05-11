# Overlay Layer / Focus-Stack Contract

Date: 2026-05-11
Status: **Foundation** — shared primitive contract for issue #135.
Scope: `src/styles/`, `src/ui/Sheet.vue`, `src/shell/DetailSheet.vue`, `src/ui/feedback/ToastHost.vue`.

---

## 1. Z-Index Scale

All overlay z-index values are defined as CSS custom properties in `src/styles/lian-tokens.css`.

| Token | Value | Used by |
|-------|-------|---------|
| `--z-chrome` | 70 | Floating chrome bars, bottom tab bar area |
| `--z-detail-sheet` | 90 | `DetailSheet` (shell-level overlay) |
| `--z-sheet` | 100 | `Sheet` (generic dialog primitive) |
| `--z-toast` | 200 | `ToastHost` (feedback notifications) |

Backward compat: `--floating-bar-z` aliases `--z-chrome`.

Map overlays use a separate high range (700+) and are out of scope for this contract.

### Ordering invariant

```
chrome (70) < detail-sheet (90) < sheet (100) < toast (200)
```

The sheet layer sits above the detail sheet so that confirmations, pickers, and other modal dialogs can appear over the detail panel. Toasts always float above everything.

### Adding new layers

To add a new overlay layer:

1. Add a `--z-<name>` token in `lian-tokens.css` at the correct position in the scale.
2. Use `var(--z-<name>)` in the component CSS. Never hardcode a z-index number.
3. Update the test in `tests/overlay/overlay-layer-contract.test.mjs` to cover the new token.
4. Update this document's table.

---

## 2. Focus Stack

### Behavior contract

All dialog-type overlays (`Sheet`, `DetailSheet`) must:

| Feature | Requirement |
|---------|-------------|
| `role="dialog"` | Present on the overlay root element |
| `aria-modal="true"` | Present on the overlay root element |
| `aria-label` | Descriptive label for screen readers |
| Escape key | Closes the overlay, stops propagation |
| Return focus | On close, focus returns to the element that triggered the open |
| Scroll lock | `body { overflow: hidden }` while open; removed on close |
| Teleport | Overlay is portalled to `<body>` to avoid z-index stacking context issues |

### Focus trap (future)

A full focus-trap implementation (cycle Tab within the dialog) is not yet implemented. The current contract covers Escape-close and return-focus. Focus-trap composable work is tracked separately.

---

## 3. Scroll Lock

When a dialog overlay opens:

1. Save `document.activeElement` as the trigger element.
2. Set `document.body.style.overflow = "hidden"`.
3. On close (or unmount), remove the overflow style and restore focus.

This is a simple body-scroll lock. If nested overlays are needed in the future, a ref-counted approach will be required.

---

## 4. Toast Layer

Toasts are non-modal. They:

- Use `aria-live="polite"` for screen reader announcements.
- Do **not** steal focus from the current context.
- Float at `--z-toast` (200) to appear above all other layers.
- Use `pointer-events: none` on the host, `pointer-events: auto` on individual items.

---

## 5. Reduced Motion

All overlay transitions must respect `prefers-reduced-motion: reduce`. See `docs/frontend/motion-contract.md` for the full reduced-motion policy.

---

## 6. References

- [Issue #135 — overlay z-index / focus trap / scroll lock](https://github.com/taoyu051818-sys/lian-mobile-web/issues/135)
- [UI primitive contract](./ui-primitive-contract.md)
- [Accessibility contract](./a11y-contract.md)
- [Motion contract](./motion-contract.md)
- [Shell content architecture](./shell-content-architecture.md)
