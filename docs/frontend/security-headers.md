# Frontend Security Headers

> Covers #112 (security headers / permissions / admin boundaries), #152 (external CDN / CSP allowlist), #125 (supply-chain hardening).
> Status: **design + Report-Only plan** — no enforcement yet.

---

## 1. Minimum Headers (all environments)

Every HTML response — production and staging — MUST include:

| Header | Value | Rationale |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing on scripts and stylesheets. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leak only origin (not full URL) on cross-origin navigations; send full path on same-origin. |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=()` | Disable browser permission APIs by default. Geolocation is re-enabled per-page via iframe allow or explicit user gesture only. |

These three headers have zero impact on current functionality and can be added immediately to any reverse-proxy / CDN config or Vite preview server middleware.

### 1.1 Production / Reverse Proxy

The same three headers should be set at the reverse-proxy or CDN layer (Nginx, Cloudflare, etc.) so they apply to all responses regardless of origin server.

---

## 2. Content-Security-Policy — Report-Only Plan

CSP is introduced in **Report-Only** mode first. Enforcement is a separate follow-up after the allowlist is validated and `unsafe-inline` / `unsafe-eval` usages are migrated.

### 2.1 Current Resource Truth

Audited from `index.html`, `src/platform/leaflet.ts`, `src/views/MapLeafletView.vue`, and the standalone tool pages under `public/tools/`.

| Resource | Origin | Directive | Current truth |
|---|---|---|---|
| Bundled Leaflet runtime for the Vue shell | same-origin Vite assets | `script-src`, `style-src` | `src/platform/leaflet.ts` imports `leaflet` and `leaflet/dist/leaflet.css`, so the active user-facing Vue runtime no longer loads Leaflet from `unpkg` in root `index.html`. |
| Standalone tool Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | `style-src` | Still loaded by `public/tools/map-v2-editor.html`, `public/tools/map-georef.html`, and `public/tools/map-coastline-align.html`. |
| Standalone tool Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | `script-src` | Still loaded by the same standalone tool pages. |
| Gaode tile servers | `https://webrd0{1-4}.is.autonavi.com/appmaptile?...` | `img-src`, `connect-src` | Third-party map tiles remain an external runtime dependency. |
| Campus base map | `/assets/campus-base-map.png` | `img-src` | Same-origin static asset. |
| API endpoint | same-origin (`/api/...`) | `connect-src` | Proxied through the app origin. |
| Image proxy | same-origin (`/api/image-proxy`) | `img-src`, `connect-src` | Proxied through the app origin. |
| Runtime config inline script | injected HTML `<script>` | `script-src` | Release docs still reserve an inline runtime-config injection path, so Report-Only planning must keep that possibility in mind until the deploy contract is narrowed further. |

### 2.2 Report-Only Policy

```text
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' https://unpkg.com 'unsafe-inline';
  style-src 'self' https://unpkg.com 'unsafe-inline';
  img-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com data: blob:;
  connect-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com;
  font-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  report-uri /api/csp-report;
```

#### Directive Notes

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Restrictive default; every category must be explicitly allowlisted. |
| `script-src` | `'self' https://unpkg.com 'unsafe-inline'` | The active Vue shell should work from same-origin bundled assets. `unpkg.com` remains temporarily allowlisted only because the standalone internal map tools still load Leaflet there. `'unsafe-inline'` is retained for runtime-config injection and other deploy-time inline script exceptions until they are removed. |
| `style-src` | `'self' https://unpkg.com 'unsafe-inline'` | Same split as `script-src`: same-origin for the bundled app, `unpkg.com` only for the remaining standalone tool pages, and `'unsafe-inline'` for current style/runtime exceptions. |
| `img-src` | `'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com data: blob:` | Same-origin assets plus Gaode tile servers. `data:` and `blob:` stay for current rendering fallbacks. |
| `connect-src` | `'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com` | Same-origin API/image proxy plus tile-related fetches where needed. |
| `font-src` | `'self'` | No external fonts currently loaded. |
| `frame-src` | `'none'` | No iframes in the app. |
| `object-src` | `'none'` | No plugins or embeds. |
| `base-uri` | `'self'` | Prevent `<base>` hijacking. |
| `form-action` | `'self'` | Forms only submit to same origin. |
| `report-uri` | `/api/csp-report` | Collect violation reports during the Report-Only phase. Needs a backend endpoint or log aggregator. |

### 2.3 Gaode Tile Origin Pattern

Gaode tiles load from `webrd01` through `webrd04.is.autonavi.com`. All four subdomains are listed explicitly rather than using a wildcard (`*.is.autonavi.com`) to avoid over-permitting sibling services on the same domain.

The important current split is:

- the active Vue shell no longer needs `unpkg.com` for Leaflet
- the standalone internal tools still do
- Gaode tiles remain external for both the Vue map surface and the tool surfaces

---

## 3. `unsafe-inline` / `unsafe-eval` — Current Usage and Migration Plan

### 3.1 `unsafe-inline` (script-src)

**Current reasons:**
- runtime config may still be injected via an inline `<script>` for `window.LIAN_*` globals
- Vite dev mode may inject helper/client script content inline during local development
- other deploy-time HTML injections have not yet been fully narrowed to external files only

