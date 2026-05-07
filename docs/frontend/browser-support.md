# Browser Support Matrix

Defines the minimum supported environments, feature capability matrix, and fallback policy for LIAN Mobile Web.

## Supported Environments

| Environment | Min Version | Notes |
|---|---|---|
| iOS Safari | 16.4+ | PWA standalone, safe-area, visualViewport |
| Android Chrome | 111+ | PWA standalone, notification, badge |
| Desktop Chrome | 111+ | Development and admin tooling |
| Desktop Safari | 16.4+ | Parity with iOS Safari baseline |
| PWA Standalone | iOS 16.4+ / Android 111+ | `display-mode: standalone` |
| WebView (in-app) | Chromium 111+ | Best-effort; some APIs unavailable |
| WeChat / Built-in Browser | Latest available | Best-effort; limited API surface |

**Unsupported environments** receive a basic readable experience with an upgrade prompt. No interactive features (auth, publish, upload) are guaranteed.

## Feature Capability Matrix

Legend: **F** = Full support, **P** = Partial / requires fallback, **X** = Not available

### `<dialog>` element

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | Same engine as host browser |
| WebView | P | Some older WebViews lack `::backdrop` or Escape handling |
| WeChat | P | Behavior varies across versions |

**Fallback:** Detect `HTMLDialogElement` support. If unavailable, render a custom `Sheet.vue` overlay with manual focus trap, scroll lock, and backdrop. Never block the UI on native `<dialog>` alone — the custom Sheet path must be functionally equivalent.

### `visualViewport` API

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | Critical for keyboard inset detection |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | P | Some WebViews report stale values during keyboard transitions |
| WeChat | X | Not reliably available |

**Fallback:** Use `useVisualViewport()` composable. When `window.visualViewport` is absent, fall back to `window.innerHeight` delta detection. Update CSS var `--keyboard-inset-bottom` from both paths. The composable must be lifecycle-aware (pause on page hide, resume on resume). See #130.

### Native Web Share API

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | `navigator.share()` |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | Requires user gesture |
| Desktop Safari 16.4+ | F | macOS only |
| PWA Standalone | F | |
| WebView | P | Share sheet may not appear in some in-app browsers |
| WeChat | X | Use WeChat JS-SDK share instead |

**Fallback:** Detect `navigator.share`. If unavailable, show a custom share popover with copy-link and platform-specific share buttons. In WeChat, bridge to `wx.onMenuShareAppMessage` / `wx.onMenuShareTimeline`.

### Clipboard API (`navigator.clipboard`)

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | Requires secure context and user gesture |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | P | Some WebViews block clipboard without explicit permission |
| WeChat | P | Partial; may require WeChat JS-SDK |

**Fallback:** Detect `navigator.clipboard.writeText`. If unavailable, fall back to `document.execCommand('copy')` with a temporary textarea. Always wrap in try/catch and show manual copy prompt on failure.

### Geolocation API

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | Requires HTTPS and user permission |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | P | Permission prompt may not appear |
| WeChat | P | Use `wx.getLocation` for more reliable results |

**Fallback:** Detect `navigator.geolocation`. If unavailable or denied, show a manual location picker (search / map tap). Never block map or feed features on geolocation — treat it as an enhancement for "near me" defaults.

### Notification API

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | X | Not supported in Safari; PWA standalone only on iOS 16.4+ |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | macOS only |
| PWA Standalone (Android) | F | |
| PWA Standalone (iOS) | F | iOS 16.4+ PWA only |
| WebView | X | Not available |
| WeChat | X | Not available |

**Fallback:** Detect `Notification` constructor and `serviceWorker` support. If unavailable, disable notification opt-in UI and show an in-app bell/badge for new activity. On iOS, guide users to install as PWA to enable notifications.

### App Badge API (`navigator.setAppBadge`)

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | X | Not supported |
| Android Chrome 111+ | F | PWA standalone only |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | X | Not supported |
| PWA Standalone (Android) | F | |
| PWA Standalone (iOS) | X | Use iOS-native badge via push |
| WebView | X | Not available |
| WeChat | X | Not available |

**Fallback:** Detect `navigator.setAppBadge`. If unavailable, fall back to in-app unread count indicators (tab bar dot, title prefix). Badge is purely cosmetic — never gate functionality on it.

### `createImageBitmap`

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | P | Some older WebViews have incomplete support |
| WeChat | P | Varies |

**Fallback:** Use `loadImageBitmapSafe()` helper. If `createImageBitmap` is unavailable, fall back to `<img>` + `<canvas>` draw for image compression/avatar crop. The fallback is slower but produces equivalent output. See #123.

