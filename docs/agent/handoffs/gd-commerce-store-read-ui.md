# Handoff: GD commerce store read UI

Status: implementation complete; independently accepted; not deployed

## Summary

The first default-off LIAN commerce UI is implemented against the accepted
GDPlatform provider commit `6d192bb30d510487e913fe8efacc10d34d7860a6`
and LIAN BFF commit `db87e99dc2c7b305448d7212f746c24b43a30264`.
It adds an anonymous store directory at `#/commerce` and store detail at
`#/commerce/stores/{storeId}`. The browser talks only to the LIAN same-origin
public contract `contracts/commerce-store-v1.openapi.json` version `1.0.0`.

## Product behavior

- The commerce entry is a real link in both guest and authenticated Profile
  states, and is rendered only when `VITE_COMMERCE_CATALOG_VISIBLE === 'true'`.
- Direct commerce links show a local closed state and perform zero requests
  when the frontend flag is false.
- Store cards and the list/detail return link are real anchors, so refresh,
  forward, back, copy-link, and open-in-new-tab behavior use the URL as truth.
- Loading, empty, not-found, rate-limit, timeout, malformed, and generic error
  paths use the shared LIAN state vocabulary. Store logos remain local CSS
  placeholders; the UI emits no image request.
- Products, cart, checkout, orders, payment, favorites, personalized data, and
  all writes remain outside this slice.

## Architecture and security

- `commerce` is a lazy secret content view and is not a sixth bottom tab.
- The raw commerce hash parser accepts only the two canonical route shapes and
  keeps store IDs as decimal strings in `1..2147483647`.
- Commerce uses literal root-relative `fetch` with same-origin credentials,
  `no-store`, redirect rejection, and AbortSignal. It does not import the
  configurable API base, generic HTTP adapter, GD/LA endpoints, or client ID.
- Success adoption requires HTTP 200, JSON, exact `Cache-Control: no-store`, a
  lowercase UUIDv4 matching the body and response header, schema `1.0.0`, exact
  keys, null asset reference, safe integer bounds, fixed-point ratings, and all
  list/detail invariants.
- Each route/retry owns a generation and AbortController with a 12-second
  timeout. Route changes and unmount permanently stale late responses. Paired
  `hashchange`/`popstate` events for one raw URL are deduplicated.
- The projection remains anonymous and non-personalized, so no account epoch is
  required for this read-only slice.

## Files changed

All files are within the exact allowlist in
`docs/agent/tasks/gd-commerce-store-read-ui.md`. The generated ownership report
was refreshed locally and remains ignored by repository policy.

## Validation

- focused commerce Vitest: 3 files, 75 tests passing;
- commerce structure test: 9/9 passing;
- test inventory: 178 Vitest files and 68 Node test files;
- production build: 670 modules transformed, PWA precache 75 entries;
- local Chromium commerce journey: 3/3 passing, covering guest/authenticated
  discovery, cold refresh, real anchors, back/forward ownership, hostile
  runtime API base isolation, zero images, list/detail 404 separation, retry,
  and invalid-hash zero-request behavior;
- full `npm run verify`: 4,753/4,753 Vitest assertions, 854/854 Node structure
  assertions, HTML sanitizer, two production builds, PWA generation, and 3/3
  frontend smoke checks passing;
- independent final review: ACCEPTED with no P1, P2, or submission-blocking P3
  finding; its own rerun passed commerce Vitest 75/75, related compatibility/PWA
  Vitest 43/43, structure 9/9, Chromium 3/3, build, inventory, and diff checks;
- the reviewer also cold-started the default build at both accepted hashes and
  observed the local closed state with zero commerce API requests;
- `git diff --check`: passing.

## Release gates and rollback

- The frontend, LIAN BFF, GDPlatform internal API, and GD catalog flags remain
  false by default. This handoff authorizes no deployment or production flag
  change.
- LIAN's real two-network NATAPP forged-header smoke and shared multi-instance
  edge rate limiter remain production enablement gates.
- Rollback is to keep `VITE_COMMERCE_CATALOG_VISIBLE=false` and both server-side
  catalog flags false, then revert this additive frontend slice. It creates no
  user or business data.
