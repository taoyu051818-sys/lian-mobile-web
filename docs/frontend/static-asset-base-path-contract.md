# Static Asset Base Path Contract — LIAN Mobile Web

Date: 2026-05-10
Status: Draft — docs-only contract slice for #156

Related to #156.
Part of #156.
Does not close #156.

## Scope

This contract defines how the LIAN mobile web frontend resolves static asset URLs when deployed at a root path (`/`) versus a subpath (e.g., `/app/`). It covers the Vite `base` configuration, asset URL resolution helpers, dual-runtime (legacy and Vue) base-path behavior, PWA `scope` and `start_url` alignment, and CDN prefix interaction.

This document is a planning/implementation contract only. It does not change runtime code, Vue components, manifests, scripts, package configuration, or CI.

## 1. Current state baseline

The codebase currently assumes root-only deployment:

| Concern | Current state | Risk under subpath |
|---|---|---|
| `vite.config.ts` `base` | Omitted; defaults to `"/"` | All built asset URLs are absolute-from-root (`/assets/index-abc123.js`); breaks under subpath |
| `import.meta.env.BASE_URL` | Not used anywhere | No mechanism to derive asset prefix at build or runtime |
| Legacy HTML asset refs | Hardcoded root-relative: `href="/lian-tokens.css"`, `src="/app.js"` | Breaks under subpath unless rewritten |
| PWA RFC manifest | `start_url: "/"`, `scope: "/"` | Manifest paths assume root deployment |
| PWA RFC service worker | Registration at `/sw.js`, scope `/` | SW scope assumes root deployment |
| `runtime-config.ts` | Handles API base URLs only (`window.LIAN_API_BASE_URL`, `window.LIAN_IMAGE_PROXY_BASE_URL`) | No asset base path concept exists |
| CSS `url()` references | None found in `public/*.css` or `src/styles/*.css` | No CSS asset path issue currently |
| External CDN (Leaflet) | Absolute URLs to `unpkg.com` | Independent of app base path; no change needed |

## 2. Deployment modes

| Mode | `base` value | Description |
|---|---|---|
| **root** (default) | `"/"` | App served at origin root. Current behavior; no subpath prefix. |
| **subpath** | `"/app/"` (example) | App served under a path prefix. All asset URLs, PWA scope, and routing must include the prefix. |

The contract defines rules for both modes. Root mode is the default and requires no additional configuration. Subpath mode requires explicit `base` configuration at build time.

## 3. Vite `base` configuration contract

### 3.1 Build-time `base`

| Rule | Contract |
|---|---|
| Source of truth | `vite.config.ts` `base` field, read from `LIAN_BASE_PATH` env var or defaulting to `"/"` |
| Allowed values | `"/"` or a path starting and ending with `"/"` (e.g., `"/app/"`) |
| Prohibited values | Absolute URLs (`https://...`), empty string, paths not starting with `"/"` |
| Vite behavior | Vite prefixes all asset URLs in built HTML and CSS with the `base` value |
| Dev server | Vite dev server also respects `base`; all routes mount under the prefix |

### 3.2 Env variable contract

```
LIAN_BASE_PATH="/app/"
```

- Default: `"/"` (root deployment)
- Must start and end with `"/"`
- Validated by `parseEnvUrl`-style logic in `vite.config.ts` (path validation, not URL validation)
- Must not include hostname or protocol

### 3.3 What `base` affects in Vite

| Vite feature | Behavior with `base` |
|---|---|
| Built `<script src>` and `<link href>` in `index.html` | Prefixed with `base` |
| `import.meta.env.BASE_URL` | Returns `base` value at build time |
| Built CSS `url()` references | Prefixed with `base` |
| `vite preview` serving | Mounts the app under `base` path |
| `vite dev` dev server | Mounts HMR and routes under `base` path |

## 4. Asset URL resolution contract

### 4.1 Vue runtime (Vite-built)

