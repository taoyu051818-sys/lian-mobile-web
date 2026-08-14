# Task: GD commerce store read UI

Status: in progress; provider and BFF start gate accepted
Base: `origin/main@017201731b76fe628cc4c2d4a2dd7a67d3c9d232`
Date: 2026-08-13

## Goal

Add the first default-off LIAN commerce UI only after the GDPlatform private store provider and the
LIAN same-origin store BFF have passed independent review. The slice contains a store directory and
a store detail page. It does not add products, carts, checkout, orders, payment, or any write path.

## Start gate

Do not change `src/**`, environment declarations, tests, or build configuration until all of the
following are recorded in this task:

- the accepted GDPlatform commit SHA and its store-read OpenAPI path;
- the accepted LIAN backend commit SHA and its public `/api/commerce/stores` contract path;
- reviewer evidence that both server-side feature flags default to off;
- a real cross-repository HTTP check proving that one lowercase UUIDv4 request ID is preserved from
  LIAN through GDPlatform and back;
- an explicit statement that the public projection is anonymous and non-personalized.

Gate evidence recorded 2026-08-14:

- accepted GDPlatform provider commit:
  `6d192bb30d510487e913fe8efacc10d34d7860a6`;
- accepted GDPlatform provider contract:
  `php-server/contracts/internal-commerce-v1.openapi.yaml` in that commit;
- accepted LIAN backend BFF commit:
  `db87e99dc2c7b305448d7212f746c24b43a30264`;
- accepted LIAN public contract:
  `contracts/commerce-store-v1.openapi.json` in that commit;
- the GDPlatform global internal API and catalog-read flags, and the LIAN GDPlatform core and
  catalog-BFF flags, are all committed default-off and were independently reviewed in that state;
- a real cross-repository HTTP check returned list and detail 200 through LIAN, made exactly one
  GDPlatform request per operation, and preserved one lowercase UUIDv4 in the LIAN response header,
  LIAN body, GDPlatform request/response, and both structured logs; the missing detail projected as
  404, both successful responses were `Cache-Control: no-store` at schema `1.0.0`, and the temporary
  credential was revoked after the check;
- this public store projection is anonymous and non-personalized. It contains no LIAN session,
  NodeBB identity, actor assertion, favorites, per-user price, or account-scoped state.

Both backend slices received independent ACCEPTED reviews with no P1/P2 blocker. The remaining
real NATAPP two-network forged-header smoke is a production feature-enable gate, not a frontend
implementation blocker; all server and frontend feature flags remain false by default.

The frontend must not infer a DTO from PHP models, database rows, LAPlatform responses, task prose,
or an implementation diff. The accepted LIAN public contract is the only network source of truth.

## User-visible scope

- `#/commerce` renders the store directory.
- `#/commerce/stores/{storeId}` renders one store.
- `commerce` is a secret content view and is not added to the five-item bottom navigation.
- Profile exposes the entry only when `VITE_COMMERCE_CATALOG_VISIBLE === 'true'`.
- Because the accepted projection is anonymous, that flag-gated Profile entry is available in both
  guest and authenticated Profile states; login is not a discovery or read prerequisite.
- With that flag off, either direct hash shows a local closed state and makes zero commerce requests.
- Store IDs remain strings at the UI boundary, but this first contract accepts only canonical
  positive decimal strings in the GD `INT` primary-key range `1..2147483647`. Leading zeroes,
  signs, decimals, overflow, encoded digits, or alternate spellings are invalid.
- Real anchors preserve refresh, forward, back, copy-link, and open-in-new-tab behavior.

## Exact file boundary after the start gate opens

New runtime files:

- `src/types/commerce.ts`
- `src/api/commerce.ts`
- `src/app/commerce-route.ts`
- `src/features/commerce/index.ts`
- `src/features/commerce/CommerceView.vue`
- `src/features/commerce/useCommerceStoreRead.ts`
- `src/features/commerce/catalog/CommerceStoreListPage.vue`
- `src/features/commerce/catalog/CommerceStoreCard.vue`
- `src/features/commerce/store/CommerceStoreDetailPage.vue`
- `src/config/brand/commerce.ts`

