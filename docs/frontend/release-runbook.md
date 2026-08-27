# Frontend Release Runbook

Operational runbook for releasing, verifying, and rolling back the LIAN Mobile Web frontend. Covers the active Vue/Vite runtime on `main`. The legacy static runtime was removed in PR #282 and migrated to `taoyu051818-sys/-lian-mobile-web-legacy`.

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

The deployable artifact is the output of `npm run build` (the Vite `dist/` directory). Deployments must use the reviewed artifact from CI, never rebuild on the target host.

**What gets archived:**

| Content                   | Source                                                   | Notes                                                 |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Vite hashed JS/CSS/assets | `dist/`                                                  | Content-addressed filenames                           |
| Manifest and icons        | `public/manifest.webmanifest`, `public/icons/*`          | When PWA installability is enabled                    |
| Standalone tool assets    | `public/tools/*` and referenced same-origin static files | Internal tools shipped alongside the repo when needed |

**Current verification boundary** (`.github/workflows/frontend-verify.yml`):

- `npm run verify` runs static guards, build, unit tests, and smoke in one step.
- It is the authoritative automatic PR/main quality gate; deterministic browser journeys run in
  the separate `.github/workflows/e2e-pr-gate.yml` workflow.

**Prelaunch release boundary:** `.github/workflows/frontend-auto-build.yml` is manual-only. Its
`verify` job builds and uploads the reviewed `dist/` artifact, and its `deploy-main` job downloads
that exact artifact before copying it to the target host. The target host must only unpack and serve
the artifact; it must not run dependency installation, source checkout repair, or a build step.

