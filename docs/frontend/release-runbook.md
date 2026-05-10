# Frontend Release Runbook

Operational runbook for releasing, verifying, and rolling back the LIAN Mobile Web frontend. Covers the Vue/Vite runtime. The legacy static runtime was removed in PR #282 and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy.

## Table of Contents

1. [Release artifact](#1-release-artifact)
2. [Release manifest](#2-release-manifest)
3. [Runtime config](#3-runtime-config)
4. [Cache headers](#4-cache-headers)
5. [CDN and external assets](#5-cdn-and-external-assets)
6. [Vue/Vite runtime](#6-vuevite-runtime)
7. [Post-deploy smoke](#7-post-deploy-smoke)
8. [Rollback](#8-rollback)
9. [PWA and Service Worker kill switch](#9-pwa-and-service-worker-kill-switch)
10. [Production must not run runtime npm install](#10-production-must-not-run-runtime-npm-install)

Related issues: #109 (PWA RFC), #125 (supply chain), #134 (release contracts), #152 (external CDN contracts).

---

## 1. Release artifact

The deployable artifact is the output of `npm run build` (Vite `dist/` directory). CI must produce and archive this artifact; deployments must use the archived artifact, never rebuild on the target host.

**What gets archived:**

| Content | Source | Notes |
|---|---|---|
| Vite hashed JS/CSS/assets | `dist/` | Content-addressed filenames |
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
- Runtime config must **not** contain secrets, tokens, or per-user data.

**Release checklist for runtime config:**

- [ ] Confirm `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` match the target environment
- [ ] Inject `releaseId` from the release manifest into runtime config

---

## 4. Cache headers

Production must differentiate resource types for caching.

**Production cache header contract:**

| Resource type | `cache-control` | Rationale |
|---|---|---|
| `index.html` | `no-cache` (or `max-age=0, must-revalidate`) | Always revalidate; HTML is the entry point |
| Vite hashed JS/CSS (`/assets/*.js`, `/assets/*.css`) | `max-age=31536000, immutable` | Content hash in filename; safe to cache forever |
| `manifest.webmanifest` | `max-age=3600` | Short cache; PWA metadata may change |
| Icons / images | `max-age=86400` | Daily revalidation acceptable |
| Service Worker (`sw.js`) | `no-cache` | Must always check for updates |
| API responses | `no-store` | Never cache user-specific data |

**Enforcement:**

- CDN/reverse proxy must set these headers. The application server alone cannot guarantee correct caching.
- Post-deploy smoke should verify `cache-control` on `index.html`, a hashed asset, and `sw.js` (when PWA is enabled).

---

## 5. CDN and external assets

The frontend loads Leaflet from unpkg CDN. This creates a runtime dependency on an external service.

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

## 6. Vue/Vite runtime

The legacy static runtime was removed in PR #282 and migrated to https://github.com/taoyu051818-sys/-lian-mobile-web-legacy. Vue/Vite is the sole active web runtime.

| Runtime | Entry | Port | Failure behavior |
|---|---|---|---|
| Vue/Vite | `npm run preview` | 4173 (default) | Process exits with error code |

**Health checks:**

- `GET /` should return 200.
- `GET /api/feed` and `GET /api/map/v2/items` should return JSON (or 502 if backend is down; this is acceptable in smoke).

---

## 7. Post-deploy smoke

Run these checks immediately after deploying to each environment.

**Smoke checklist:**

| Check | Target | Expected |
|---|---|---|
| `GET /` | Vue/Vite | 200 |
| `GET /api/feed` | Vue/Vite | JSON response (skip if backend unavailable) |
| `GET /api/map/v2/items` | Vue/Vite | JSON response (skip if backend unavailable) |
| `cache-control` on `GET /` | Production | `no-cache` or `max-age=0, must-revalidate` |
| `cache-control` on hashed asset | Production | `max-age=31536000, immutable` |
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
- Third-party tiles (Gaode): do **not** cache in SW unless explicitly allowed by provider terms.

---

## 10. Production must not run runtime npm install

The current frontend runtime contract is split across four stages:

1. **Install** materializes the committed dependency graph from `package-lock.json`.
2. **Build** creates the reviewed frontend artifact.
3. **Deploy-prepare** assembles that artifact and target-environment runtime config for the host.
4. **Startup** launches the already-prepared runtime and may fail fast if prerequisites are missing.

Production startup owns only the last step. It must never repair missing prerequisites by installing dependencies or rebuilding the app on the target host.

**Current implementation truth:**

- PR #170 removed runtime-time dependency installation from the startup path and changed missing prerequisite handling to fail fast with operator guidance.
- PR #189 aligned CI and local setup on a lockfile-based install and Node version policy.
- `README.md` and `docs/frontend/runtime-responsibility-contract.md` are now the operator-facing references for this split.

**Production rules:**

- Install happens in CI or deploy-prepare with `npm ci`.
- Build happens before deployment with `npm run build` and related validation.
- Startup launches reviewed artifacts only.
- A missing Vite binary, missing build output, or other prerequisite gap must stop startup with a clear operator-facing error instead of trying to mutate the host.

**Why this boundary exists:**

- Runtime dependency installation is non-deterministic compared with the dependency graph CI validated.
- Startup-time network access is fragile and slows incident recovery.
- Reinstalling or rebuilding on the target host weakens rollback truth because the running artifact no longer matches the reviewed artifact.
- Supply-chain and host-drift risk both increase when process launch mutates dependency state.

**Still intentionally out of scope here:**

- whether production canary should keep using `vite preview` or move to a different static-hosting path;
- release-manifest generation and artifact provenance automation;
- broader supervisor redesign beyond the current startup/preflight boundary.

Those remaining decisions stay tracked separately under #171 and #134.

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
- [ ] Startup owner has confirmed the host already has the reviewed dependencies and artifact; no runtime install/build step remains

## Post-release checklist

After deploying:

- [ ] Post-deploy smoke passed (all checks in section 7)
- [ ] Release ID in runtime config matches expected git SHA
- [ ] `cache-control` headers correct on key resources
- [ ] No spike in client-side errors (check logs/analytics)
- [ ] Deployment logged with release ID, timestamp, and deployer
