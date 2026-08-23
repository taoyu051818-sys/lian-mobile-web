# Handoff: Issue #1097 GD commerce Actor and Cart UI

Status: independently reviewed; accepted for integration; default off; not deployed

## Current source check

- Original implementation base: `643acae6a091d666e7ea6c206555690f9e46812e`; the accepted change was
  rebased onto frontend CI baseline `5db9c0f9b1be9c17a52027482fbad147e09277a4` on
  `codex/commerce-cart-mvp` before integration.
- Backend source checked: `5282945987604d7e12b4c60856b5318f6a430572` on
  `codex/prelaunch-backend-baseline`, including the current Actor/Cart OpenAPI documents and BFF
  handoffs.
- `README.md`, `package.json`, `docs/agent/00_AGENT_RULES.md`, `docs/agent/README.md`, the prior
  commerce store/product task and handoff, and `docs/architecture/gdplatform-commerce-frontend.md`
  were checked before implementation.
- The three dated override files named by the handoff template are absent in this checkout; current
  code, OpenAPI contracts, task docs, and handoffs were used instead.
- This handoff advances the prior product-read phase only for Actor initialization and cart MVP.
  Its earlier statement that SKU selection/cart were outside that phase was true for that earlier phase
  but is no longer the current implementation boundary.

## Summary

- Added a third exact default-off commerce gate and a cold-refreshable `#/commerce/cart` route.
- Added strict Actor initialize and cart read/set/delete transports, including exact response/error
  decoding, fresh secure UUIDv4 idempotency for every write attempt, and mutation-target response
  correlation.
- Added deterministic available-SKU selection, an authenticated add-to-cart state, and cart loading,
  empty, ready, unavailable-item, login-required, error, retry, absolute-quantity, and delete UI.
- Added a bounded absolute repair action that moves an unavailable legacy quantity of `100..999`
  back to `99`; other unavailable lines remain removable without inventing availability.
- Added an instance-scoped cart owner with one AbortController/timeout/generation boundary. Only an
  exact correlated `COMMERCE_ACTOR_INITIALIZATION_REQUIRED` PUT response can run Actor initialization,
  followed by one retry of the original set.
- Reworked commerce fixture product/SKU identifiers into globally disjoint ranges and made product
  detail reverse the product identifier back to the owning store.

## Files changed

- `.env.example`, `src/vite-env.d.ts`: declare `VITE_COMMERCE_CART_VISIBLE=false`.
- `src/types/commerce.ts`, `src/api/commerce.ts`: Actor/cart DTOs, strict decoders, dedicated literal
  same-origin transports, exact error projection, and authoritative mutation correlation.
- `src/app/commerce-route.ts`, `src/features/commerce/CommerceView.vue`,
  `src/features/commerce/useCommerceStoreRead.ts`: exact cart route and view dispatch without making
  the anonymous store owner issue cart requests.
- `src/features/commerce/useCommerceCart.ts`: instance-local operation ownership, timeout, retry,
  Actor initialization, account-loss clearing, and authoritative cart adoption.
- `src/features/commerce/product/CommerceProductCartControls.vue`,
  `src/features/commerce/product/CommerceProductDetailPage.vue`: deterministic SKU choice and
  truthful add state while preserving the previous read-only rendering when the cart flag is off.
- `src/features/commerce/cart/CommerceCartPage.vue`, `src/config/brand/commerce.ts`,
  `src/features/commerce/index.ts`: cart UI, owned copy, and feature exports.
- `src/platform/ui-fixtures/data/commerce.ts`: global product/SKU identity and store ownership fix.
- Existing commerce test files plus `tests/e2e/local/commerce-cart-journeys.spec.ts`: API, decoder,
  owner, route, UI, structure, fixture, and browser coverage without changing test inventory counts.
- `docs/agent/tasks/issue-1097-gd-commerce-cart-ui.md` and this handoff: implementation status and
  verification record. `docs/CURRENT_STATUS.md` was intentionally left untouched for queue-owner
  coordination.

## Repository and ownership notes

- Repository touched: `lian-mobile-commerce` / package name `lian-mobile-web`.
- Owned area touched: Vue/Vite commerce runtime, commerce fixtures, focused frontend tests, and
  frontend agent docs.
- No backend, dependency, generic HTTP adapter, auth store, SSR, PWA, deployment, or production flag
  file changed.

## API or contract changed

No backend contract changed. The frontend now consumes the already accepted contracts:

