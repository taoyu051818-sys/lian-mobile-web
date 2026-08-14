# Task: GD commerce product read UI

Status: approved; implementation not started
Base: `4b337ce00087c00462ff4a23c4a5eff91d2a0589`
Date: 2026-08-14

## Current source check

- Current frontend head is the independently accepted store-read UI commit above on
  `agent/gd-commerce-ui`; the worktree was clean when this task was frozen.
- `origin/main` remains `017201731b76fe628cc4c2d4a2dd7a67d3c9d232`.
- Recent merged pull requests were checked on 2026-08-14; PR `#1092` is still the latest merged
  frontend PR and does not implement this GD commerce product surface.
- Open frontend issues were checked on 2026-08-14; they concern the separate Publish/Profile
  audit queue and do not supersede this task.
- Root `README.md`, current `package.json`, `docs/CURRENT_STATUS.md`, the agent rules/index, the
  accepted commerce store task/handoff/runtime/tests, test inventory, PWA route test and current
  commerce ownership were checked.

The user's active long-task instruction authorizes this additive phase. Historical tasks and
handoffs are context only; they are not being treated as an execution queue.

## Goal

Add a default-off, anonymous product list section to the accepted commerce store detail and a
strict product detail page, consuming only the accepted LIAN same-origin product contract. This
slice remains discovery-only: it adds no SKU selection, cart, quote, checkout, order or payment.

## Start gate

The runtime gate is satisfied with the following recorded evidence:

- accepted GDPlatform product provider:
  `eb781716d2fe3cdbedd849dee77fa3fa9ae02edb`;
- accepted LIAN product BFF:
  `52d94161028903c2fa4ca756b03828b4d0fd2440`;
- sole frontend network source of truth:
  `contracts/commerce-product-v1.openapi.json` in that LIAN commit, contract ID
  `lian.commerce.product.v1`, schema version `1.0.0`;
- both backend worktrees were clean after their phase commits, and both product tasks/handoffs were
  independently accepted with no P1/P2/P3 blocker;
- GD global/store/product and LIAN global/store/product flags are all committed default-off;
- a real GDPlatform-to-LIAN HTTP smoke passed provider preflight, returned list and detail 200,
  made exactly one physical GD request per public operation, preserved one fresh lowercase UUIDv4
  across both services, returned `Cache-Control: no-store` with no browser CORS, did not forward
  browser cookie/origin/client ID/request ID, and revoked the temporary credential;
- the public projection is anonymous and non-personalized. It contains no LIAN/NodeBB account,
  session, actor, favorite, personalized price or user-scoped state, so this read-only slice does
  not need an account epoch.

This evidence unlocks local implementation only. It does not authorize deployment or any feature
flag change.

## User-visible and routing contract

- Keep `#/commerce` as the store directory.
- Keep `#/commerce/stores/{storeId}` as the store detail and, only after that store detail reaches
  `ready`, mount a product-list section beneath it.
- Add exactly one new hash route: `#/commerce/products/{productId}`.
- Do not add a separate product-list hash, selected-product singleton, route query, fragment or
  in-memory navigation source of truth.
- Product cards and return navigation are real anchors. A product-detail success uses the strict
  response `storeId` to build a return-to-store anchor; before success, its safe return target is
  the store directory.
- Store, product and SKU IDs remain strings. The current contract accepts only the canonical
  decimal representation `1..2147483647`; leading zeroes, signs, decimals, overflow, encoded
  digits/separators, controls, malformed escapes and trailing route material are invalid.

The raw hash remains authoritative. `CommerceView` must continue to deduplicate paired
`hashchange`/`popstate` notifications for one raw URL and must never reuse the errand/detail
singletons.

## Feature flags and compatibility

- Add `VITE_COMMERCE_PRODUCT_VISIBLE=false`.
- Effective product visibility is true only when both
  `VITE_COMMERCE_CATALOG_VISIBLE === "true"` and
  `VITE_COMMERCE_PRODUCT_VISIBLE === "true"`.
- With the product flag off, the accepted store detail DOM, copy, request count and interaction
  remain unchanged; the product section is not mounted and performs zero product requests.
- A direct product hash with either frontend flag off shows a local closed state and performs zero
  commerce requests.
- Profile discovery, the five-item bottom bar, existing store hashes and existing store-only API
  behavior remain unchanged.
- The frontend flag is only an exposure gate. The LIAN and GD server flags remain authoritative.

## Network boundary

The browser may call only these literal same-origin routes:

- `GET /api/commerce/stores/{storeId}/products`
- `GET /api/commerce/products/{productId}`

This first product UI consumes only the default page `1/20` and sends no query. Every request uses:

