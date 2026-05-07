# Frontend Security Headers

> Covers #112 (security headers / permissions / admin boundaries), #152 (external CDN / CSP allowlist), #125 (supply-chain hardening).
> Status: **design + Report-Only plan** — no enforcement yet.

---

## 1. Minimum Headers (all environments)

Every HTML response — production, staging, and `scripts/serve-frontend-static-rehearsal.js` — MUST include:

| Header | Value | Rationale |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing on scripts and stylesheets. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Leak only origin (not full URL) on cross-origin navigations; send full path on same-origin. |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=()` | Disable browser permission APIs by default. Geolocation is re-enabled per-page via iframe allow or explicit user gesture only. |

These three headers have zero impact on current functionality and can be added immediately to both the static rehearsal server (`scripts/serve-frontend-static-rehearsal.js`) and any reverse-proxy / CDN config.

### 1.1 Static Rehearsal Server

In `scripts/serve-frontend-static-rehearsal.js`, the `send()` helper already sets `cache-control: no-store`. Add the minimum headers there:

```js
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), camera=(), microphone=(), payment=()",
    ...headers,
  });
  res.end(body);
}
```

### 1.2 Production / Reverse Proxy

The same three headers should be set at the reverse-proxy or CDN layer (Nginx, Cloudflare, etc.) so they apply to all responses regardless of origin server.

---

## 2. Content-Security-Policy — Report-Only Plan

CSP is introduced in **Report-Only** mode first. Enforcement is a separate follow-up after the allowlist is validated and `unsafe-inline`/`unsafe-eval` usages are migrated.

### 2.1 Current External Resources

Audited from `index.html` and `src/views/MapLeafletView.vue`:

| Resource | Origin | Directive |
|---|---|---|
| Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | `style-src` |
| Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | `script-src` |
| Gaode tile servers | `https://webrd0{1-4}.is.autonavi.com/appmaptile?...` | `img-src`, `connect-src` |
| Campus base map | `/assets/campus-base-map.png` (same-origin) | `img-src` |
| API endpoint | Same-origin (`/api/...` via proxy) | `connect-src` |
| Image proxy | Same-origin (`/api/image-proxy` via proxy) | `img-src`, `connect-src` |
| Runtime config inline script | `<script>` in `<head>` (static rehearsal inject) | `script-src` (requires `unsafe-inline`) |

### 2.2 Report-Only Policy

```
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
| `script-src` | `'self' https://unpkg.com 'unsafe-inline'` | `unpkg.com` hosts Leaflet JS. `'unsafe-inline'` is required for the runtime config `<script>` injected by the static rehearsal server and any Vite-injected inline chunks. |
| `style-src` | `'self' https://unpkg.com 'unsafe-inline'` | `unpkg.com` hosts Leaflet CSS. `'unsafe-inline'` is required for Vue scoped styles and Vite dev-mode `<style>` injection. |
| `img-src` | `'self' https://webrd0{1-4}.is.autonavi.com data: blob:` | Gaode tile servers. `data:` for inline SVG fallbacks; `blob:` for Leaflet canvas rendering. |
| `connect-src` | `'self' https://webrd0{1-4}.is.autonavi.com` | API calls go to same-origin proxy. Gaode tiles fetched via XHR/fetch in some Leaflet configurations. |
| `font-src` | `'self'` | No external fonts currently loaded. |
| `frame-src` | `'none'` | No iframes in the app. |
| `object-src` | `'none'` | No plugins/embeds. |
| `base-uri` | `'self'` | Prevent `<base>` hijacking. |
| `form-action` | `'self'` | Forms only submit to same origin. |
| `report-uri` | `/api/csp-report` | Collect violation reports during Report-Only phase. Needs a backend endpoint or log aggregator. |

### 2.3 Gaode Tile Origin Pattern

Gaode tiles load from `webrd01` through `webrd04.is.autonavi.com`. All four subdomains are listed explicitly rather than using a wildcard (`*.is.autonavi.com`) to avoid over-permitting sibling services on the same domain.

---

## 3. `unsafe-inline` / `unsafe-eval` — Current Usage and Migration Plan

### 3.1 `unsafe-inline` (script-src)

**Current reasons:**
- `scripts/serve-frontend-static-rehearsal.js` injects a `<script>` block for `window.LIAN_STATIC_REHEARSAL` runtime config.
- Vite dev mode injects HMR client and module scripts inline.
- Vite production build may produce inline `<script>` chunks for critical path.

**Migration path:**
1. Replace the runtime config inline `<script>` with a `<script src="/runtime-config.js">` external file, or use a `<meta>` tag read by the app bootstrap.
2. For Vite production builds, use the `module` type scripts (already in use) and rely on `'self'` — Vite produces external module files by default.
3. Once no inline scripts remain, remove `'unsafe-inline'` from `script-src`. If any inline must remain, switch to nonce-based CSP (`'nonce-<random>'`).

### 3.2 `unsafe-inline` (style-src)

