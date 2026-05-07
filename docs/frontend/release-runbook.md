# Frontend Release Runbook

Operational runbook for releasing, verifying, and rolling back the LIAN Mobile Web frontend. Covers both the legacy `public/` static entry and the Vue/Vite canary shell.

## Table of Contents

1. [Release artifact](#1-release-artifact)
2. [Release manifest](#2-release-manifest)
3. [Runtime config](#3-runtime-config)
4. [Cache headers](#4-cache-headers)
5. [CDN and external assets](#5-cdn-and-external-assets)
6. [Legacy and Vue canary runtimes](#6-legacy-and-vue-canary-runtimes)
7. [Post-deploy smoke](#7-post-deploy-smoke)
8. [Rollback](#8-rollback)
9. [PWA and Service Worker kill switch](#9-pwa-and-service-worker-kill-switch)
10. [Production must not run runtime npm install](#10-production-must-not-run-runtime-npm-install)

Related issues: #109 (PWA RFC), #125 (supply chain), #134 (release contracts), #152 (external CDN contracts).

---

## 1. Release artifact

The deployable artifact is the output of `npm run build` (Vite `dist/` directory) plus the legacy `public/` static files. CI must produce and archive this artifact; deployments must use the archived artifact, never rebuild on the target host.

**What gets archived:**

| Content | Source | Notes |
|---|---|---|
| Vite hashed JS/CSS/assets | `dist/` | Content-addressed filenames |
| Legacy static HTML/JS/CSS | `public/` | Unhashed; cache policy differs |
| `index.html` | `public/index.html` | Legacy entry point |
| `manifest.webmanifest` | `public/manifest.webmanifest` | PWA manifest (when enabled) |

**CI artifact boundary** (`.github/workflows/frontend.yml`):

- `npm run verify` runs static guards, build, and smoke in one step.
- The workflow currently does **not** archive `dist/` as a GitHub Actions artifact.
- A future release workflow should upload `dist/` via `actions/upload-artifact` and pin deploy to that artifact.

**Deployment rule:** The target host receives the pre-built artifact. It must never run `npm install`, `npm run build`, or any build step at runtime.

---

## 2. Release manifest

A release manifest records the provenance of a deployed build. Generate it during CI and store it alongside the artifact.

**Required fields:**

```json
{
  "releaseId": "<git sha>",
  "buildTime": "<ISO 8601>",
  "nodeVersion": "22.x",
  "npmVersion": "<locked>",
  "packageLockHash": "<sha256 of package-lock.json>",
  "gitRef": "<branch/tag>",
  "assetList": ["index.html", "app.js", "styles.css", "..."]
}
```

**How to use it:**

- Inject `releaseId` into runtime config so post-deploy smoke and diagnostics can identify the deployed build.
- Record the `releaseId` of the **previous** deployment before each release so rollback has a known target.
- Store manifests in a release log (file, database, or GitHub release) for audit trail.

**Current state:** No manifest generation exists. #134 tracks this as P1.

---

## 3. Runtime config

Runtime config is injected into `index.html` via a `<script>` block that sets `window.LIAN_*` globals **before** application JS loads.

**Current variables:**

| Variable | Source | Default |
|---|---|---|
| `LIAN_API_BASE_URL` | Runtime injection | `""` (same-origin) |
| `LIAN_IMAGE_PROXY_BASE_URL` | Runtime injection | `window.location.origin` |
| `LIAN_BACKEND_BASE_URL` | Env / rehearsal server | `http://127.0.0.1:4200` |
| `LIAN_IMAGE_PROXY_BASE_URL` | Env / rehearsal server | `http://127.0.0.1:4201` |
| `LIAN_PUBLIC_PROTO` | Env | `""` (auto-detect) |

**Production contract:**

- `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` must be set to the production origin or empty (same-origin).
- The static rehearsal server (`serve-frontend-static-rehearsal.js`) injects `LIAN_STATIC_REHEARSAL` with backend/image-proxy URLs and rewrites proxied response bodies to use the request origin. This is rehearsal-only; production does not use this mechanism.
- Runtime config must **not** contain secrets, tokens, or per-user data.

**Release checklist for runtime config:**

- [ ] Confirm `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` match the target environment
- [ ] Confirm no `LIAN_STATIC_REHEARSAL` marker leaks into production HTML
- [ ] Inject `releaseId` from the release manifest into runtime config

---

## 4. Cache headers

Cache policy differs between rehearsal and production. The rehearsal server uses `cache-control: no-store` for all responses; production must differentiate resource types.

**Production cache header contract:**

| Resource type | `cache-control` | Rationale |
|---|---|---|
| `index.html` | `no-cache` (or `max-age=0, must-revalidate`) | Always revalidate; HTML is the entry point |
| Vite hashed JS/CSS (`/assets/*.js`, `/assets/*.css`) | `max-age=31536000, immutable` | Content hash in filename; safe to cache forever |
| Legacy `public/*.js`, `public/*.css` | `max-age=3600` or `no-cache` | Unhashed; must pick up fixes within an hour |
| `manifest.webmanifest` | `max-age=3600` | Short cache; PWA metadata may change |
| Icons / images | `max-age=86400` | Daily revalidation acceptable |
| Service Worker (`sw.js`) | `no-cache` | Must always check for updates |
| API responses | `no-store` | Never cache user-specific data |

**Enforcement:**

- CDN/reverse proxy must set these headers. The application server alone cannot guarantee correct caching.
- Post-deploy smoke should verify `cache-control` on `index.html`, a hashed asset, and `sw.js` (when PWA is enabled).

**Rehearsal server note:** `scripts/serve-frontend-static-rehearsal.js` sets `cache-control: no-store` on all static responses. This is correct for CI/rehearsal and must not be changed to long-cache values.

---

## 5. CDN and external assets

The legacy frontend loads Leaflet from unpkg CDN. This creates a runtime dependency on an external service.

**Current external dependencies:**

| Resource | URL | SRI | Notes |
|---|---|---|---|
| Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | None | Loaded in `index.html` `<head>` |
| Leaflet JS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` | None | Loaded in `index.html` `<body>` |
| Gaode tiles | `https://webrd0{s}.is.autonavi.com/...` | N/A | Map tile provider; hardcoded in `MapLeafletView.vue` |

**Risks:**

- CDN outage or network restriction (corporate/campus firewalls) breaks the map.
- No SRI means a compromised CDN could inject arbitrary code.
- PWA offline mode cannot serve CDN resources unless they are pre-cached.

**Mitigations (tracked in #152):**

- Add SRI `integrity` attributes to Leaflet CSS/JS in `index.html`.
- Document external asset inventory: URL, version, SRI hash, owner, upgrade process.
- Define CSP `script-src` / `style-src` / `img-src` / `connect-src` allowlist covering `unpkg.com`, `webrd*.is.autonavi.com`, and image/API proxy origins.
- When PWA is enabled, decide whether to pre-cache Leaflet or accept degraded offline map.
- Consider bundling Leaflet via npm to eliminate the CDN runtime dependency.

**Release checklist for external assets:**

- [ ] Verify Leaflet CDN is reachable from the target environment
- [ ] Verify SRI integrity values (when added) match the expected Leaflet version
- [ ] Verify CSP allowlist covers all external origins
- [ ] Verify Gaode tile endpoint is reachable

---

## 6. Legacy and Vue canary runtimes

The application runs two runtimes via `scripts/serve-frontend-runtimes.js`:

| Runtime | Entry | Port | Failure behavior |
|---|---|---|---|
| Legacy | `scripts/serve-frontend-static-rehearsal.js` | `FRONTEND_PORT` (default 4300) | Supervisor exits with code 1; systemd restarts |
| Vue canary | `vite preview` | 4301 (strict) | Supervisor logs error; legacy remains available |

**Health checks:**

- Legacy: `GET /` on port 4300 should return 200 with `class="app-shell"` in HTML.
- Vue canary: `GET /` on port 4301 should return 200.
- Both: `GET /api/feed` and `GET /api/map/v2/items` should return JSON (or 502 if backend is down; this is acceptable in smoke).

**Canary rollout criteria (to be defined):**

- Vue canary passes post-deploy smoke.
- No increase in client-side errors.
- Runtime config matches legacy.
- Traffic can be shifted by updating the reverse proxy / load balancer to route a percentage of requests to port 4301.

**Canary rollback:**

- Disable the Vue canary route in the reverse proxy; all traffic returns to legacy on port 4300.
- The Vue canary process can remain running; it receives no traffic.

---

## 7. Post-deploy smoke

Run these checks immediately after deploying to each environment. Use `scripts/smoke-frontend.js` as a base and extend with the checks below.

**Smoke checklist:**

| Check | Target | Expected |
|---|---|---|
| `GET /` | Legacy (port 4300) | 200, contains `<title>`, `class="app-shell"`, all split scripts |
| `GET /` | Vue canary (port 4301) | 200 |
| `GET /styles.css` | Legacy | 200 |
| `GET /map-v2.js` | Legacy | 200 |
| `GET /api/feed` | Both | JSON response (skip if backend unavailable) |
| `GET /api/map/v2/items` | Both | JSON response (skip if backend unavailable) |
| `cache-control` on `GET /` | Production | `no-cache` or `max-age=0, must-revalidate` |
| `cache-control` on hashed asset | Production | `max-age=31536000, immutable` |
| Runtime config in HTML | Production | No `LIAN_STATIC_REHEARSAL`; correct `LIAN_API_BASE_URL` |
| Release ID | Production | Matches expected git SHA from release manifest |
| Leaflet CDN | Production | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js` returns 200 |

**Decision criteria:**

- Any **critical** check failure (homepage down, all API 500s) triggers immediate rollback.
- Any **non-critical** check failure (CDN unreachable, single API endpoint down) triggers investigation with a 15-minute timeout before rollback decision.

---

## 8. Rollback

### Rollback target

Before every release, record:

- **Current release ID** (git SHA) being deployed.
- **Previous release ID** to roll back to.
- **Previous artifact** location (GitHub Actions artifact, S3, or container image tag).

Store this in the release log or deployment ticket.

### Rollback procedure

1. **Decide to rollback.** Post-deploy smoke failed, or monitoring shows critical errors.

2. **Redeploy previous artifact.** Replace the current artifact with the previous one on the target host. Do **not** rebuild; use the archived artifact.

3. **Restore runtime config.** If the release changed any `LIAN_*` values, revert them to the previous release's values.

4. **Clear CDN cache** (if applicable). Purge `index.html` and any unhashed assets from the CDN. Hashed Vite assets are safe to leave cached.

5. **Verify rollback.** Run the post-deploy smoke against the rolled-back deployment. Confirm the release ID matches the previous release.

6. **Notify.** Post in the deployment channel with: rolled-back release ID, reason, and smoke results.

### Vue canary rollback

If only the Vue canary is broken:

1. Update the reverse proxy to stop routing traffic to port 4301.
2. All traffic falls back to legacy on port 4300.
3. No artifact redeployment needed.

### Rollback with PWA/Service Worker

See [PWA and Service Worker kill switch](#9-pwa-and-service-worker-kill-switch).

---

## 9. PWA and Service Worker kill switch

When PWA is enabled (per #109), Service Worker caching adds complexity to rollback. Users may continue running an old SW even after the server has been rolled back.

### Kill switch mechanism

The Service Worker must support a kill switch: a way to remotely instruct all clients to unregister themselves and clear caches.

**Implementation options (choose one in #109 RFC):**

1. **Server-side flag:** SW fetches a `/sw-kill` endpoint on activation. If the endpoint returns 200, the SW calls `self.registration.unregister()` and clears all caches.

2. **Manifest version bump:** Bump a version field in `manifest.webmanifest`. The SW detects the mismatch and triggers cleanup.

3. **Dedicated kill URL:** The SW checks a well-known URL (e.g., `/sw-status.json`) for a `{"enabled": false}` response. If disabled, SW unregisters.

### Emergency SW cleanup

If the kill switch is not available or not working:

1. Deploy a new SW that immediately calls `skipWaiting()` and `clients.claim()`.
2. In the `activate` event, call `caches.keys()` and delete all caches.
3. The new SW self-destructs: `self.registration.unregister()`.
4. Users get the updated (fixed) version on next page load.

### Rollback with SW

1. Roll back the server artifact (see [Rollback](#8-rollback)).
2. If the old SW is still serving cached assets, activate the kill switch to force clients to the new (rolled-back) build.
3. Verify that `GET /` returns the rolled-back HTML (check release ID).
4. Monitor for clients still running the old SW (via error logs or analytics).

### PWA cache invalidation

- Vite hashed assets: safe; new filenames mean new cache entries.
- `index.html`: must be revalidated (`no-cache`); SW should use network-first for HTML.
- Legacy unhashed JS/CSS: high risk; old versions may persist in SW cache. Use short TTL or network-first strategy.
- Third-party tiles (Gaode): do **not** cache in SW unless explicitly allowed by provider terms.

---

## 10. Production must not run runtime npm install

`scripts/serve-frontend-runtimes.js` contains `ensureRuntimeDependencies()` which runs `npm install` if the Vite binary is missing. This is a safety net for local development; it must never execute in production.

**Why:**

- Runtime `npm install` is non-deterministic: the dependency tree may differ from what CI validated.
- It requires network access at startup, which is unreliable and slow.
- It introduces supply-chain risk: a compromised registry could inject malicious code at deploy time.
- The installed dependencies may differ from the lockfile if `package-lock.json` is absent or stale.

**Enforcement:**

- CI artifact must include `node_modules/` or the pre-built `dist/` output so `ensureRuntimeDependencies()` finds the Vite binary and skips install.
- If the Vite binary is missing at runtime, the supervisor should **fail fast** with a clear error: `"Vite binary missing; deployment artifact is incomplete"` rather than attempting install.
- Deployment documentation must state: "Never run `npm install` on the target host. Use the CI artifact."

**Current state:** `ensureRuntimeDependencies()` in `scripts/serve-frontend-runtimes.js` (lines 15-29) unconditionally runs `npm install` when the Vite binary is absent. Both branches of the `installCommand` ternary resolve to `"npm install"`. This must be changed to fail-fast before production use.

**Tracked in:** #134 (P1: runtime supervisor should not install in target environment), #125 (supply chain baseline).

---

## Pre-release checklist

Before deploying a new frontend release:

- [ ] CI passed (`npm run verify`): static guards, build, smoke
- [ ] Release manifest generated with git SHA, build time, Node/npm versions, asset list
- [ ] Previous release ID recorded as rollback target
- [ ] Runtime config verified for target environment (`LIAN_API_BASE_URL`, `LIAN_IMAGE_PROXY_BASE_URL`)
- [ ] External CDN reachable (Leaflet from unpkg)
- [ ] CSP allowlist covers all external origins (when CSP is enabled)
- [ ] Bundle budget within limits (tracked in #121)
- [ ] PWA kill switch tested (when PWA is enabled)
- [ ] `cache-control` headers configured at CDN/reverse proxy layer
- [ ] Rollback artifact available and verified

## Post-release checklist

After deploying:

- [ ] Post-deploy smoke passed (all checks in section 7)
- [ ] Release ID in runtime config matches expected git SHA
- [ ] `cache-control` headers correct on key resources
- [ ] No `LIAN_STATIC_REHEARSAL` marker in production HTML
- [ ] Legacy runtime healthy (port 4300)
- [ ] Vue canary healthy (port 4301, if deployed)
- [ ] No spike in client-side errors (check logs/analytics)
- [ ] Deployment logged with release ID, timestamp, and deployer