Existing runtime files that may be edited:

- `src/app/view-types.ts`
- `src/app/deepLink.ts`
- `src/app/view-hash.ts`
- `src/app/AppViewHost.vue`
- `src/features/profile/ProfileView.vue`
- `src/config/brand/index.ts`
- `src/vite-env.d.ts`
- `.env.example`

Matching focused tests, structure guards, local Playwright coverage, test-inventory updates, task
handoff, and ownership documentation are limited to:

- `tests/commerce/commerce-route.test.ts`
- `tests/commerce/commerce-api.test.ts`
- `tests/commerce/commerce-read-state.test.ts`
- `tests/commerce/commerce.structure.test.mjs`
- `tests/phase0/phase4-deeplink-contract.test.ts`
- `tests/shell/shell-layout-modes.test.ts`
- `tests/config/pwa-routing.test.ts`
- `tests/e2e/local/commerce-store-read-journeys.spec.ts`
- `scripts/check-test-inventory.mjs`
- `docs/architecture/auto/file-ownership.md` (generated only)
- `docs/agent/handoffs/gd-commerce-store-read-ui.md`

`package.json`, Playwright configuration, dependencies, service-worker strategy, unrelated views,
and backend files are outside scope unless a reviewer first amends this task.

## Routing contract

Add a pure parser/builder module for exactly these routes:

- `#/commerce`
- `#/commerce/stores/{storeId}`

The hash is the route source of truth. `CommerceView` derives its state from the current hash and
reacts to hash and history navigation. It must not reuse the errand singleton, post-detail owner, or
an in-memory selected-store object. Parse `storeId` as a string and validate the exact canonical
decimal representation without converting it into the route source of truth. Reject empty IDs,
leading zeroes, signs, decimal points, values above `2147483647`, encoded digits or separators,
control characters, malformed percent encoding, and trailing path material.

## Network boundary

- The browser calls only the literal same-origin LIAN routes accepted by the backend contract:
  `GET /api/commerce/stores` and `GET /api/commerce/stores/{storeId}`.
- The commerce transport calls root-relative `fetch('/api/commerce/...')` directly with
  `credentials: 'same-origin'`, `cache: 'no-store'`, `redirect: 'error'`, and an `AbortSignal`.
- It must not import `src/api/http.ts`, runtime API-base configuration, or `buildApiUrl()`, and it
  must not add `x-client-id`. A hostile external `window.LIAN_API_BASE_URL` must not affect commerce.
- No commerce runtime string may contain a GD private origin, `/internal/`, a service credential, an
  LAPlatform endpoint, or a fallback to an older platform.
- The decoder accepts only the exact accepted public response keys and dense arrays.
- The accepted public schema version is exactly `1.0.0`. A success envelope has exactly `data` and
  `meta`; `meta` has exactly `requestId` and `schemaVersion`. `requestId` is a lowercase UUIDv4 and
  must also equal the `X-Request-Id` response header.
- A store has exactly `id`, `name`, `summary`, `areaLabel`, `logoAssetRef`, `ratings`, `salesCount`,
  `favoriteCount`, and `recommended`. `id` is the canonical decimal string described above;
  `name` is 1..50 characters; `summary` is 0..255; `areaLabel` is 0..100; those strings reject C0,
  DEL, and C1 control characters. `logoAssetRef` is exactly `null`. `ratings` has exactly
  `description`, `service`, and `logistics`, each encoded as `0` or a fixed two-decimal string from
  `1.00` through `5.00`. Both counts are safe integers from 0 through `9007199254740991`, and
  `recommended` is boolean.