**Current reasons:**
- Vue scoped styles are injected as `<style>` tags at runtime.
- Vite dev mode injects styles inline for HMR.

**Migration path:**
1. Vue 3 scoped styles can be configured to use CSS modules or external stylesheets, but this is a large refactor.
2. Alternatively, use nonce-based CSP for styles: generate a per-request nonce, inject it into the HTML, and reference it in both the CSP header and the `<style nonce="...">` tags.
3. Short-term: keep `'unsafe-inline'` in Report-Only and document it as a known exception.

### 3.3 `unsafe-eval`

**Current status:** Not present in the Report-Only policy. No usage of `eval()`, `new Function()`, or `setTimeout(string)` was found in the Vue app source. If introduced later, it must be flagged in CI.

---

## 4. Enabling Report-Only in the Static Rehearsal Server

Add the `Content-Security-Policy-Report-Only` header alongside the minimum headers:

```js
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' https://unpkg.com 'unsafe-inline'",
  "style-src 'self' https://unpkg.com 'unsafe-inline'",
  "img-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com data: blob:",
  "connect-src 'self' https://webrd01.is.autonavi.com https://webrd02.is.autonavi.com https://webrd03.is.autonavi.com https://webrd04.is.autonavi.com",
  "font-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), camera=(), microphone=(), payment=()",
    "content-security-policy-report-only": CSP_REPORT_ONLY,
    ...headers,
  });
  res.end(body);
}
```

> A `report-uri` endpoint (`/api/csp-report`) must be implemented on the backend to collect violation reports. Until then, omit `report-uri` and rely on browser DevTools console warnings.

---

## 5. SRI (Subresource Integrity)

Leaflet JS in `index.html` already has an `integrity` attribute:

```html
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
  crossorigin=""></script>
```

Leaflet CSS also has SRI:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIINfQhOrQ6zjtY8MkCkMZzvF1lvTlZBo="
  crossorigin="">
```

**Requirements (from #152):**
- SRI hashes MUST be updated whenever the Leaflet version changes.
- A CI guard should verify that all external `<script>` and `<link>` tags have `integrity` attributes.
- The external asset inventory (URL, version, SRI hash, owner) should be tracked in a manifest or this document.

### 5.1 External Asset Inventory

| Asset | URL | Version | SRI | Loaded In |
|---|---|---|---|---|
| Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | 1.9.4 | `sha256-p4NxAoJBhIINfQhOrQ6zjtY8MkCkMZzvF1lvTlZBo=` | `index.html` |
| Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | 1.9.4 | `sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=` | `index.html` |

---

## 6. Rollout Phases

| Phase | Action | Blocking? |
|---|---|---|
| **Phase 1 (this doc)** | Document headers, allowlist, and migration plan. | No |
| **Phase 2** | Add minimum headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) to static rehearsal server and production reverse proxy. | No — safe to ship immediately. |
| **Phase 3** | Enable `Content-Security-Policy-Report-Only` in static rehearsal. Monitor browser console for violations. | No — does not block any resources. |
| **Phase 4** | Implement `/api/csp-report` backend endpoint. Add `report-uri` to the CSP policy. | No |
| **Phase 5** | Migrate runtime config inline script to external file. Remove `'unsafe-inline'` from `script-src` if no other inline scripts remain. | Requires code change + testing. |
| **Phase 6** | Evaluate nonce-based CSP for styles or keep `'unsafe-inline'` in `style-src` with documented exception. | Requires Vue build config change. |
| **Phase 7** | Switch from Report-Only to enforced `Content-Security-Policy`. | Only after Phases 5-6 are validated with zero violations in Report-Only. |

---

## 7. CI / Guard Integration

From #112 and #125, the following CI guards should be added:

- **External resource scanner**: grep for new `<script src="http` and `<link href="http` in `index.html` and `public/` files; require SRI and CSP allowlist entry.
- **`unsafe-inline` / `unsafe-eval` guard**: flag any new `eval()`, `new Function()`, or `setTimeout(string)` usage.
- **Header smoke test**: verify that the static rehearsal server responses include the minimum headers.

---

## 8. Permissions-Policy Details

| Directive | Value | Notes |
|---|---|---|
| `geolocation` | `()` | Disabled by default. The map view does not use browser geolocation; location data comes from the API. If geolocation is needed later, enable per-page via explicit user gesture. |
| `camera` | `()` | Not used. |
| `microphone` | `()` | Not used. |
| `payment` | `()` | Not used. |

Additional directives to consider adding as the app grows: `accelerometer`, `gyroscope`, `magnetometer`, `usb`, `bluetooth`.

---

## References

- [#112 — harden security headers, permissions, and admin tool boundaries](https://github.com/taoyu051818-sys/lian-mobile-web/issues/112)
- [#152 — define external CDN, vendored asset, SRI, CSP, and offline dependency contracts](https://github.com/taoyu051818-sys/lian-mobile-web/issues/152)
- [#125 — dependency supply-chain and GitHub Actions hardening](https://github.com/taoyu051818-sys/lian-mobile-web/issues/125)
