# UI Primitive Contract

Last updated: 2026-05-08

Defines responsibilities, side-effect boundaries, accessibility expectations, and review guardrails for shared UI primitives in `src/ui/`.

## Scope

Applies to all files under `src/ui/`:

- `LianButton`
- `Sheet`
- `SafeHtml`
- `Toast` / `ToastHost`
- `InlineError`
- `TopBar` / `BottomTabBar`
- `GlassPanel`
- `IdentityBadge` / `TrustBadge`
- `LocationChip` / `TagChip` / `TypeChip`

## 1. Primitive responsibilities

UI primitives are **presentation-only**. They own:

- Visual rendering (variant, size, state)
- Semantic markup (role, aria attributes)
- User interaction events (click, dismiss, keyboard)
- Minimal internal state (open/closed, focused)

They do **not** own:

- Business logic (pagination, auth, API calls)
- Domain-specific behavior (feed loading, map interaction)
- Data fetching or transformation
- Route navigation decisions

### Rule: no business selectors

UI primitives must not reference view-specific CSS classes, API paths, domain types, or route keys.

Forbidden patterns in `src/ui/**`:

- `.feed-view__*`, `.map-*`, `.publish-*`
- `fetch(`, `/api/`
- Domain-specific imports from `src/views/` or `src/server/`

## 2. Side-effect boundaries

### Allowed side effects

| Side effect | Allowed | Requirements |
|-------------|---------|--------------|
| DOM event listeners | Yes | Must cleanup in `onUnmounted` / `onBeforeUnmount` |
| `IntersectionObserver` | Yes | Must disconnect on unmount |
| `MutationObserver` | Yes | Must disconnect on unmount |
| `setTimeout` / `setInterval` | Yes | Must clear on unmount |
| `Teleport` | Yes | Document target in contract |
| Body class/style mutation | Yes | Must restore on unmount |
| `v-html` | Only via `SafeHtml` | Never direct in other primitives |

### Forbidden side effects

- Network requests (`fetch`, `axios`, WebSocket)
- Router navigation (`push`, `replace`, `back`)
- Global state mutation (Pinia, Vuex, window globals)
- `localStorage` / `sessionStorage` writes
- Analytics event emission

### Contract requirement

Any primitive with allowed side effects must document:

1. What the side effect is
2. When it activates (mount, interaction, prop change)
3. How it cleans up
4. How to test the cleanup

## 3. Accessibility expectations

### All primitives

- Interactive elements must have accessible names (`aria-label`, `aria-labelledby`, or visible text)
- Disabled state must use `aria-disabled="true"` or native `disabled` attribute
- Loading state must set `aria-busy="true"` when applicable
- Color alone must not convey state (use icons, text, or borders)

### LianButton

| State | ARIA requirement |
|-------|------------------|
| Default | `role="button"` (if not `<button>`) |
| Loading | `aria-busy="true"`, disable click |
| Disabled | `aria-disabled="true"` or `disabled` |
| Icon-only | `aria-label` required |
| Toggle | `aria-pressed` for toggle variant |

Minimum touch target: 44x44px.

### Sheet

| Feature | Requirement |
|---------|-------------|
| Role | `role="dialog"` |
| Modal | `aria-modal="true"` |
| Label | `aria-labelledby` pointing to title element |
| Focus trap | Trap focus within sheet when open |
| Focus return | Return focus to trigger element on close |
| Escape | Close on Escape key |
| Scroll lock | Prevent body scroll when open |
| Backdrop | Click backdrop to close (optional, must be explicit) |

### Toast / InlineError

| Feature | Requirement |
|---------|-------------|
| Live region | `role="status"` or `aria-live="polite"` |
| Error | `role="alert"` or `aria-live="assertive"` |
| Auto-dismiss | Announce dismissal to screen readers |

### Chips / Badges

| Feature | Requirement |
|---------|-------------|
| Interactive | `role="button"` + keyboard activation |
| Selected | `aria-pressed` or `aria-selected` |
| Status | `aria-label` describing meaning |

## 4. Review guardrails

### Pre-merge checklist for UI primitive changes

- [ ] No business selectors (`.feed-*`, `.map-*`, etc.)
- [ ] No API calls or domain imports
- [ ] Side effects documented and cleaned up
- [ ] Accessibility attributes present for all states
- [ ] Touch target >= 44px for interactive elements
- [ ] Keyboard navigation works (Tab, Enter, Escape where applicable)
- [ ] Screen reader announces state changes
- [ ] No `v-html` except in `SafeHtml`

### Static guard (recommended)

Add ESLint rule or CI check:

```
src/ui/** must not contain:
- /\.feed-|\.map-|\.publish-|\.detail-/
- /fetch\(|\/api\//
- /import.*from.*views\//
- /import.*from.*server\//
```

### SafeHtml profiles

`SafeHtml` must accept an explicit `profile` prop:

| Profile | Use case | Allowed tags |
|---------|----------|--------------|
| `plainTextOnly` | Default, strictest | None (text only) |
| `excerpt` | Post previews | `b`, `i`, `em`, `strong` |
| `trustedSystem` | Backend-generated HTML | `p`, `br`, `span`, `a` |
| `ugcPost` | User-generated content | Per #157 allowlist |

Default: `plainTextOnly`. Callers must explicitly opt into richer profiles.

## 5. Migration notes

### LianButton auto-load removal

Current state: `LianButton` contains IntersectionObserver that auto-clicks when inside `.feed-view__load-more`.

Target state:

1. Remove IntersectionObserver from `LianButton`
2. Create `useInfiniteScrollSentinel()` composable
3. FeedView uses sentinel for auto-load behavior
4. `LianButton` becomes pure presentation

### Sheet dialog completion

Current state: `Sheet` has `role="dialog"` but lacks focus trap, Escape, scroll lock.

Target state: Implement missing features or explicitly document as non-modal panel.

## References

- Issue #187: UI primitive responsibilities and shared component contracts
- Issue #135: Overlay layer / z-index / focus stack
- Issue #147: Accessibility / focus / reduced motion
- Issue #157: UGC HTML sanitization
- Issue #162: Form attributes and field accessibility
- Issue #186: Toast / feedback channel
