# Current Status

Last verified: 2026-08-30

Active control issue: none; Actor/Cart cross-repository verification is closed.

Open release blockers: the next frontend promotion must pair an exact backend SHA and publish the
unified release manifest; no production rollout is authorized by this document.

Current production release: frontend `6de102c0c3e95c3b205883858eba6e54de71db34` with backend
`0fb3a504948bd877a0e3579413898fcb8f2117c6` as observed on 2026-08-30.

The active map implementation now uses a JSON-first Konva scene rendered through `vue-konva`.
The Leaflet runtime, Leaflet composables and unauthenticated public map editing/georeference tools
have been retired rather than kept as a parallel compatibility path. Existing `/api/map/v2/items`
discovery, place/post navigation, publish location picking and `PostLocation` handoff remain the
business boundaries. The ops-token administration lane now contains the authenticated Konva scene
editor for asset upload, selection, drag, resize, rotation, JSON export and explicit save through
`GET/PUT /api/admin/map-v2`; it uses the same scene schema instead of restoring the retired tools.

RC1 LA retirement R1 is prepared as a frontend-only implementation candidate. It removes the
automatic LA administrator probe, browser client, merchant component/request owner and
`session-merchants` lane. The legacy LIAN ops-token reports, verification, auth-link and audit
surfaces remain, with account-epoch and request-owner cleanup on exit, account change, logout and
unmount.

This source change is not a deployment approval. Before deploying R1, the release owner must attest
through an approved non-secret inventory that both running backend LA flags are false and record the
observable frontend/backend release identities. The backend LA route remains unchanged and
default-off as the bounded R1 rollback control.

Actor/Cart control issues [frontend #1097](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1097),
[backend #943](https://github.com/taoyu051818-sys/lian-platform-server/issues/943) and
[GDPlatform #3](https://github.com/taoyu051818-sys/gdplatform-dev/issues/3) are closed. The governed
local cross-repository smoke passed login, catalog, strict Actor initialization, cart read/set/read/
delete/read, cleanup and logout. Commerce exposure flags remain default-off; this verification does
not authorize a production rollout.

These production commits are deployment facts, not repository `main`. The next frontend release
must publish the unified `/release-manifest.json` and prove that its backend commit matches
`/api/system/health`.

Repository lifecycle and ownership are defined only in
[`docs/REPOSITORY_RELATIONSHIP.md`](REPOSITORY_RELATIONSHIP.md).

## Accepted baseline

- The implementation base `643acae` contains the accepted offline commerce fixtures and restored
  frontend CI from PR `#1096`.
- The CI-consolidation change retains one authoritative full PR verification workflow and the
  deterministic local E2E gate; deployment and online canary remain explicit manual actions.
  Vercel previews remain available, but root configuration disables automatic Production
  deployments from `main`.
- Anonymous store/product discovery plus authenticated SKU selection and cart read/set/delete are
  independently accepted behind default-off frontend/backend/provider flags. Quote, checkout,
  order and payment remain outside the implemented slice.
- On 2026-08-23 the full `npm run verify` command passed after the Actor/Cart implementation:
  184 Vitest files / 4,986 tests, 68 Node files / 861 tests, sanitizer, production builds and three
  loopback smoke checks. The dedicated cart browser journey and the cart-disabled compatibility
  journeys also passed.
- The local Playwright PR gate remains a separate automatic pull-request workflow. No production
  host, credential, feature flag or external service was changed by the active work.

## Coordination rule

**No active execution queue.**

Before starting new work, query [open frontend issues](https://github.com/taoyu051818-sys/lian-mobile-web/issues?q=is%3Aissue%20state%3Aopen),
[open backend issues](https://github.com/taoyu051818-sys/lian-platform-server/issues?q=is%3Aissue%20state%3Aopen),
and [recent merged pull requests](https://github.com/taoyu051818-sys/lian-mobile-web/pulls?q=is%3Apr%20is%3Amerged).
Closed issue documents and older handoffs are reference material, not an execution queue.