All asset references in the Vue runtime MUST use one of these Vite-provided mechanisms:

| Mechanism | Usage | Example |
|---|---|---|
| Static `import` | JS/TS module imports of assets | `import logo from './logo.png'` |
| `new URL(path, import.meta.url)` | Dynamic asset URLs | `new URL('./icon.svg', import.meta.url).href` |
| `import.meta.env.BASE_URL` | Prefix for known public assets | `` `${import.meta.env.BASE_URL}manifest.webmanifest` `` |
| Absolute external URLs | CDN resources (Leaflet) | `https://unpkg.com/leaflet@1.9.4/...` |

Rules:

- **MUST NOT** hardcode root-relative paths like `/assets/...` in Vue source code.
- **MUST NOT** hardcode root-relative paths like `/styles.css` in Vue source code.
- External CDN URLs (Leaflet, Gaode tiles) are absolute and are **not** affected by `base`.

### 4.2 Legacy runtime (public/)

The legacy runtime (`public/index.html` and `public/*.js`) does not go through Vite's build pipeline. Asset references are static HTML/JS.

| Rule | Contract |
|---|---|
| HTML `<link>` and `<script>` tags | Must use `BASE_URL`-prefixed paths when subpath support is required |
| JS dynamic asset paths | Must read from a `window.LIAN_BASE_PATH` global or equivalent |
| Injection mechanism | The static rehearsal server and production reverse proxy must inject `LIAN_BASE_PATH` into HTML alongside existing `LIAN_API_BASE_URL` injection |

For root deployment, legacy hardcoded paths (`/lian-tokens.css`, `/app.js`) continue to work without change. Subpath deployment requires either:

1. Rewriting legacy HTML to use a template variable for the base path prefix, or
2. Having the serving layer rewrite asset paths at the reverse proxy level.

Option 1 (template variable) is the contract-preferred approach for consistency with the Vue runtime.

### 4.3 Runtime config extension

The `window.LIAN_*` global injection contract extends to include:

| Variable | Purpose | Default |
|---|---|---|
| `LIAN_BASE_PATH` | Asset base path prefix for legacy runtime | `"/"` |

This variable is injected into `<head>` alongside `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` by:

- `scripts/serve-frontend-static-rehearsal.js` (development/rehearsal)
- Production reverse proxy or HTML template injection

The Vue runtime does NOT need `window.LIAN_BASE_PATH` because it uses `import.meta.env.BASE_URL` (build-time constant).

## 5. Dual-runtime base-path alignment

### 5.1 Runtime responsibility matrix

| Concern | Legacy runtime (port 4300) | Vue runtime (port 4301) |
|---|---|---|
| Asset base path source | `window.LIAN_BASE_PATH` (runtime injection) | `import.meta.env.BASE_URL` (build-time) |
| HTML entry serving | Custom Node server reads from `public/` | `vite preview` serves from `dist/` |
| SPA fallback | Server rewrites unknown paths to `index.html` | Vite preview handles SPA fallback under `base` |
| Runtime config injection | Server injects `window.LIAN_*` into `<head>` | Not needed for asset paths; `BASE_URL` is baked in |
| Subpath routing | Server must mount under `base` prefix | `vite preview` mounts under `base` automatically |

### 5.2 Consistency rules

1. Both runtimes MUST resolve the same set of asset paths for a given deployment.
2. The `LIAN_BASE_PATH` value injected into legacy HTML MUST match the `base` value used in `vite.config.ts` for the same deployment artifact.
3. The `scripts/serve-frontend-runtimes.js` supervisor MUST pass the same base path to both the legacy server and `vite preview`.
4. Dev mode (`vite dev` on port 5173) MUST use the same `base` as production builds for path consistency.

### 5.3 Legacy server subpath behavior

When `LIAN_BASE_PATH` is not `"/"`, the static rehearsal server must:

| Requirement | Contract |
|---|---|
| Serve files under prefix | All file reads must strip the `base` prefix before resolving to `public/` |
| SPA fallback | Unknown paths under `base` prefix serve `index.html` |
| Asset redirects | Requests for `/lian-tokens.css` (without prefix) MAY redirect to `{base}lian-tokens.css` |
| Proxy paths | `/api/*` proxy paths are NOT prefixed by `base`; they remain at origin root |

## 6. PWA scope and start_url alignment

### 6.1 Manifest field contract

When the app is deployed under a subpath, the PWA manifest fields MUST align with the `base` value:

| Field | Root deployment | Subpath deployment (`/app/`) |
|---|---|---|
| Manifest path | `/manifest.webmanifest` | `/app/manifest.webmanifest` |
| `start_url` | `/` | `/app/` |
| `scope` | `/` | `/app/` |
| Icon paths | `/icons/icon-192.png` | `/app/icons/icon-192.png` |

Rules:

- `scope` MUST be set to the `base` value.
- `start_url` MUST be within `scope`.
- `scope` MUST NOT be broader than the directory containing the manifest.
- Icon paths in the manifest are relative to the manifest's location; if the manifest moves to `{base}manifest.webmanifest`, icon paths remain relative (e.g., `icons/icon-192.png`).

### 6.2 Service Worker contract

| Concern | Root deployment | Subpath deployment |
|---|---|---|
| Registration path | `/sw.js` | `{base}sw.js` |
| Scope | `/` | `{base}` |
| SW file location | `/sw.js` (public root) | `{base}sw.js` (must be at or under `base`) |
| Cache key prefixes | Unchanged | Unchanged (cache names are internal) |

Rules:

- The SW MUST be registered at `{base}sw.js` with scope `{base}`.
- The SW file MUST be served from within the `scope` path; browsers reject SW registration if the SW file is outside the declared scope.
- `navigator.serviceWorker.register()` must use the `base`-prefixed path, not a hardcoded `/sw.js`.
- All pre-cached URLs in the SW must use the `base`-prefixed paths.

### 6.3 HTML `<link rel="manifest">` contract

| Deployment | `<link>` tag |
|---|---|
| Root | `<link rel="manifest" href="/manifest.webmanifest">` |
| Subpath | `<link rel="manifest" href="{base}manifest.webmanifest">` |

The Vue entry (`index.html`) and legacy entry (`public/index.html`) MUST both include the manifest link with the correct base-prefixed path.

## 7. CDN and external asset interaction

External CDN resources are absolute URLs and are NOT affected by the `base` configuration:

| Resource | URL pattern | Affected by `base`? |
|---|---|---|
| Leaflet CSS/JS | `https://unpkg.com/leaflet@1.9.4/...` | No |
| Gaode map tiles | `https://webrd{s}.is.autonavi.com/...` | No |
| Image proxy | `{LIAN_IMAGE_PROXY_BASE_URL}/...` | No (absolute URL from runtime config) |

Rules:

- External CDN `<script>` and `<link>` tags MUST use absolute URLs, not base-prefixed relative paths.
- SRI `integrity` attributes on external resources are independent of `base`.
- CSP `script-src` / `style-src` allowlists are independent of `base`.

## 8. Reverse proxy and CDN contract

### 8.1 Reverse proxy rules

When a reverse proxy (nginx, Cloudflare, etc.) fronts the app at a subpath:

| Rule | Contract |
|---|---|
| Path rewriting | Proxy MUST pass the full path to the app server, or strip the prefix consistently |
| `base` alignment | The proxy path prefix MUST match the Vite `base` value exactly |
| API proxy | `/api/*` routes MUST be proxied independently of the app `base` path |
| Cache headers | Cache header rules from the release runbook apply unchanged; `base` does not alter cache policy |

### 8.2 CDN prefix

If a CDN is used in front of the app:

| Rule | Contract |
|---|---|
| CDN path | CDN origin pull must respect the `base` prefix |
| Asset URLs | All asset URLs in HTML must already include the `base` prefix (Vite handles this) |
| Cache purge | Cache purge paths must include the `base` prefix for HTML and unhashed assets |

