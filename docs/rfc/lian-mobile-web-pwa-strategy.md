# RFC: LIAN Mobile Web PWA Strategy

> Status: **Draft**
> Created: 2026-05-07
> Covers: #109, #152, #134, #119, #123, #125, #126

---

## 1. Goals

1. **Installability** -- allow users to add LIAN to the home screen on iOS Safari and Android Chrome, providing an app-like launch experience.
2. **Offline fallback** -- when the network is unavailable, show a friendly offline page instead of a browser error.
3. **Controlled updates** -- ensure users do not remain on stale builds indefinitely; surface a "new version available" prompt and let them refresh on their own terms.
4. **Same-origin safety** -- the Vue/Vite shell and any same-origin standalone internal tools must not create cache-version mismatches or misleading PWA promises.
5. **Privacy-first caching** -- never cache sensitive APIs, messages, notifications, profile data, auth tokens, or precise location.

## 2. Non-Goals (Phase 1)

- Offline posting, offline feed sync, or offline message composition.
- Caching authenticated API responses.
- Caching precise geolocation data.
- Complex background sync or periodic sync.
- Caching standalone internal tool HTML / JS / CSS as long-lived immutable resources.
- Full offline map tiles.

## 3. Manifest

| Field | Value |
|---|---|
| Path | `/manifest.webmanifest` |
| `name` | `LIAN` |
| `short_name` | `LIAN` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | `#f7f4ec` |
| `background_color` | `#f7f4ec` |
| `icons` | 192x192 PNG, 512x512 PNG, and at least one maskable variant |

Icons should live in `public/icons/`.

## 4. Service Worker Scope

| Concern | Decision |
|---|---|
| Registration path | `/sw.js` at origin root |
| Scope | `/` |
| Vue/Vite entry | Covered |
| `public/tools/*` | In scope as same-origin pages, but not part of the installability promise and not pre-cached by default |
| Cache namespace | Versioned cache names such as `static-v{N}` and `runtime-v{N}` |

One Service Worker at the origin root can technically see both the Vue shell and the standalone tool pages. The product promise, however, is centered on the Vue shell. Internal tools should stay out of optimistic pre-cache behavior unless they get their own explicit contract.

## 5. Cache Strategy

### 5.1 Phase 1 -- Installability only (no Service Worker)

- Ship `manifest.webmanifest` and icons.
- Do not register a Service Worker yet.
- Existing network behavior stays unchanged.

### 5.2 Phase 2+ -- Minimal Service Worker

| Resource | Strategy | Notes |
|---|---|---|
| HTML (`/`, `/index.html`) | Network-first | Never long-cached; always revalidate |
| Vite hashed JS/CSS/assets (`/assets/*`) | Cache-first, long TTL | Immutable; keyed by content hash |
| `manifest.webmanifest` | Stale-while-revalidate, short TTL | |
| Icons | Cache-first | Static, versioned by filename |
| Offline fallback page | Pre-cached | Minimal HTML + CSS shell |
| API responses | **Not cached by default** | |
| Images (`/api/image-proxy/*`) | Not cached initially; evaluate later with explicit limits | |
| Third-party tiles (`webrd*.is.autonavi.com`) | **Not cached** | Respect provider terms and avoid cache bloat |
| Standalone internal tool HTML / JS / CSS | Network-first or no-cache | Not part of the PWA performance promise |
| Tool-side external CDN assets | **Not pre-cached** | See Section 8 |

## 6. Update UX

1. New Service Worker installs in the background (no `skipWaiting` by default).
2. When the new SW is installed and waiting, the app shows a non-blocking banner: **"New version available. Refresh to update."**
3. User taps the banner; the app sends `skipWaiting` to the waiting SW, then reloads.
4. The app does not force-refresh a page the user is actively using.
5. If the user dismisses the banner, it can reappear on a later navigation.

### Release checklist addition

- Verify that a previous build upgrades cleanly to the new build: manifest loads, SW activates, old caches are purged, and the page renders correctly.

## 7. Rollback and Kill Switch

| Mechanism | How |
|---|---|
| Cache version bump | Increment a cache-version constant in `sw.js`; old caches are deleted on activate |
| SW unregister | Remove or disable the registration path so browsers unregister on the next visit |
| Emergency kill switch | Gate SW registration behind a runtime flag such as `enablePwa` |
| Incident runbook | Disable SW, purge caches where needed, deploy fix, verify with smoke |

Each release records the previous release ID so rollback targets stay explicit.

## 8. External CDN

Current repo truth is split:

- the active Vue shell bundles Leaflet through `src/platform/leaflet.ts`
- standalone internal map tools under `public/tools/` still load Leaflet CSS/JS from `unpkg`
- Gaode tiles remain a third-party runtime dependency for map rendering

