# RFC: LIAN Mobile Web PWA Strategy

> Status: **Draft**
> Created: 2026-05-07
> Covers: #109, #152, #134, #119, #123, #125, #126

---

## 1. Goals

1. **Installability** -- allow users to add LIAN to the home screen on iOS Safari and Android Chrome, providing an app-like launch experience (standalone display, theme color, splash).
2. **Offline fallback** -- when the network is unavailable, show a friendly offline page instead of a browser error.
3. **Controlled updates** -- ensure users do not remain on stale builds indefinitely; surface a "new version available" prompt and let them refresh on their own terms.
4. **Dual-runtime safety** -- the legacy `public/` entry and the Vue/Vite shell must coexist without cache-version mismatches.
5. **Privacy-first caching** -- never cache sensitive APIs, messages, notifications, profile data, auth tokens, or precise location.

## 2. Non-Goals (Phase 1)

- Offline posting, offline feed sync, or offline message composition.
- Caching authenticated API responses (feed, messages, notifications, profile, auth tokens).
- Caching precise geolocation data.
- Complex background sync or periodic sync.
- Caching legacy un-hashed JS/CSS as long-lived immutable resources.
- Full offline map tiles (third-party tile caching deferred).

## 3. Manifest

| Field | Value |
|---|---|
| Path | `/manifest.webmanifest` |
| `name` | `LIAN` |
| `short_name` | `LIAN` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | `#f7f4ec` (matches current `<meta name="theme-color">`) |
| `background_color` | `#f7f4ec` |
| `icons` | 192x192 PNG, 512x512 PNG; at least one maskable variant |

Icons will be generated from existing brand assets and committed to `public/icons/`.

## 4. Service Worker Scope

| Concern | Decision |
|---|---|
| Registration path | `/sw.js` at origin root |
| Scope | `/` (covers both legacy and Vue entries) |
| Legacy `public/` pages | Covered; see cache strategy below |
| Vue/Vite canary entry | Covered |
| `public/tools/*` | Covered but not pre-cached; runtime cache only if explicitly allowed |
| Cache namespace | Single namespace with versioned cache names: `static-v{N}`, `runtime-v{N}` |

Legacy and Vue share one Service Worker. Cache names include a version segment so that a new release can purge old caches without ambiguity.

## 5. Cache Strategy

### 5.1 Phase 1 -- Installability only (no Service Worker)

- Ship `manifest.webmanifest` and icons.
- No Service Worker is registered.
- Existing network behavior is unchanged.

### 5.2 Phase 2+ -- Minimal Service Worker

| Resource | Strategy | Notes |
|---|---|---|
| HTML (`/`, `/index.html`) | Network-first | Never long-cached; always revalidate |
| Vite hashed JS/CSS/assets (`/assets/*`) | Cache-first, long TTL | Immutable; keyed by content hash |
| Legacy `public/*.js`, `public/*.css` | Network-first, short TTL | No immutable caching; these lack content hashes |
| `manifest.webmanifest` | Stale-while-revalidate, short TTL | |
| Icons | Cache-first | Static, versioned by filename |
| Offline fallback page | Pre-cached | Minimal HTML + CSS shell |
| API responses | **Not cached by default** | |
| Images (`/api/image-proxy/*`) | Not cached initially; evaluate stale-while-revalidate later with capacity limit | |
| Third-party tiles (`webrd*.is.autonavi.com`) | **Not cached** | Respect provider terms; avoid cache bloat |
| External CDN (Leaflet via unpkg) | Evaluate in Phase 4; if kept external, cache with versioned key | See Section 8 |

## 6. Update UX

1. New Service Worker installs in the background (no `skipWaiting` by default).
2. When the new SW is installed and waiting, the app shows a non-blocking banner: **"New version available. Refresh to update."**
3. User taps the banner; the app sends `skipWaiting` to the waiting SW, then reloads.
4. The app **never force-refreshes** a page the user is actively using.
5. If the user dismisses the banner, it reappears on next navigation or after 24 hours.

### Release checklist addition

- Verify that an old build (previous release) upgrades cleanly to the new build: manifest loads, SW activates, old caches are purged, page renders correctly.

## 7. Rollback and Kill Switch

| Mechanism | How |
|---|---|
| Cache version bump | Increment the cache version constant in `sw.js`. Old caches are deleted on activate. |
| SW unregister | Ship a one-line change: remove the `navigator.serviceWorker.register()` call. The browser will unregister the SW on next visit. |
| Emergency kill switch | A runtime config flag (`enablePwa`) checked before SW registration. Set to `false` via runtime config injection to disable SW without a code deploy. |
| Incident runbook | 1. Disable SW via kill switch. 2. Purge CDN cache. 3. Deploy fix. 4. Re-enable SW. 5. Verify via post-deploy smoke. |