### Pointer Capture (`setPointerCapture`)

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | F | Chromium-based |
| WeChat | P | Older versions may lack full pointer event support |

**Fallback:** Detect `element.setPointerCapture`. If unavailable, fall back to `touchmove`/`touchend` listeners for drag and avatar crop interactions. Use `supportsPointerCapture()` from the capability layer.

### `backdrop-filter` (CSS)

| Environment | Support | Notes |
|---|---|---|
| iOS Safari 16.4+ | F | Requires `-webkit-` prefix in some versions |
| Android Chrome 111+ | F | |
| Desktop Chrome 111+ | F | |
| Desktop Safari 16.4+ | F | |
| PWA Standalone | F | |
| WebView | P | Chromium WebView supports; others may not |
| WeChat | P | Varies |

**Fallback:** Use `@supports`:

```css
.glass-surface {
  background: rgba(255, 255, 255, 0.92); /* opaque fallback — guaranteed contrast */
}

@supports (backdrop-filter: blur(1px)) {
  .glass-surface {
    background: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
}
```

The opaque fallback must maintain WCAG AA contrast (4.5:1 for text, 3:1 for large text). Never rely on `backdrop-filter` alone for readability.

## Fallback Policy Principles

1. **Detect, don't assume.** Every modern API goes through the capability layer (`src/platform/capabilities.ts`). Business code never checks `window.X` directly.
2. **Graceful degradation.** Missing features reduce experience quality but never block core flows (browse feed, view post, auth, publish).
3. **Opaque fallbacks for CSS.** Glass/blur effects must have a solid-background fallback that meets contrast requirements.
4. **Unified capability helpers.** All fallbacks are centralized:
   - `randomId()` — wraps `crypto.randomUUID` with `Math.random` fallback
   - `requestIdleTask()` — wraps `requestIdleCallback` with `setTimeout` fallback
   - `loadImageBitmapSafe()` — wraps `createImageBitmap` with canvas fallback
   - `supportsPointerCapture()` — feature detection for pointer capture
   - `useVisualViewport()` — composable with `innerHeight` fallback
5. **WeChat/WebView is best-effort.** Detect WeChat UA and bridge to JS-SDK where needed, but do not guarantee feature parity.
6. **PWA standalone inherits host browser engine.** A PWA installed on iOS Safari 16.4 has the same API surface as Safari 16.4. No extra polyfills needed beyond the browser version check.

## CSS Degradation Contract

| Feature | Fallback | Reference |
|---|---|---|
| `backdrop-filter` | Opaque background via `@supports` | #123 |
| `content-visibility` | Remove — layout must work without it | #123 |
| `env(safe-area-inset-*)` | Graceful zero — no layout breakage | #130 |
| `prefers-reduced-motion` | All JS/CSS animations respect it via unified `useReducedMotion()` | #123, #147 |

## PWA Standalone Checklist

Before any PWA release, verify manually on iOS and Android:

- [ ] Safe-area insets render correctly (notch, home indicator)
- [ ] `<dialog>` / Sheet open/close with correct focus and scroll lock
- [ ] Keyboard does not遮挡 reply dock or form submit buttons
- [ ] `visualViewport` reports correct values during keyboard transitions
- [ ] Notification permission prompt appears (Android) or is gracefully absent (iOS Safari)
- [ ] File upload `<input type="file">` works
- [ ] Map (Leaflet) renders and interactions work
- [ ] App badge updates (Android) or in-app indicator shows (iOS)
- [ ] Offline fallback page displays when network is unavailable
- [ ] New version prompt appears and activates correctly

## Release Verification Environments

Each release must be smoke-tested on:

1. **iOS Safari** (latest) — browser mode
2. **iOS Safari** (latest) — PWA standalone mode
3. **Android Chrome** (latest) — browser mode
4. **Android Chrome** (latest) — PWA standalone mode
5. **Desktop Chrome** (latest)
6. **Desktop Safari** (latest)

Optional / best-effort:

7. WeChat built-in browser
8. WebView (e.g., in-app browser from social apps)

## Related Issues

- #109 — PWA and Service Worker strategy RFC
- #123 — Browser support matrix and progressive enhancement policy
- #130 — Mobile keyboard, visual viewport, and fixed input chrome
- #135 — Overlay layer, z-index, scroll-lock, and focus-stack contracts
- #147 — Semantic accessibility, keyboard navigation, and screen-reader contracts