```ts
{
  method: "GET",
  credentials: "same-origin",
  cache: "no-store",
  redirect: "error",
  headers: { Accept: "application/json" },
  signal
}
```

The product transport extends the existing direct root-relative commerce transport. It must not
import `src/api/http.ts`, runtime API-base configuration or `buildApiUrl()`, and it must not add
`x-client-id`. A hostile `window.LIAN_API_BASE_URL` must not affect commerce. Product runtime code
must contain no GD/LA origin, `/internal/`, service credential, automatic retry, response cache,
stale/offline replay, generic proxy or provider/network compatibility fallback. The required
`cache: "no-store"`, explicit user-triggered retry and local CSS/text display fallbacks are not
prohibited by this transport rule.

## Success DTO and decoder

The decoder adopts a 200 response only after validating `application/json`, exact
`Cache-Control: no-store`, a lowercase UUIDv4 `X-Request-Id` equal to body
`meta.requestId`, and `meta.schemaVersion === "1.0.0"`.

Product summary exact keys are:

`id,storeId,name,subtitle,coverAssetRef,priceRange,availability,rating,salesCount,recommended`

Product detail contains those keys plus `skus`. Nested exact keys are:

- price range: `currency,minAmountMinor,maxAmountMinor`;
- SKU: `id,name,price,availability,default`;
- SKU price: `currency,amountMinor`;
- list data: `items,page`;
- page: `page,pageSize,total,hasMore`;
- detail data: `product`;
- meta: `requestId,schemaVersion`.

Rules:

- all IDs use the canonical string contract above;
- name is 1..128, subtitle 0..150 and SKU name 0..20 Unicode code points;
- product text rejects C0, DEL, C1 and HTML-tag shapes matching `/<[^>]*>/`;
- `coverAssetRef` is required literal `null`; no path/URL is accepted;
- product availability is literal `available`; SKU availability is `available|unavailable`;
- rating is `0` or `1.00..5.00`; sales count is a non-negative safe integer;
- recommended/default are strict booleans;
- currency is literal `CNY`; amounts are integer minor units `1..9999999999` and range min is not
  greater than max;
- detail has a dense array of 1..100 SKUs, unique canonical SKU IDs in numeric ascending order,
  exactly one default and at least one available SKU; the default may be unavailable;
- detail range exactly equals the min/max price of available SKUs only;
- list items all carry the requested `storeId`; detail product ID equals the requested route ID;
- list page is exactly requested defaults 1/20, items are at most 20, total/offset/hasMore are
  internally consistent, and an empty page is valid.

Unknown, missing, sparse, mistyped or invariant-breaking data is malformed. Server error bodies,
request IDs and internal prose are never rendered or used to alter routing.

## Error and state semantics

- list parent-store 404 and product-detail 404 map to local `not-found` states;
- 429 maps to retryable rate limiting; 504 maps to timeout;
- 400/428/499/502/503, network failures and all other non-200 statuses map to safe generic error;
- malformed success data maps to `malformed` error;
- only 200 with an empty product list maps to `empty`.

Add a separate `useCommerceProductRead` owner. The store product section and product detail each
create their own instance and own one exact target:

- `{name:"store-products",storeId}`; or
- `{name:"product",productId}`.

Every load, retry, ID change and dispose must advance a generation, abort the prior controller,
clear the prior 12-second timeout and DTO, and allow settlement only when both generation and exact
target still match. Unmount permanently stales late work. The existing store reader remains the
store owner; it is only narrowed so a product route cannot be mistaken for a store route.

The store product section mounts only after the store detail is `ready`, so an absent or failed
store does not also consume a product request or the shared anonymous quota.

## UI and asset boundary

- Product cards use real anchors, at most two title lines and three subtitle lines, and a minimum
  44 px interactive target.
- The product owner retains the validated page object. When `hasMore=true`, the section shows a
  local, non-interactive notice that the current view contains only part of the catalog; it must
  not claim that exactly 20 items are visible, imply that the page is complete, or offer a fake
  load-more action. This also applies to a contract-valid short or empty page with `hasMore=true`.
- Product detail displays read-only reference price, rating, sales and a bounded SKU list. SKU
  availability is written in text, not color alone; an empty SKU name uses a local fallback.
- Price display is built from the integer-minor-unit decimal string (pad/slice) and never by
  dividing through a floating-point major-unit representation.
- Copy states clearly that displayed price/availability is discovery information, not a quote,
  reservation or exact inventory promise.
- `coverAssetRef === null` renders a local CSS placeholder. Product runtime creates no `<img>`,
  `<picture>`, remote background or image request.
- Reuse existing state components, tokens and safe Vue text interpolation. Do not render upstream
  HTML.

## Exact file boundary

New runtime files:

- `src/features/commerce/useCommerceProductRead.ts`
- `src/features/commerce/product/CommerceStoreProductsSection.vue`
- `src/features/commerce/product/CommerceProductCard.vue`
- `src/features/commerce/product/CommerceProductDetailPage.vue`
- `src/features/commerce/product/formatCommercePrice.ts`

Existing runtime files allowed to change:

- `.env.example`
- `src/vite-env.d.ts`
- `src/types/commerce.ts`
- `src/api/commerce.ts`
- `src/app/commerce-route.ts`
- `src/features/commerce/CommerceView.vue`
- `src/features/commerce/useCommerceStoreRead.ts`
- `src/features/commerce/store/CommerceStoreDetailPage.vue`
- `src/config/brand/commerce.ts`

Tests and documentation allowed to change/add:

- `tests/commerce/commerce-product-api.test.ts`
- `tests/commerce/commerce-product-read-state.test.ts`
- `tests/commerce/commerce-route.test.ts`
- `tests/commerce/commerce.structure.test.mjs`
- `tests/phase0/phase4-deeplink-contract.test.ts`
- `tests/config/pwa-routing.test.ts`
- `tests/e2e/local/commerce-store-read-journeys.spec.ts`
- `tests/e2e/local/commerce-product-read-journeys.spec.ts`
- `scripts/check-test-inventory.mjs`
- `docs/architecture/auto/file-ownership.md` (generated only)
- `docs/agent/tasks/gd-commerce-product-read-ui.md`
- `docs/agent/handoffs/gd-commerce-product-read-ui.md`

Adding the two named Vitest files intentionally changes the inventory from 178/68 to 180/68.

`ProfileView.vue`, `AppViewHost.vue`, `view-types.ts`, `deepLink.ts`, PWA/Vite configuration,
Playwright configuration, `package.json`, dependencies, backend files and every file outside this
exact list are forbidden unless a reviewer amends this task first.

## Tests and acceptance

Focused coverage must include:

- product hash parse/build, canonical min/max IDs and every non-canonical spelling;
- both frontend flags and all closed combinations, with zero product requests;
- store 200 before product-list request; failed/missing store causes zero product work;
- literal same-origin routes/options and hostile runtime API-base isolation;
- every exact envelope/DTO/page/price/SKU key and semantic invariant;
- integer-string price formatting at cent, whole-unit and maximum bounds;
- `hasMore=true` with full, short and empty item arrays producing the bounded partial-catalog
  notice without a second request or fake action;
- abort, timeout, retry, ID/route switch, back/forward, unmount and late-settlement ownership;
- list/detail 404, 429, 504, network, malformed and empty states;
- product flag off preserving the accepted store-only page and request count;
- CSS placeholders with zero image requests and no upstream HTML rendering;
- product API paths staying outside PWA navigation/image caches;
- local store-to-product-to-store real-anchor journey and product-detail cold refresh.

Validation commands:

```bash
npm run check
npm run build
npm run test:unit
npm run test:structure

VITE_COMMERCE_CATALOG_VISIBLE=true \
VITE_COMMERCE_PRODUCT_VISIBLE=false \
npm run test:e2e:local -- \
  tests/e2e/local/commerce-store-read-journeys.spec.ts

VITE_COMMERCE_CATALOG_VISIBLE=true \
VITE_COMMERCE_PRODUCT_VISIBLE=true \
npm run test:e2e:local -- tests/e2e/local/commerce-product-read-journeys.spec.ts

npm run verify
git diff --check
```

The local Playwright runner blocks service workers, so JSON no-cache is verified by the PWA matcher
test. The handoff must also record a normal preview built with both commerce flags explicitly false
and prove that direct store/product hashes show the local closed state with zero commerce requests.

## Release gates and rollback

- Backend disabled and real resource-not-found are both public 404 by design; the UI must not parse
  error prose to distinguish them. Deploy and smoke the accepted backends before building with the
  product frontend flag enabled.
- Keep the frontend product flag false until the pinned GD/LIAN commits are deployed, provider
  preflight is clean, private-listener/capability/correlation smoke passes, and the inherited real
  NATAPP forged-header/shared-edge-limiter gates are closed.
- Rollback first restores `VITE_COMMERCE_PRODUCT_VISIBLE=false`; store discovery may stay enabled.
  If necessary, then close the LIAN product flag and the GD product flag in that order. This slice
  writes no business or user data.

## Non-goals

- pagination, load-more, search, categories, promotions or assets;
- SKU selection, exact stock, favorites, cart, quote, checkout, order, payment or refund;
- authenticated/personalized commerce or account-scoped state;
- SSR clean routes, a router framework, service-worker redesign or API-base changes;
- any direct GD/LA/NodeBB browser integration, compatibility alias or fallback.
