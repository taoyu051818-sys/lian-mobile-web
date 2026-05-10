# Router and Lifecycle Contract

Status: Active
Date: 2026-05-08
Issue: #110

## Purpose

This contract defines the expected URL, deep-link, view-cache, and error-boundary behavior for the Vue canary shell. It is the reference for any future router integration or lifecycle hardening work. All statements here are **contractual expectations**, not descriptions of current implementation.

## Current state summary

The Vue canary shell uses a ref-based view switcher (`src/app/useActiveView.ts`) with no URL synchronization and no Vue Router. Views are rendered via dynamic `<component :is>` in `src/app/AppViewHost.vue`. There is no centralized error handling — no `app.config.errorHandler`, no `onErrorCaptured`, no `ErrorBoundary` wrapper.

| Concern | Current posture |
|---|---|
| URL sync | None — view state lives only in a module-level ref |
| Deep links | Not supported — entering any URL other than `/` loads the same default state |
| View caching | None — `<component :is>` destroys and recreates views on every switch |
| Error boundary | None — all error handling is per-component try/catch on API calls |

---

## 1. URL and deep-link contract

### 1.1 Canonical URL pattern

When a router is introduced, each tab view MUST map to a stable, human-readable URL path segment. The contract:

| View key | Canonical path | Notes |
|---|---|---|
| `feed` | `/` | Default/landing view |
| `map` | `/explore` | Map and location browsing |
| `publish` | `/publish` | Content creation flow |
| `messages` | `/messages` | Notification and message list |
| `profile` | `/profile` | Current user profile |

### 1.2 Deep-link requirements

- Entering a canonical URL directly in the browser address bar MUST render the corresponding view in its default initial state, with the bottom tab bar reflecting the active tab.
- Refreshing the page at any canonical URL MUST restore the same view, not redirect to `/`.
- Unknown paths MUST fall back to the feed view (`/`) without throwing.
- Query parameters and hash fragments are reserved for in-view state (e.g., scroll position, selected item) and MUST NOT alter which tab view is active.

### 1.3 Legacy coexistence

The legacy static runtime was removed in PR #282 and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy. The Vue/Vite shell is now the sole web runtime. The router contract applies to the Vue/Vite shell.

### 1.4 Browser history

- Each tab switch MUST create a history entry so the browser back button returns to the previous tab.
- The initial page load MUST NOT create a duplicate history entry.

---

## 2. View cache and reset policy

### 2.1 Default behavior: destroy on leave

The current `<component :is>` pattern destroys the outgoing view component when switching tabs. This is the **default and expected** behavior. It means:

- No scroll position is preserved across tab switches.
- No in-memory form state survives a tab switch.
- Each tab entry mounts a fresh component instance.

### 2.2 When to preserve state

Some views carry expensive or user-critical state that SHOULD survive a tab switch. The contract defines two preservation tiers:

| Tier | Scope | Mechanism | Views affected |
|---|---|---|---|
| **Ephemeral** | Destroyed on every tab switch | Default `<component :is>` | `publish` (draft is a separate concern), `messages` |
| **Pinned** | Kept alive across tab switches, destroyed on page unload | Vue `<KeepAlive>` with include list | `map` (Leaflet instance is expensive to recreate), `feed` (scroll position is product-critical) |

### 2.3 KeepAlive constraints

If `<KeepAlive>` is adopted:

- The include list MUST be an explicit allowlist of component names, not a catch-all.
- `max` MUST be set to no more than 3 to bound memory.
- Components in the KeepAlive list MUST use `onActivated` / `onDeactivated` hooks to pause and resume expensive observers (IntersectionObserver, ResizeObserver, Leaflet invalidateSize, scroll listeners).
- Components MUST NOT hold references to DOM nodes across deactivation — those references become stale.

### 2.4 Reset triggers

Even pinned views MUST reset to their initial state when:

- The user explicitly taps the already-active tab (double-tap reset).
- A global auth event occurs (login, logout, token expiry).
- The application detects a hard navigation (page reload, back-forward cache eviction).

The reset signal contract: a composable (e.g., `useViewReset()`) that emits a reset event keyed by view name. Views subscribe in `onMounted` and unsubscribe in `onUnmounted`.

---

## 3. Error boundary contract

### 3.1 Current gap

There is no error boundary at any layer. A rendering error in any view component will crash the entire Vue app, leaving a blank screen.

### 3.2 Required error boundary layers

The contract requires two error boundary layers:

#### Layer 1: App-level handler

`src/main.ts` MUST register `app.config.errorHandler`. This is the last-resort catch for errors that escape component-level handling.