Each release records the previous release id so rollback targets are explicit (see #134).

## 8. External CDN

Current state: Leaflet CSS/JS is loaded from `unpkg.com` with SRI integrity attributes (`index.html`).

| Decision | Details |
|---|---|
| Keep external CDN for now | Migrating to npm-bundled Leaflet is a separate effort (#152) |
| SRI required | All external `<script>` and `<link>` must have `integrity` + `crossorigin` |
| SRI update process | Leaflet version upgrades must update the SRI hash and run the map smoke test in the same PR |
| External asset inventory | Maintain a table (URL, version, SRI hash, owner, upgrade process) in project docs |
| SW treatment | External CDN assets are **not pre-cached**. If kept external long-term, evaluate runtime caching with a versioned key in Phase 4. |
| Fallback | `MapLeafletView.vue` already shows a user-facing message when `window.L` is missing. This is the acceptable Phase 1-3 fallback. |

### CSP alignment

When CSP headers are introduced (#112), the allowlist must include:
- `script-src`: `unpkg.com`
- `style-src`: `unpkg.com`
- `img-src`: `webrd*.is.autonavi.com` (tiles), same-origin (image proxy)
- `connect-src`: same-origin (API), image proxy origin

## 9. Third-Party Tiles

| Concern | Decision |
|---|---|
| Tile source | Gaode (`webrd{s}.is.autonavi.com`), hardcoded in `MapLeafletView.vue` |
| Tile caching | **Not cached** by the Service Worker |
| Attribution | `"(c) Gaode Map"` -- already present |
| Offline behavior | Map tiles are unavailable offline; the map view degrades to showing cached location list if available |
| Provider change | Requires updating tile URL, CSP `img-src`, coordinate system, and attribution simultaneously |

## 10. Runtime Config

Runtime config (API base URL, image proxy base, feature flags) must be injected into the HTML **before** app entry scripts execute (see #119).

| Field | Purpose |
|---|---|
| `LIAN_API_BASE_URL` | API base; empty string = same-origin |
| `LIAN_IMAGE_PROXY_BASE_URL` | Image proxy base |
| `enablePwa` | Feature flag: controls SW registration |
| `releaseId` | Build-time injected; git sha + build time |

The Service Worker must **not** cache the HTML shell that contains runtime config. HTML is always network-first, ensuring config updates propagate on next load.

## 11. Privacy Boundaries

**Never cached by the Service Worker:**

- API responses containing user data (feed content, messages, notifications, profile, auth tokens)
- Auth tokens, session cookies, or any credentials
- Precise geolocation coordinates
- Image URLs that could reveal user-uploaded content (unless explicitly allowlisted later)
- localStorage or sessionStorage dumps

**Allowed for caching:**

- Static hashed assets (JS, CSS, icons, fonts)
- The offline fallback page (no user data)
- `manifest.webmanifest`
- Anonymous, non-authenticated read-only API responses (only with an explicit allowlist, evaluated in Phase 4)

**Telemetry alignment (see #126):**

- Error reporters and Web Vitals collectors must not upload: post body, message content, email, tokens, exact coordinates, or image URLs.
- Allowed metadata: release id, route, error type, status code, browser info, network state.

## 12. Phased Plan

### Phase 1 -- Installability only (no Service Worker)

**Scope:** manifest, icons, theme color, Lighthouse installability audit.

- [ ] Create `public/manifest.webmanifest` with fields from Section 3.
- [ ] Generate and commit icons (192, 512, maskable) to `public/icons/`.
- [ ] Add `<link rel="manifest">` to `index.html` and `public/index.html`.
- [ ] Verify `<meta name="theme-color">` matches manifest `theme_color`.
- [ ] Pass Lighthouse "installable" audit.
- [ ] No Service Worker registration.

**Linked issues:** #109

### Phase 2 -- Minimal Service Worker

**Scope:** register SW, pre-cache offline fallback, cache cleanup.

- [ ] Create `sw.js` with versioned cache names.
- [ ] Pre-cache only: offline fallback page, essential shell CSS.
- [ ] Implement `activate` handler to purge old cache versions.
- [ ] HTML: network-first. Vite hashed assets: cache-first. Legacy assets: network-first.
- [ ] Default: do not cache any API response.
- [ ] `enablePwa` flag gates SW registration.

**Linked issues:** #109, #134

### Phase 3 -- Update UX

**Scope:** new-version prompt, user-initiated refresh, old-to-new upgrade verification.

- [ ] Detect SW `updatefound` / `controllerchange` events.
- [ ] Show "new version available" banner (non-blocking, dismissible).
- [ ] On tap: send `skipWaiting` message to SW, reload.
- [ ] Add upgrade path to release checklist: old build -> new build, verify caches purge.

**Linked issues:** #109, #134

### Phase 4 -- Selective runtime caching

**Scope:** hashed assets, image cache evaluation, read-only API allowlist.

- [ ] Cache Vite hashed assets with long TTL.
- [ ] Evaluate image proxy caching with stale-while-revalidate, capped size.
- [ ] If external CDN is still used, evaluate runtime caching Leaflet with versioned key.
- [ ] Only cache read-only, non-authenticated API responses that pass an explicit allowlist.
- [ ] Add CDN-unavailable and tile-failure smoke tests.

**Linked issues:** #109, #152, #123, #125

---

## Appendix: Related Issues

| Issue | Topic |
|---|---|
| #109 | PWA / Service Worker RFC (this document) |
| #119 | Runtime config, proxies, feature flags |
| #123 | Browser support matrix and progressive enhancement |
| #125 | Dependency supply chain and GitHub Actions hardening |
| #126 | Observability, release diagnostics, privacy-safe telemetry |
| #134 | Release, rollback, and deployment runbook |
| #152 | External CDN, vendored asset, SRI, CSP, and offline dependency contracts |
