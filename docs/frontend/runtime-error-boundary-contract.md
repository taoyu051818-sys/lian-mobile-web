# Runtime Error Boundary Contract

Issue: [#185](https://github.com/taoyu051818-sys/lian-mobile-web/issues/185)
Status: **Contract — not yet implemented**
Date: 2026-05-08

This document defines the runtime error boundary contract for the LIAN Mobile Web Vue frontend. It covers global error handling, view-level fallback, fatal bootstrap fallback, recovery actions, privacy-safe diagnostics, and dev/prod warning policy. It does not cover HTTP/API error handling (see `docs/agent/contracts/api-contract.md`) or product analytics (see #158).

---

## 1. Global Error Handler

### 1.1 Vue `app.config.errorHandler`

`main.ts` must register a global error handler before `app.mount()`:

```ts
app.config.errorHandler = (err, instance, info) => {
  reportRuntimeError({
    kind: 'vue-component',
    error: err,
    componentName: instance?.$options?.name ?? instance?.$?.type?.name ?? 'unknown',
    info,
  });
};
```

**Behavior:**

- Captures errors from component `setup()`, `render()`, computed, watchers, and lifecycle hooks.
- Does NOT prevent the error from propagating to `onErrorCaptured` boundaries — the handler logs/report only.
- In dev mode, also logs to `console.error` with full stack for local debugging.
- In production, delegates to the privacy-safe diagnostics pipeline (Section 5).

### 1.2 `window.onerror`

```ts
window.onerror = (message, source, lineno, colno, error) => {
  reportRuntimeError({
    kind: 'global',
    error: error ?? new Error(String(message)),
    source,
    lineno,
    colno,
  });
};
```

Catches errors outside Vue's try/catch boundary (e.g., in `<script>` tags, non-Vue event handlers, third-party scripts).

### 1.3 `window.onunhandledrejection`

```ts
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (isIgnorableRejection(reason)) {
    // AbortController cancel, timeout, user navigation — demote to debug
    return;
  }
  reportRuntimeError({
    kind: 'unhandled-rejection',
    error: reason instanceof Error ? reason : new Error(String(reason)),
  });
});
```

**Ignorable rejection patterns** (demoted to debug, not shown to user):

- `AbortError` / `signal.aborted` — fetch cancelled by navigation or user action.
- `TimeoutError` — network timeout already handled by API layer.
- `NavigationDuplicated` — Vue Router duplicate navigation.
- Known third-party library cancellation patterns.

**Non-ignorable rejections** (surface to user as toast or view fallback):

- Unexpected promise rejections from image upload, map init, push registration, background refresh.

---

## 2. View-Level Error Boundary

### 2.1 `ViewErrorBoundary` Component

A Vue component that wraps each main view in `AppViewHost`. Uses Vue 3's `onErrorCaptured` hook.

**Props:**

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `viewKey` | `string` | required | Matches `AppViewHost` active view key (feed, map, publish, messages, profile) |
| `fallbackTitle` | `string` | `'页面暂时出错'` | Accessible fallback heading |
| `fallbackMessage` | `string` | `'请重试或切换到其他页面'` | User-facing explanation |

**Template structure:**

```html
<div v-if="hasError" role="alert" aria-live="assertive">
  <h2>{{ fallbackTitle }}</h2>
  <p>{{ fallbackMessage }}</p>
  <button @click="retryRender">重试</button>
  <button @click="goHome">回到首页</button>
  <button @click="reloadApp">刷新应用</button>
</div>
<slot v-else />
```

### 2.2 Placement in `AppViewHost`

Each view rendered by `AppViewHost` must be wrapped:

```html
<ViewErrorBoundary :view-key="activeViewKey">
  <component :is="activeView" />
</ViewErrorBoundary>
```

**Isolation guarantee:** A render/setup error in Feed does not crash Map, Publish, Messages, or Profile. The bottom tab bar remains functional.

### 2.3 View Reset on Tab Switch

When the user switches tabs:

- If the target view has a recorded error state, the boundary resets and re-renders.
- If the target view was previously healthy, no change.
- Error state is per-viewKey, not global.

---

## 3. Fatal Bootstrap Fallback

### 3.1 `main.ts` Mount Guard

```ts
try {
  const app = createApp(App);
  // register error handler, plugins, etc.
  app.mount('#vue-root');
} catch (err) {
  renderFatalFallback(err);
}
```

### 3.2 Static Fallback HTML

If the Vue app fails to mount (bundle load failure, import error, mount exception), render a minimal non-Vue fallback into `#vue-root`:

```html
<div id="vue-root">
  <!-- Replaced by Vue app on success; remains visible on bootstrap failure -->
  <noscript>
    <p>请启用 JavaScript 以使用此应用。</p>
  </noscript>
</div>
```

The `renderFatalFallback()` function injects:

```html
<div role="alert" aria-live="assertive">
  <h1>应用加载失败</h1>
  <p>请尝试刷新页面。如果问题持续，请清除浏览器缓存后重试。</p>
  <button onclick="location.reload()">重新加载</button>
  <p>错误代码: <code>{errorId}</code></p>
</div>
```

### 3.3 CSS for Fallback

Fallback styles must be inlined or in `<style>` within `index.html` (not in a CSS bundle that may fail to load):

```css
#vue-root:empty::after,
#vue-root > .fatal-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
  text-align: center;
  font-family: system-ui, sans-serif;
}
```

---

## 4. Recovery Actions

### 4.1 Recovery Tiers

| Tier | Action | Scope | Side Effects |
|------|--------|-------|-------------|
| 1 — Retry render | Reset error boundary, re-render the failing component | Single view | None — preserves all state |
| 2 — Reset view state | Call view-specific reset hook, then re-render | Single view | Clears view-local state (list scroll, map position, form inputs) |
| 3 — Reload app | `location.reload()` | Entire app | Full page reload; draft/auto-save preserved per Section 4.2 |
| 4 — Clear local cache | `localStorage.clear()` + reload | Entire app | **Destructive** — requires user confirmation dialog |

### 4.2 Draft Preservation

Before Tier 3/4 recovery actions, the boundary MUST check for unsaved drafts:

- **Publish view:** If a draft exists in auto-save (#136), prompt the user before reload. Draft survives `location.reload()` (persisted in localStorage). Draft does NOT survive `localStorage.clear()`.
- **Messages view:** If the user has typed but not sent a message, warn before reload.
- **Profile editor:** If unsaved profile changes exist, warn before reload.

### 4.3 Session/Auth Errors

Errors from auth/session middleware (401, 403, token expiry) are NOT runtime errors. They must be handled by the auth flow (#159), not by error boundaries. The error handler must detect and skip auth-related errors:

```ts
if (isAuthError(err)) {
  // Delegate to auth flow, not error boundary
  return;
}
```

### 4.4 Per-View Reset Hooks

| View | Reset Behavior |
|------|---------------|
| Feed | Clear list state, reset pagination, scroll to top |
| Map | Destroy and reinitialize Leaflet instance, reset center/zoom |
| Publish | Preserve draft (auto-save), reset form to last saved state |
| Messages | Clear unread markers, scroll to latest |
| Profile | Refetch profile data, reset to overview tab |

---

## 5. Privacy-Safe Diagnostics

### 5.1 Allowed Fields

The runtime error reporter MUST include ONLY these fields:

| Field | Type | Description |
|-------|------|-------------|
| `runtime` | `string` | `'vue-canary'` or `'legacy'` |
| `view` | `string` | Active view key: `'feed'`, `'map'`, `'publish'`, `'messages'`, `'profile'`, `'unknown'` |
| `componentName` | `string` | Vue component name or `'unknown'` |
| `errorKind` | `string` | `'vue-component'`, `'global'`, `'unhandled-rejection'`, `'bootstrap'` |
| `messageHash` | `string` | SHA-256 of error message (first 16 hex chars) |
| `stackHash` | `string` | SHA-256 of first 3 stack frames (first 16 hex chars) |
| `releaseId` | `string` | Build version / git SHA |
| `timestamp` | `number` | `Date.now()` |

### 5.2 Forbidden Fields

The reporter MUST NOT include:

- User-entered text (post titles, message content, profile bio)
- Image URLs, file URLs, CDN paths
- Client ID, user ID, alias ID, alias name
- Email, username, phone
- Exact GPS coordinates, precise location names
- Full URL query strings, search params, hash fragments
- LocalStorage/sessionStorage contents
- Cookie values, auth tokens

### 5.3 Deduplication

- Errors with the same `(view, componentName, errorKind, messageHash, stackHash)` tuple are deduplicated within a 60-second window.
- Dedup counter is included as `count` field.
- Prevents error storms from overwhelming diagnostics.

### 5.4 Dev vs. Production Pipeline

| Environment | Behavior |
|-------------|----------|
| Development | `console.error` with full stack, component tree, and props snapshot. No network reporting. |
| Production | Privacy-safe fields only. Dispatched to diagnostics endpoint (see #126). Console suppressed. |

---

## 6. Dev/Prod Warning Policy

### 6.1 `app.config.warnHandler` (Development Only)

```ts
if (import.meta.env.DEV) {
  app.config.warnHandler = (msg, instance, trace) => {
    if (isHighRiskWarning(msg)) {
      console.warn('[Vue HIGH-RISK]', msg, trace);
    }
  };
}
```

High-risk warnings: recursive component invocation, missing required props, invalid prop types, runtime template compilation errors.

### 6.2 Production Warning Suppression

- Production builds suppress all Vue warnings by default (Vue 3 production build does this automatically).
- The warn handler is NOT registered in production.
- CI/test environments treat known high-risk warnings as test failures.

---

## 7. Implementation Follow-Up (Not in This PR)

This document is the **contract only**. The following implementation tasks are tracked in #185 and are NOT part of this docs slice:

- [ ] Create `src/platform/runtimeErrors.ts` — error reporter module
- [ ] Create `src/components/ViewErrorBoundary.vue` — boundary component
- [ ] Modify `src/main.ts` — register global handlers and bootstrap guard
- [ ] Modify `src/App.vue` / `src/app/AppViewHost.vue` — wrap views with boundary
- [ ] Add fatal fallback markup to `index.html`
- [ ] Add inline fallback styles to `index.html`
- [ ] Implement per-view reset hooks in each view component
- [ ] Wire diagnostics to observability pipeline (#126)
- [ ] Write test suite (see `docs/qa/runtime-error-boundary-test-checklist.md`)
- [ ] Add copy keys to i18n catalog (#153)

---

## 8. Related Issues

| Issue | Relationship |
|-------|-------------|
| #126 | Observability — runtime errors feed into this pipeline |
| #133 | Testing strategy — error boundary tests live here |
| #154 | HTTP client error taxonomy — orthogonal, API-layer only |
| #155 | Debug/probe cleanup — dev console noise |
| #159 | Auth/profile global state — auth errors excluded from boundary |
| #184 | View retention lifecycle — boundary reset on tab switch |
| #158 | Product analytics — runtime errors NOT routed to analytics |