- List data has exactly `items` and `page`. `items` is a dense array of at most 50 stores. `page`
  has exactly `page`, `pageSize`, `total`, and `hasMore`; page is 1..100000, pageSize is 1..50,
  total is a non-negative safe integer, and `hasMore === (page * pageSize < total)`. The first UI
  slice sends no query, so the response must report page 1 and pageSize 20; item count, total, and
  offset invariants from the accepted OpenAPI must also hold. Detail data has exactly `store`, and
  its ID must equal the requested route ID.
- The decoder rejects unknown, missing, mistyped, sparse, or invariant-breaking data. HTTP 404 on
  detail is presented as not-found; 429 is retryable rate limiting; 400/428/502/503/504 and network
  or malformed responses are safe error states. Error prose and request IDs are not rendered as
  trusted content or used to change routing.
- IDs stay string-valued and must satisfy the same canonical `1..2147483647` contract in routes and
  response DTOs. Unknown, missing, or mistyped fields fail closed as a malformed response under the
  accepted LIAN contract.

## Asset boundary

The first provider/BFF slice has no accepted browser asset resolver and its contract requires
`logoAssetRef` to be exactly `null`. A valid null value renders a local CSS placeholder and triggers
no image request; a non-null value is a malformed response, not a URL fallback. Never reveal a
GDPlatform public or private origin. A future asset slice must first define a same-origin resolver
and prove that its references are immutable or versioned before using the current 30-day image
cache.

## Read-state ownership

The view owns explicit `closed`, `idle`, `loading`, `ready`, `empty`, `not-found`, and `error` states.
Every route change, refresh, retry, and unmount aborts the previous transport and advances a request
generation. A late response can settle only the generation and route that created it. This task may
omit a global account epoch only while the accepted BFF response is anonymous and non-personalized;
any user-specific projection reopens that prerequisite.

## UI boundary

Reuse the existing page surface, empty/error states, buttons, type tokens, and spacing tokens. Use
ordinary warm-white cards rather than nested glass panels. Titles are at most two lines, summaries
at most three, interactive targets at least 44 px, and state is not conveyed by color alone. Support
reduced motion and safe interpolation; do not render upstream HTML.

## Tests and acceptance

Before review, add focused coverage for:

- parse/build round trips, malformed hashes, canonical ID boundaries (`1`, `2147483647`), leading
  zeroes, overflow, encoded digits, refresh, forward, and back;
- feature flag off: hidden Profile entry, closed direct link, and zero commerce requests;
- same-origin literal routes and a structure guard against GD/LA/internal origins or fallbacks;
- exact DTO keys, dense arrays, UUIDv4/schema validation, safe integers, bounds, and malformed data;
- abort and generation ownership across directory, detail, retry, and back navigation;
- 404, 429, network, timeout, empty, malformed, and closed presentations;
- asset-reference placeholders making no image request;
- cold refresh on both accepted routes and a local directory-to-detail-to-back journey;
- JSON requests remaining outside service-worker/offline caching.

Run the current repository commands rather than inventing aliases:

```bash
npm run check
npm run build
npm run test:unit
npm run test:structure
VITE_COMMERCE_CATALOG_VISIBLE=true npm run test:e2e:local -- \
  tests/e2e/local/commerce-store-read-journeys.spec.ts
npm run verify
git diff --check
```

The local E2E command intentionally enables only its Vite process; default-off behavior remains a
unit/structure assertion. Local Playwright blocks service workers, so JSON no-cache behavior is
verified in `tests/config/pwa-routing.test.ts`, not inferred from the browser journey.

The task remains blocked until the start gate is filled with accepted commit SHAs. Implementation is
not accepted until an independent reviewer records the result in a matching handoff.

## Non-goals

- product lists or product detail;
- search or categories unless the accepted BFF contract explicitly includes them;
- SKU choice, stock quantities, favorites, cart, checkout, orders, payment, or refunds;
- SSR clean paths, a new router framework, an asset proxy, or service-worker redesign;
- LAPlatform compatibility or any direct GDPlatform browser integration.