## 9. Verification checklist

### Root deployment (default)

- [ ] `vite.config.ts` `base` is `"/"` (or `LIAN_BASE_PATH` is unset/default)
- [ ] `npm run build` produces `dist/` with root-relative asset paths
- [ ] `vite preview` serves the app at `/`
- [ ] Legacy server serves the app at `/` on port 4300
- [ ] Vue canary serves the app at `/` on port 4301
- [ ] All asset URLs in built HTML are root-relative (`/assets/...`)
- [ ] PWA manifest `start_url` and `scope` are `"/"`
- [ ] Service worker registers at `/sw.js` with scope `/`

### Subpath deployment

- [ ] `LIAN_BASE_PATH` is set to a valid path (e.g., `"/app/"`)
- [ ] `vite.config.ts` reads `LIAN_BASE_PATH` and sets `base` accordingly
- [ ] `npm run build` produces `dist/` with base-prefixed asset paths
- [ ] `vite preview` serves the app under the base prefix
- [ ] Legacy server serves the app under the base prefix
- [ ] `window.LIAN_BASE_PATH` is injected into legacy HTML
- [ ] All asset URLs in built HTML include the base prefix
- [ ] PWA manifest `start_url` and `scope` match the base path
- [ ] Service worker registers at `{base}sw.js` with scope `{base}`
- [ ] `import.meta.env.BASE_URL` returns the correct base value
- [ ] API proxy routes (`/api/*`) remain at origin root, not under base prefix
- [ ] External CDN resources (Leaflet) load correctly regardless of base path

### Cross-runtime consistency

- [ ] Legacy and Vue runtimes resolve the same asset paths for the same `base` value
- [ ] `LIAN_BASE_PATH` (legacy) matches `base` (Vue/Vite) for the same deployment
- [ ] Dev mode (`vite dev`) uses the same `base` as production builds

## 10. Non-goals

- No implementation of subpath support in this slice; this contract defines the rules only.
- No changes to `vite.config.ts`, `runtime-config.ts`, or any source file.
- No changes to `scripts/serve-frontend-static-rehearsal.js` or `scripts/serve-frontend-runtimes.js`.
- No changes to PWA manifest, service worker, or icons (none exist yet).
- No CDN migration or Leaflet bundling decisions (tracked in #152).
- No CSP header changes (tracked in #112 / #152).
- No reverse proxy configuration changes.
- No changes to the release runbook cache header contract.

## 11. Relationship to adjacent issues

- #109 defines the PWA/service-worker/install contract. The PWA scope and `start_url` rules in this contract extend #109's manifest fields to support subpath deployment.
- #134 defines release and rollback contracts. The release runbook's cache header and artifact rules are independent of `base` but must be re-verified when `base` changes.
- #152 defines external CDN, SRI, and CSP contracts. CDN resources are absolute URLs and are not affected by `base`, but the CSP allowlist must still be verified.
- #167 defines runtime config schema and injection timing. The `LIAN_BASE_PATH` variable extends the existing `window.LIAN_*` injection contract defined there.

## 12. Implementation follow-up

This contract intentionally leaves implementation to later bounded slices. Expected follow-up categories:

1. Add `LIAN_BASE_PATH` env var and `base` field to `vite.config.ts`
2. Add `window.LIAN_BASE_PATH` injection to the static rehearsal server
3. Refactor legacy `public/index.html` to use base-path-prefixed asset references
4. Update Vue entry `index.html` manifest link to use `import.meta.env.BASE_URL`
5. Update PWA manifest `start_url` and `scope` to use base path (when PWA is implemented per #109)
6. Update service worker registration to use base-prefixed path (when SW is implemented per #109)
7. Add subpath deployment smoke tests to the release runbook
8. Update `scripts/serve-frontend-runtimes.js` to pass base path to both runtimes
