# Runtime inventory

## Runtime model

The frontend runs as a Vue 3 + Vite application. The legacy static runtime has been migrated to `taoyu051818-sys/-lian-mobile-web-legacy`.

`npm start` runs `vite preview` on port 4301. `npm run dev` starts the Vite dev server. There is no longer a dual-lane supervisor or static rehearsal server.

## Dependency preflight contract

The Vite preview server must not install dependencies at startup.

When the Vite binary is missing the process must:

1. Log the missing binary path.
2. Exit with a non-zero status.

This keeps production startup deterministic and aligns runtime behavior with the CI artifact / lockfile supply-chain baseline (#134, #125).

## Runtime config accessor contract

The shared runtime config accessor (`src/config/runtime-config.ts`) reads `window.LIAN_API_BASE_URL` and `window.LIAN_IMAGE_PROXY_BASE_URL` lazily on every call. The Vite config validates env vars at startup via an inline `parseEnvUrl` helper that rejects non-absolute URLs. Outside dev contexts the accessor rejects localhost origins and requires the image-proxy URL to be non-empty.

This keeps the injection order contract explicit: the serve script injects config into `<head>` before any app module runs, and the accessor never freezes a stale value at import time.

## Unsafe DOM sink guard

The frontend verification gate includes `scripts/guard-unsafe-dom-sinks.js` to block newly introduced raw `v-html`, `innerHTML`, and direct browser dialog sinks outside approved safe-rendering surfaces.

Any PR that changes unsafe DOM sink guard coverage, project-structure validation, or the verification script that wires the guard must keep this inventory updated. Existing feature code should route HTML rendering through approved safe utilities/components rather than adding new allowlist entries.

## Public runtime exposure guard

The frontend verification gate includes `npm run check:runtime-exposure`, which runs `scripts/guard-public-runtime-exposure.js`.

The guard scans public/runtime entry files for rehearsal-only and debug-only markers before build or smoke validation. Any PR that changes the public runtime exposure guard, its focused test script, or frontend project-structure validation must keep this inventory updated so operational reviewers can see why the runtime gate changed.

## Verify gate unit-test contract

The frontend verification gate runs static checks, build, focused unit tests, and smoke validation in one `npm run verify` path. Unit-test configuration lives in `vitest.config.ts`, and test dependencies are locked by `package-lock.json`.

Any PR that changes the verify script, unit-test wiring, TypeScript test config, or locked test dependencies must keep this inventory updated so CI behavior stays reviewable.

## UGC HTML sanitizer verification

The frontend verification path includes focused sanitizer/audit coverage for user-generated HTML rendering. The package scripts may wire `scripts/audit-v-html-usage.js` and `scripts/test-html-sanitizer.js` so PRs that touch UGC rendering prove that raw HTML only reaches approved safe-rendering surfaces.

Any PR that changes sanitizer verification scripts, package-level HTML safety checks, or safe-rendering guard coverage must update this inventory in the same branch.

## Static asset preload contract

`index.html` includes `<link rel="preload">` hints for map-critical static assets:

- `/assets/campus-base-map.png` — campus map base image (preloaded as `image`)
- `/assets/road-network-preview.json` — road network fallback data (preloaded as `fetch`, cross-origin)

These hints cause the browser to start downloading map assets on initial app load, before the user navigates to the explore tab. This reduces first-visit map load latency by ~500-1000ms.

Any PR that adds, removes, or modifies preload hints in `index.html` must keep this inventory updated.

## Leaflet bundled asset contract

Leaflet JS and CSS are bundled through npm (`leaflet` dependency in `package.json`) and resolved by Vite at build time. The previous unpkg CDN `<link>` and `<script>` tags with SRI hashes have been removed from `index.html`.

This ensures the map runtime loads from the same origin as the app bundle, eliminating CDN availability and SRI mismatch failures. The `@types/leaflet` dev dependency provides type coverage for Leaflet APIs used in the map views.

Any PR that changes the Leaflet dependency version, adds or removes Leaflet plugins, or alters how Leaflet assets are imported must keep this inventory updated.

## Architecture boundary guards

`scripts/validate-project-structure.js` includes architecture boundary guards that enforce the `src/features/` directory structure after migration. The guards check:

1. `src/views/` ban — the legacy directory must not exist
2. `src/ui/**` → `src/features/**` — UI layer must not import feature code
3. `src/domain/**` purity — domain must not import Vue, API, UI, or feature code
4. `src/platform/**` boundary — platform must not import feature/page components
5. Feature cross-imports — if a feature has a barrel (`index.ts`), cross-feature imports must go through it

The guards run as part of `npm run check` and are verified by `tests/architecture/project-structure-guard.mjs`. Any PR that modifies `scripts/validate-project-structure.js` or the architecture guard tests must keep this inventory updated.

## Operational rule

Any PR that changes dependency preflight behavior, the runtime config accessor/env-validation contract, unsafe DOM sink guard coverage, public runtime exposure checks, frontend project-structure validation, frontend verify/test wiring, or UGC HTML sanitizer verification must update this document or another runtime inventory artifact in the same PR.