Responsibilities:
- Log the error (console.error at minimum; structured logging when available).
- Show a non-blocking toast or inline message to the user.
- MUST NOT unmount the app or replace the DOM with an error page.
- MUST recover gracefully — the next render cycle should proceed normally.

#### Layer 2: View-level boundary

Each view rendered by `AppViewHost.vue` MUST be wrapped in an error boundary component (e.g., `ViewErrorBoundary.vue`) that:

- Catches rendering errors from the view subtree via `onErrorCaptured`.
- Displays a fallback UI within the view area (not full-screen), consisting of a brief error message and a "Retry" action.
- On retry, forces a re-render of the wrapped view component (e.g., by toggling a key).
- Reports the error upward via a callback prop for logging.
- Does NOT catch errors in sibling views or the shell chrome (tab bar, toast host).

### 3.3 Error boundary component contract

```
ViewErrorBoundary
  props:
    viewKey: AppViewKey       // for logging and retry context
    onError?: (err, info) => void  // optional reporting callback
  slots:
    default                    // the wrapped view component
  behavior:
    - Renders default slot normally when no error
    - On error: logs, calls onError, renders fallback UI
    - Fallback UI includes: error icon, brief message, retry button
    - Retry: increments internal key to force re-mount of default slot
```

### 3.4 Async error handling

Error boundaries do NOT catch errors in async operations (API calls, timers). Those MUST remain as per-component try/catch, which is the current pattern. The contract does not change this — async error handling stays localized.

### 3.5 What error boundaries MUST NOT do

- MUST NOT catch errors in event handlers (those are already synchronous call stacks handled by try/catch).
- MUST NOT swallow errors silently — every caught error MUST be logged.
- MUST NOT show stack traces or technical details to the user in production.
- MUST NOT prevent the user from navigating away from an errored view.

---

## 4. Navigation guard contract (future)

When Vue Router is adopted, the following guard rules apply:

| Guard | Trigger | Behavior |
|---|---|---|
| `beforeEach` | Any route change | Check auth state; redirect unauthenticated users to a login surface if the target route requires auth |
| `beforeResolve` | After all async components loaded | Validate route params; redirect to `/` if params are invalid |
| `afterEach` | Route change committed | Scroll to top (or restored position if `scrollBehavior` is configured); emit analytics event |

These guards are documented here for planning purposes. They do not apply until Vue Router is installed.

---

## 5. View-key registry

All code that switches views MUST use the `AppViewKey` type from `src/app/view-types.ts` as the single source of truth for valid view identifiers. Adding a new view requires:

1. Adding the key to the `AppViewKey` union type.
2. Adding the definition to the `appViews` array.
3. Adding the component mapping in `AppViewHost.vue`.
4. Adding the canonical path to the URL mapping table in this contract (Section 1.1).
5. Deciding the cache tier (Section 2.2) and documenting the rationale.

---

## 6. Acceptance criteria

A PR that claims to satisfy this contract MUST demonstrate:

- [ ] Each canonical URL renders the correct view on direct navigation.
- [ ] Page refresh at any canonical URL preserves the view.
- [ ] Browser back/forward navigates between previously visited tabs.
- [ ] Unknown paths render the feed view without error.
- [ ] `app.config.errorHandler` is registered and logs errors.
- [ ] View-level error boundary catches rendering errors and shows fallback UI.
- [ ] Retry in error boundary re-mounts the view.
- [ ] KeepAlive include list (if adopted) is an explicit allowlist with `max <= 3`.
- [ ] Double-tap on active tab triggers view reset.
- [ ] No runtime code outside `src/` is modified (except docs).

---

## 7. Non-goals

This contract does NOT cover:

- Page-level code splitting or lazy loading strategy.
- Transition animations between views (covered by `docs/design/card-camera-transition.md`).
- Backend API routing (covered by `docs/agent/contracts/api-contract.md`).
- Legacy static rehearsal routing (covered by `docs/ops/runtime-inventory.md`).
- SEO, SSR, or pre-rendering.

---

## 8. References

- `src/app/useActiveView.ts` — current view switcher composable
- `src/app/view-types.ts` — view key type and registry
- `src/app/AppViewHost.vue` — dynamic component host
- `src/App.vue` — shell layout with tab bar
- `src/main.ts` — app entry point
- `docs/architecture/0001-vue3-vite-typescript-ui-entry.md` — Vue 3 migration ADR
- `docs/ops/runtime-inventory.md` — runtime port and deployment contract
- `docs/design/card-camera-transition.md` — transition motion model
