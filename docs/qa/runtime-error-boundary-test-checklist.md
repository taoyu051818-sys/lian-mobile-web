# Runtime Error Boundary — Test Checklist

Issue: [#185](https://github.com/taoyu051818-sys/lian-mobile-web/issues/185)
Contract: `docs/frontend/runtime-error-boundary-contract.md`

Minimal test checklist for the runtime error boundary implementation. Each item maps to a contract section. Tests should run against both `legacy` (4300) and `vue-canary` (4301) lanes where applicable.

---

## T1 — View Render Error → Fallback Shown (Contract §2)

- [ ] **T1a.** Inject a `throw new Error('test-render')` in a Feed component's `render()`. Verify:
  - Fallback UI appears in the Feed view area.
  - Bottom tab bar remains visible and functional.
  - Other views (Map, Profile, Messages, Publish) are unaffected.
- [ ] **T1b.** Same test in Map, Publish, Messages, and Profile views. Verify each view fails independently.
- [ ] **T1c.** Verify the fallback contains `role="alert"` and `aria-live="assertive"`.

## T2 — View Setup Error → Fallback Shown (Contract §2)

- [ ] **T2a.** Inject a `throw new Error('test-setup')` in a component's `setup()` function. Verify fallback appears.
- [ ] **T2b.** Verify the bottom tab bar remains functional after setup error.

## T3 — Tab Switch Resets Error State (Contract §2.3)

- [ ] **T3a.** Trigger a render error in Feed. Switch to Map tab. Switch back to Feed. Verify Feed re-renders (error state cleared).
- [ ] **T3b.** Trigger a render error in Feed. Switch to Map. Verify Map renders normally (no error bleed).

## T4 — Unhandled Promise Rejection Captured (Contract §1.3)

- [ ] **T4a.** In an event handler, `Promise.reject(new Error('test-rejection'))` without `.catch()`. Verify diagnostics event is emitted.
- [ ] **T4b.** `throw` an `AbortError` in an async handler. Verify it is demoted to debug (not shown to user).
- [ ] **T4c.** Reject with a non-Error value (`Promise.reject('string')`). Verify diagnostics event is emitted with `message: 'string'`.
- [ ] **T4d.** Fire 5 identical rejections within 1 second. Verify diagnostics receives only 1 event with `count: 5`.

## T5 — Global Error Handler (Contract §1.1, §1.2)

- [ ] **T5a.** Trigger an error outside Vue's boundary (e.g., in a `setTimeout` callback not wrapped by Vue). Verify diagnostics event with `errorKind: 'global'`.
- [ ] **T5b.** Verify `app.config.errorHandler` is registered before `app.mount()` (code review / unit test).

## T6 — Bootstrap Failure → Static Fallback (Contract §3)

- [ ] **T6a.** Simulate a mount-time error (e.g., corrupt a required import). Verify the static fallback UI appears (not a blank white page).
- [ ] **T6b.** Verify the static fallback contains a "重新加载" button that triggers `location.reload()`.
- [ ] **T6c.** Verify the static fallback displays an error code.
- [ ] **T6d.** Verify fallback styles render correctly without external CSS (inline styles or `<style>` in `index.html`).

## T7 — Recovery Actions (Contract §4)

- [ ] **T7a.** **Retry render (Tier 1):** Click "重试" on the fallback. Verify the component re-renders. If the error persists, fallback re-appears.
- [ ] **T7b.** **Go home (Tier 1):** Click "回到首页". Verify navigation to Feed tab.
- [ ] **T7c.** **Reload app (Tier 3):** Click "刷新应用". Verify full page reload.
- [ ] **T7d.** **Draft preservation:** In Publish view with an unsaved draft, trigger a view error. Click "刷新应用". Verify the draft survives the reload.
- [ ] **T7e.** **Draft loss warning:** In Publish view with an unsaved draft, trigger a view error. If Tier 4 (clear cache) is available, verify a confirmation dialog appears before clearing.

## T8 — Privacy-Safe Diagnostics (Contract §5)

- [ ] **T8a.** Trigger an error in a component with user-entered text visible. Verify the diagnostics payload does NOT contain:
  - Post title, message content, profile bio text
  - Image URLs, CDN paths
  - Client ID, user ID, alias ID
  - Email, username
  - GPS coordinates, precise location
  - Full URL query strings
  - Cookie values, auth tokens
- [ ] **T8b.** Verify the diagnostics payload contains exactly: `runtime`, `view`, `componentName`, `errorKind`, `messageHash`, `stackHash`, `releaseId`, `timestamp`.
- [ ] **T8c.** Verify `messageHash` and `stackHash` are 16-character hex strings.
- [ ] **T8d.** Verify `runtime` is either `'vue-canary'` or `'legacy'`.

## T9 — Dev Mode Behavior (Contract §5.4, §6)

- [ ] **T9a.** In dev mode, trigger an error. Verify `console.error` outputs the full stack trace.
- [ ] **T9b.** In dev mode, verify no network request is sent to a diagnostics endpoint.
- [ ] **T9c.** In production mode, verify `console.error` is NOT called for runtime errors.
- [ ] **T9d.** In production mode, verify diagnostics are dispatched to the configured endpoint.

## T10 — Accessibility (Contract §2.1)

- [ ] **T10a.** Verify fallback UI has `role="alert"` and `aria-live="assertive"`.
- [ ] **T10b.** Verify all fallback buttons ("重试", "回到首页", "刷新应用") are keyboard-focusable and operable with Enter/Space.
- [ ] **T10c.** Verify fallback text has sufficient contrast ratio (4.5:1 for normal text).
- [ ] **T10d.** Verify screen reader announces the fallback heading and message when the error occurs.

## T11 — Auth Errors NOT Caught by Boundary (Contract §4.3)

- [ ] **T11a.** Trigger a 401 response from the API. Verify the auth flow handles it (redirect to login or show auth prompt), NOT the error boundary fallback.
- [ ] **T11b.** Trigger a 403 response. Verify it is handled by the auth/permission flow, not the error boundary.

---

## Running This Checklist

1. Start both lanes: `npm start`
2. Open `http://127.0.0.1:4301` (Vue canary) in Chrome DevTools
3. Use the Vue DevTools to inject errors or modify component behavior for T1–T3
4. Use the browser console for T4–T5 (promise rejections, global errors)
5. For T6, temporarily break an import in `main.ts` or corrupt the bundle
6. For T8, inspect network requests in the DevTools Network tab
7. For T9, toggle between `import.meta.env.DEV` and production builds
8. For T10, use Chrome DevTools Accessibility panel and keyboard navigation
9. Repeat critical tests (T1, T2, T4, T7) against `http://127.0.0.1:4300` (legacy lane) if the boundary applies there

---

## Not Covered Here

- HTTP/API error handling (see `docs/agent/contracts/api-contract.md`)
- Product analytics event routing (see #158)
- E2E tests across real devices (future — #133)
- Performance impact of error boundary overhead (future — benchmark after implementation)