**Deployment rule:** the target host receives the pre-built artifact. It must never run `npm install`, `npm run build`, or any build step at runtime.

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
  "assetList": ["index.html", "assets/...", "manifest.webmanifest", "..."]
}
```

**How to use it:**

- Inject `releaseId` into runtime config so post-deploy smoke and diagnostics can identify the deployed build.
- Record the previous `releaseId` before each deployment so rollback has a known target.
- Store manifests in a release log (file, database, or GitHub release) for audit trail.

**Current state:** automated manifest generation is still tracked under #134.

---

## 3. Runtime config

Current repo truth and deployment truth are slightly different here:

- root `index.html` on `main` is a plain Vite shell entry and does not commit an inline runtime-config `<script>` block;
- if deployment injects runtime config into the served HTML, that injection must happen ahead of the app entry so the Vue runtime can read environment-specific values without rebuilding.

**Current variables:**

| Variable                    | Source                                  | Default                                              |
| --------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `LIAN_API_BASE_URL`         | Deploy-time runtime injection (if used) | `""` (same-origin)                                   |
| `LIAN_IMAGE_PROXY_BASE_URL` | Deploy-time runtime injection (if used) | `window.location.origin`                             |
| `LIAN_PUBLIC_PROTO`         | Deploy-time runtime injection / env     | `""` (auto-detect)                                   |
| `releaseId`                 | Release manifest injection              | none                                                 |
| `enablePwa`                 | Runtime feature flag                    | disabled until the PWA path is intentionally enabled |

**Production contract:**

- `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` must point to the target environment or remain empty for same-origin routing.
- Runtime config must not contain secrets, tokens, or per-user data.
- HTML must stay network-revalidated so runtime-config changes propagate quickly.
- Any deploy-time runtime-config injection must remain compatible with the plain-root-HTML repo baseline rather than rewriting frontend ownership assumptions.

**Release checklist for runtime config:**

- [ ] Confirm `LIAN_API_BASE_URL` and `LIAN_IMAGE_PROXY_BASE_URL` match the target environment
- [ ] Inject `releaseId` from the release manifest when a runtime-config layer is in use
- [ ] Confirm no rehearsal-only or developer-only flags leak into production
- [ ] Confirm any deploy-time HTML injection happens before the built app entry executes

---

## 4. Cache headers

Production must differentiate resource types for caching.

**Production cache header contract:**

| Resource type                                        | `cache-control`                              | Rationale                                                           |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| `index.html`                                         | `no-cache` (or `max-age=0, must-revalidate`) | Always revalidate; HTML is the entry point                          |
| Vite hashed JS/CSS (`/assets/*.js`, `/assets/*.css`) | `max-age=31536000, immutable`                | Content hash in filename; safe to cache forever                     |
| `manifest.webmanifest`                               | `max-age=3600`                               | Short cache; PWA metadata may change                                |
| Icons / images                                       | `max-age=86400`                              | Daily revalidation acceptable                                       |
| Service Worker (`sw.js`)                             | `no-cache`                                   | Must always check for updates                                       |
| Standalone internal tool HTML / JS / CSS             | `no-cache` or short TTL                      | These pages are not content-hashed and should pick up fixes quickly |
| API responses                                        | `no-store`                                   | Never cache user-specific data                                      |

**Enforcement:**

- CDN or reverse proxy must set these headers.
- Post-deploy smoke should verify `cache-control` on `index.html`, one hashed asset, and `sw.js` when PWA is enabled.

---

## 5. CDN and external assets

The active Vue shell no longer loads Leaflet from `unpkg` in root `index.html`. Leaflet is bundled through `src/platform/leaflet.ts` as part of the Vite build. The remaining external Leaflet dependency lives in standalone internal map tools under `public/tools/`.

**Current external dependencies:**

| Resource                    | URL                                                | SRI state                      | Notes                                                                                                                    |
| --------------------------- | -------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Standalone tool Leaflet CSS | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` | Missing on current `main`      | Loaded by `public/tools/map-v2-editor.html`, `public/tools/map-georef.html`, and `public/tools/map-coastline-align.html` |
| Standalone tool Leaflet JS  | `https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`  | Missing on current `main`      | Loaded by the same tool pages                                                                                            |
| Gaode tiles                 | `https://webrd0{s}.is.autonavi.com/...`            | N/A                            | Third-party map tile provider used by the Vue map surface and the tool surfaces                                          |
| Vue-shell Leaflet runtime   | bundled via npm/Vite                               | Not applicable as external SRI | Imported through `src/platform/leaflet.ts`                                                                               |

**Risks:**

- `unpkg` outage or network restriction now affects the standalone internal tools, not the main Vue shell.
- Third-party tile availability still affects map rendering across the app and tools.
- Missing SRI on tool-side Leaflet tags leaves a supply-chain gap for those pages.
- PWA offline behavior must not assume third-party tiles or tool-side CDN assets are available.

**Mitigations (tracked in #152):**

- Keep the main user-facing Vue shell on bundled Leaflet.
- Add SRI or remove the external dependency for the remaining tool-side Leaflet tags.
- Keep an external asset inventory: URL, version, SRI state, owner, and upgrade process.
- Define CSP `script-src` / `style-src` / `img-src` / `connect-src` allowlists that cover only the still-needed external origins.
- Do not pre-cache third-party tiles by default in the Service Worker.

**Release checklist for external assets:**

- [ ] Verify Gaode tile endpoints are reachable from the target environment
- [ ] If the internal tools are part of the deployment surface, verify their `unpkg` Leaflet dependency is reachable too
- [ ] Verify CSP allowlist covers the still-required external origins and no broader set
- [ ] Verify any added SRI values match the expected Leaflet version

---

## 6. Vue/Vite runtime

Vue/Vite is the sole active web runtime on `main`.

| Runtime  | Entry             | Port           | Failure behavior              |
| -------- | ----------------- | -------------- | ----------------------------- |
| Vue/Vite | `npm run preview` | 4173 (default) | Process exits with error code |

**Health checks:**

- `GET /` should return 200.
- `GET /api/feed` and `GET /api/map/v2/items` should return JSON (or 502 if backend is down; this is acceptable in smoke).
- The map surface should load using bundled Leaflet from the reviewed build artifact rather than a runtime `unpkg` dependency.

---

## 7. Post-deploy smoke

Run these checks immediately after deploying to each environment.

**Smoke checklist:**

| Check                           | Target     | Expected                                                               |
| ------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `GET /`                         | Vue/Vite   | 200                                                                    |
| `GET /api/feed`                 | Vue/Vite   | JSON response (skip if backend unavailable)                            |
| `GET /api/map/v2/items`         | Vue/Vite   | JSON response (skip if backend unavailable)                            |
| `cache-control` on `GET /`      | Production | `no-cache` or `max-age=0, must-revalidate`                             |
| `cache-control` on hashed asset | Production | `max-age=31536000, immutable`                                          |
| Release ID                      | Production | Matches expected git SHA from the release manifest                     |
| Tool-side Leaflet CDN           | Production | Only required if the standalone internal tools are in deployment scope |
| Gaode tiles                     | Production | Reachable where map functionality is expected                          |

**Decision criteria:**

- Any **critical** check failure (homepage down, all API 500s, main shell map broken from the shipped artifact) triggers immediate rollback.
- Any **non-critical** check failure (tool-only CDN unreachable, single API endpoint down) triggers investigation with a short timeout before rollback decision.

---

## 8. Rollback

### Rollback target

Before every release, record:

- the current release ID being deployed
- the previous release ID to roll back to
- the previous artifact location (GitHub Actions artifact, object storage, or image tag)

Store this in the release log or deployment ticket.

### Rollback procedure

1. Decide to rollback based on post-deploy smoke or production monitoring.
2. Redeploy the previous artifact. Do not rebuild; use the archived artifact.
3. Restore runtime config if the release changed any `LIAN_*` values.
4. Purge cached `index.html` and any unhashed assets from the CDN if needed.
5. Re-run post-deploy smoke and confirm the release ID matches the previous release.
6. Notify the deployment channel with the rolled-back release ID, reason, and smoke result.

### Rollback with PWA / Service Worker

See [PWA and Service Worker kill switch](#9-pwa-and-service-worker-kill-switch).

---

## 9. PWA and Service Worker kill switch

When PWA is enabled (per #109), Service Worker caching adds complexity to rollback. Users may continue running an old SW even after the server has been rolled back.

### Kill switch mechanism

The Service Worker must support a kill switch: a way to remotely instruct clients to unregister and clear caches.

**Implementation options (choose one in #109 RFC):**

1. Server-side flag: the SW fetches a kill-switch endpoint on activation and unregisters if disabled.
2. Manifest or version mismatch: the SW detects a mismatch and triggers cleanup.
3. Dedicated status URL: the SW checks a well-known JSON document and unregisters when `enabled` is false.

### PWA cache invalidation

- Vite hashed assets are safe for long cache lifetimes because filenames change with content.
- `index.html` must stay network-first so runtime-config and release updates propagate.
- Standalone internal tool pages should stay out of aggressive immutable caching unless they gain a stronger release contract.
- Third-party tiles should not be cached by default unless provider terms and storage limits are explicitly handled.

---

## 10. Production must not run runtime npm install

The frontend runtime contract is split across four stages:

1. **Install** materializes the committed dependency graph from `package-lock.json`.
2. **Build** creates the reviewed frontend artifact.
3. **Deploy-prepare** assembles that artifact and target-environment runtime config for the host.
4. **Startup** launches the already-prepared runtime and may fail fast if prerequisites are missing.

Production startup owns only the last step. It must never repair missing prerequisites by installing dependencies or rebuilding the app on the target host.

**Current implementation truth:**

- CI and local setup already rely on the lockfile and `npm ci`.
- Startup should launch reviewed artifacts only.
- Missing build output or other prerequisite gaps must stop startup with a clear operator-facing error instead of mutating the host.

**Why this boundary exists:**

- Runtime dependency installation is less deterministic than the dependency graph CI validated.
- Startup-time network access is fragile and slows incident recovery.
- Reinstalling or rebuilding on the target host weakens rollback truth because the running artifact no longer matches the reviewed artifact.
- Supply-chain and host-drift risk both increase when process launch mutates dependency state.

---

## Pre-release checklist

Before deploying a new frontend release:

- [ ] CI passed (`npm run verify`)
- [ ] `E2E PR Gate` passed for PR-bound releases
- [ ] Full `E2E Journey` is green from an explicit manual run against the target commit and environment for every journey group touched by a release that changes user flows, role permissions, publish/order state, messaging, profile/detail pages, or runtime API contracts
- [ ] Release manifest generated with git SHA, build time, Node/npm versions, and asset list
- [ ] Previous release ID recorded as rollback target
- [ ] Runtime config verified for the target environment
- [ ] CSP allowlist covers all still-required external origins
- [ ] Bundle budget within limits (tracked in #121)
- [ ] PWA kill switch tested when PWA is enabled
- [ ] `cache-control` headers configured at the CDN / reverse-proxy layer
- [ ] Rollback artifact available and verified
- [ ] If internal tools are in scope, their remaining `unpkg` Leaflet dependency is reviewed too

## Post-release checklist

After deploying:

- [ ] Post-deploy smoke passed
- [ ] Release ID in runtime config matches the expected git SHA
- [ ] `cache-control` headers are correct on key resources
- [ ] No spike in client-side errors
- [ ] Deployment logged with release ID, timestamp, and deployer