- `PUT /api/commerce/actors/me` with exact `{}` JSON bytes.
- `GET /api/commerce/cart` without write headers or a request body.
- `PUT /api/commerce/cart/items/{skuId}` with exact absolute-quantity JSON.
- `DELETE /api/commerce/cart/items/{skuId}` with exact `{}` JSON bytes.

All paths are literal root-relative LIAN paths with `credentials: "same-origin"`, `cache:
"no-store"`, redirect rejection, and the owner signal. Write code sets only the headers JavaScript
owns: exact JSON content type, `X-LIAN-CSRF: 1`, and a fresh lowercase UUIDv4 idempotency key.
`Origin` and `Sec-Fetch-Site` remain forbidden browser-owned headers; the local browser journey
verified that the real same-origin server received both correctly.

Success adoption requires status 200, JSON, exact no-store caching, correlated lowercase UUIDv4
request IDs, schema `1.0.0`, exact object keys, and all Actor/cart cross-field invariants. PUT also
requires the returned item to match the requested SKU and absolute quantity; DELETE requires that
SKU to be absent. Enabled errors require their exact status/code/message/header/body contract, and
cart-read rejects write-only errors even if their envelope is otherwise valid.

## Data or state changed

No backend or persistent browser data changed. Cart DTOs live only inside each mounted owner and are
cleared on unmount or a login-required response. The offline commerce fixture now reserves 18
product IDs per store and four SKU IDs per product, producing stable globally unique IDs while
preserving store ownership.

## How to verify

```bash
npm run check
npm run build
VITE_COMMERCE_CATALOG_VISIBLE=false \
  VITE_COMMERCE_PRODUCT_VISIBLE=false \
  VITE_COMMERCE_CART_VISIBLE=false npm run verify
VITE_COMMERCE_CATALOG_VISIBLE=true \
  VITE_COMMERCE_PRODUCT_VISIBLE=true \
  VITE_COMMERCE_CART_VISIBLE=true \
  npx playwright test tests/e2e/local/commerce-cart-journeys.spec.ts \
  --config=playwright.local.config.ts
VITE_COMMERCE_CATALOG_VISIBLE=true \
  VITE_COMMERCE_PRODUCT_VISIBLE=true \
  VITE_COMMERCE_CART_VISIBLE=false \
  npx playwright test tests/e2e/local/commerce-product-read-journeys.spec.ts \
  --config=playwright.local.config.ts
git diff --check
```

## Test result

- `npm run check`: passed; only pre-existing warning-only asset, stale-doc, and ESLint findings were
  reported. The commerce product detail is below the repository's 300-line warning threshold.
- `npm run build`: passed, 714 modules transformed.
- Full `npm run verify`: passed before rebase with 184/184 Vitest files and 4,985/4,985 assertions,
  68/68 Node files and 861/861 assertions, sanitizer checks, two builds, and 3/3 preview smoke
  checks. The accepted CI-baseline rebase adds one Vercel configuration assertion, bringing the
  expected Vitest total to 4,986 without changing commerce behavior.
- Cart Playwright journey: 1/1 passed. It covered available-default selection, exact 409-triggered
  Actor initialization, one set retry, cart read, absolute quantity set, delete, cold refresh,
  cookies, browser-generated Origin/Sec-Fetch-Site, CSRF, exact bodies, and five distinct UUIDv4
  keys.
- Product compatibility journeys with cart disabled: 5/5 passed.
- `git diff --check`: passed.

## Known risks

- All three frontend flags and all corresponding backend flags remain deployment gates. Local green
  tests do not authorize enabling or deployment.
- Account loss is observed through the accepted 401 response because this phase intentionally does
  not couple commerce to the global auth store.
- The shared offline fixture runtime does not emulate account-scoped Actor/cart mutation state; the
  dedicated local Playwright fixture owns that state for this phase.

## Not done

- No quote, checkout, order, payment, coupon, address, fulfillment, favorite, stock promise, or
  optimistic/offline mutation queue.
- No backend/provider change and no production or staging mutation.
- No production/staging mutation, flag enablement, or deployment.

## Acceptance note

Independent review found no remaining P0–P3 actionable issue after the legacy-quantity repair was
added. The review repeated the focused tests, structure guard, local browser journey, build, diff,
allowlist, and secret checks before accepting the implementation for integration.

## Next suggested task

- Rebase onto the accepted CI baseline, then run the default-off local cross-repository Actor/Cart
  integration before considering any flag enablement.