| Decision | Details |
|---|---|
| Keep bundled Leaflet for the Vue shell | The main user-facing runtime should continue using the reviewed build artifact rather than a runtime CDN dependency |
| Internal tools may keep `unpkg` temporarily | This remains a separate follow-up under #152, not part of the PWA installability promise |
| SRI required for any remaining external tags | Tool-side external `<script>` and `<link>` tags should gain `integrity` and `crossorigin` or be removed |
| External asset inventory must stay current | Track URL, version, SRI state, owner, and upgrade path in docs or a manifest |
| SW treatment | Do not pre-cache tool-side CDN assets by default |
| User-facing fallback | Main-shell map fallback should focus on third-party tile failures or offline state, not on a missing `unpkg` Leaflet runtime |

### CSP alignment

When CSP headers are introduced, the allowlist should include `unpkg.com` only as long as those standalone tools still depend on it. The active Vue shell should otherwise run from `'self'` plus the required map-tile origins.

## 9. Third-Party Tiles

| Concern | Decision |
|---|---|
| Tile source | Gaode (`webrd{s}.is.autonavi.com`) |
| Tile caching | **Not cached** by the Service Worker |
| Attribution | Keep the provider attribution truthful in map surfaces |
| Offline behavior | Tiles may be unavailable offline; the app should fall back gracefully rather than pretending full offline map support exists |
| Provider change | Update tile URL, CSP `img-src`, and attribution together |

## 10. Runtime Config

Runtime config (API base URL, image proxy base, feature flags) must be injected before app entry scripts execute.

| Field | Purpose |
|---|---|
| `LIAN_API_BASE_URL` | API base; empty string means same-origin |
| `LIAN_IMAGE_PROXY_BASE_URL` | Image proxy base |
| `enablePwa` | Feature flag controlling SW registration |
| `releaseId` | Build-time identifier from the release manifest |

The Service Worker must not long-cache the HTML shell that carries runtime config. HTML stays network-first so config updates propagate on the next load.

## 11. Privacy Boundaries

**Never cached by the Service Worker:**

- API responses containing user data
- Auth tokens, session cookies, or any credentials
- Precise geolocation coordinates
- User-sensitive image URLs unless they later pass an explicit allowlist review
- localStorage or sessionStorage dumps

**Allowed for caching:**

- Static hashed assets (JS, CSS, icons, fonts)
- The offline fallback page
- `manifest.webmanifest`
- Explicitly allowlisted anonymous read-only API responses in a later phase

**Telemetry alignment:**

- Error reporters and Web Vitals collectors must not upload post bodies, message content, email, tokens, exact coordinates, or sensitive image URLs.
- Allowed metadata includes release ID, route, error type, status code, browser info, and network state.

## 12. Phased Plan

### Phase 1 -- Installability only (no Service Worker)

- [ ] Create `public/manifest.webmanifest`
- [ ] Generate and commit icons
- [ ] Add `<link rel="manifest">` to the root HTML entry
- [ ] Verify `<meta name="theme-color">` matches the manifest
- [ ] Pass a basic installability audit
- [ ] No Service Worker registration

### Phase 2 -- Minimal Service Worker

- [ ] Create `sw.js` with versioned cache names
- [ ] Pre-cache only the offline fallback and minimal shell assets
- [ ] Purge old caches on activate
- [ ] Keep HTML network-first and default API caching off
- [ ] Gate registration behind `enablePwa`

### Phase 3 -- Update UX

- [ ] Detect waiting SW updates
- [ ] Show a non-blocking update banner
- [ ] Reload only after explicit user action
- [ ] Verify the old-build to new-build upgrade path

### Phase 4 -- Selective runtime caching

- [ ] Cache Vite hashed assets with long TTL
- [ ] Evaluate image proxy caching with explicit size/age limits
- [ ] Keep third-party tiles out of default caching unless terms and limits are clear
- [ ] Decide separately whether standalone tool CDN assets should remain uncached, gain SRI, or be removed entirely
- [ ] Add smoke coverage for tile failure and offline fallback behavior

---

## Appendix: Related Issues

| Issue | Topic |
|---|---|
| #109 | PWA / Service Worker RFC |
| #119 | Runtime config, proxies, feature flags |
| #123 | Browser support matrix and progressive enhancement |
| #125 | Dependency supply chain and GitHub Actions hardening |
| #126 | Observability, release diagnostics, privacy-safe telemetry |
| #134 | Release, rollback, and deployment runbook |
| #152 | External CDN, vendored asset, SRI, CSP, and offline dependency contracts |