**Migration path:**
1. Replace any remaining runtime-config inline `<script>` with an external `runtime-config.js` or another explicit same-origin config delivery path.
2. Keep production builds on external module files loaded from `'self'`.
3. Once inline script usage is gone, remove `'unsafe-inline'` from `script-src` or switch to nonce-based CSP.

### 3.2 `unsafe-inline` (style-src)

**Current reasons:**
- Vue scoped styles and current tooling still make strict style CSP harder to enforce without a nonce plan.
- Some standalone tool pages currently rely on inline `<style>` blocks.

**Migration path:**
1. Keep `'unsafe-inline'` documented as a current exception while the tool and Vue style story is tightened.
2. Move tool-page styles into explicit stylesheets where practical.
3. Evaluate nonce-based CSP for styles before enforcement.

### 3.3 `unsafe-eval`

**Current status:** Not present in the Report-Only policy. No known `eval()`, `new Function()`, or string-based timer usage is part of the current frontend contract. CI should keep flagging any new usage.

---

## 4. Enabling Report-Only

Add the `Content-Security-Policy-Report-Only` header alongside the minimum headers. This can be done via reverse-proxy/CDN configuration or preview-server middleware.

> A `report-uri` endpoint (`/api/csp-report`) must be implemented on the backend to collect violation reports. Until then, omit `report-uri` and rely on browser DevTools console warnings.

---

## 5. SRI (Subresource Integrity)

Current repo truth is no longer the older `index.html`-based story. Root `index.html` does not load Leaflet from `unpkg` anymore. The remaining external Leaflet tags live in standalone internal map tools under `public/tools/`, and they currently load without SRI attributes.

Representative current tool-side tags:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

**Requirements (from #152):**
- Any remaining external `<script>` or `<link>` tags must eventually carry `integrity` and `crossorigin`.
- SRI hashes MUST be updated whenever the tool-side Leaflet version changes.
- A CI guard should verify that external resource tags in `public/` stay registered and gain SRI instead of drifting silently.
- The external asset inventory (URL, version, SRI state, owner) should stay tracked in docs or a manifest.

### 5.1 External Asset Inventory

| Asset | URL | Version | SRI state | Loaded in |
|---|---|---|---|---|
| Standalone tool Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | 1.9.4 | Missing on current `main` | `public/tools/map-v2-editor.html`, `public/tools/map-georef.html`, `public/tools/map-coastline-align.html` |
| Standalone tool Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | 1.9.4 | Missing on current `main` | `public/tools/map-v2-editor.html`, `public/tools/map-georef.html`, `public/tools/map-coastline-align.html` |
| Vue-shell Leaflet runtime | bundled through npm/Vite | repo-managed | Not applicable as external SRI | `src/platform/leaflet.ts` |

---

## 6. Rollout Phases

| Phase | Action | Blocking? |
|---|---|---|
| **Phase 1 (this doc)** | Document headers, allowlist, and migration plan. | No |
| **Phase 2** | Add minimum headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) to production reverse proxy. | No — safe to ship immediately. |
| **Phase 3** | Enable `Content-Security-Policy-Report-Only`. Monitor for violations. | No — does not block resources. |
| **Phase 4** | Implement `/api/csp-report` or another reporting sink. | No |
| **Phase 5** | Remove or narrow remaining inline-script and inline-style exceptions. | Requires code and deploy-contract work. |
| **Phase 6** | Add SRI (or eliminate the external dependency) for the remaining standalone tool Leaflet tags. | Requires tool-page follow-up under #152. |
| **Phase 7** | Switch from Report-Only to enforced `Content-Security-Policy`. | Only after the exceptions and reports are under control. |

---

## 7. CI / Guard Integration

From #112 and #125, the following guards should be added or kept current:

- **External resource scanner**: flag new external `<script>` / `<link>` tags in `index.html` and `public/` files; require registry and SRI expectations.
- **`unsafe-inline` / `unsafe-eval` guard**: flag any new `eval()`, `new Function()`, or string-based timer usage.
- **Header smoke test**: verify that production responses include the minimum headers.
- **Doc truth check**: when runtime dependencies move from external CDN to bundled assets or vice versa, refresh these contract docs in the same lane.

---

## 8. Permissions-Policy Details

| Directive | Value | Notes |
|---|---|---|
| `geolocation` | `()` | Disabled by default. The current map view does not require browser geolocation to render campus data. |
| `camera` | `()` | Not used. |
| `microphone` | `()` | Not used. |
| `payment` | `()` | Not used. |

Additional directives to consider as the app grows: `accelerometer`, `gyroscope`, `magnetometer`, `usb`, `bluetooth`.

---

## References

- [#112 — harden security headers, permissions, and admin tool boundaries](https://github.com/taoyu051818-sys/lian-mobile-web/issues/112)
- [#152 — define external CDN, vendored asset, SRI, CSP, and offline dependency contracts](https://github.com/taoyu051818-sys/lian-mobile-web/issues/152)
- [#125 — dependency supply-chain and GitHub Actions hardening](https://github.com/taoyu051818-sys/lian-mobile-web/issues/125)
- [src/platform/leaflet.ts](https://github.com/taoyu051818-sys/lian-mobile-web/blob/main/src/platform/leaflet.ts)
