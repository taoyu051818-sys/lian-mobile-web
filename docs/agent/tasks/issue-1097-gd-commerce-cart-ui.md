# Issue #1097 — GD commerce Actor and Cart UI

Status: independently reviewed; accepted for integration
Date: 2026-08-23

## Goal

Complete the accepted prelaunch commerce discovery flow with authenticated Actor initialization
and a cart MVP, while preserving the frontend's strict same-origin contract and request ownership
style.

## User flow

`product detail -> select available SKU -> initialize Actor when needed -> add to cart -> open cart
-> read -> set absolute quantity -> delete -> refresh with server state`

Actor initialization is an internal page state, not a standalone user-facing page.

## Allowed files

- `.env.example`
- `src/vite-env.d.ts`
- `src/types/commerce.ts`
- `src/api/commerce.ts`
- `src/app/commerce-route.ts`
- `src/config/brand/commerce.ts`
- `src/features/commerce/**`
- `src/platform/ui-fixtures/data/commerce.ts`
- commerce-focused files under `tests/commerce/**`
- commerce-focused files under `tests/e2e/local/**`
- `docs/agent/tasks/issue-1097-gd-commerce-cart-ui.md`
- `docs/agent/handoffs/issue-1097-gd-commerce-cart-ui.md`
- `docs/CURRENT_STATUS.md`

## Contract and security boundaries

- Browser calls remain literal same-origin `/api/commerce/**` requests with same-origin cookies.
- Actor/cart writes rely on the browser for exact same-origin `Origin` and
  `Sec-Fetch-Site: same-origin`; application code sends `X-LIAN-CSRF: 1`, exact JSON content type,
  and a fresh lowercase UUIDv4 idempotency key.
- Do not use the configurable generic API base or add `x-client-id`.
- Decode the accepted Actor/Cart v1 response and error contracts before adopting state.
- Each mounted owner controls its AbortController, timeout, generation, exact target, and disposal.
- Cart state is instance-scoped and cleared on unmount/account loss; no new global singleton.

## Non-goals

- No quote, checkout, order, payment, coupon, address, fulfillment, favorite, or optimistic offline
  queue.
- No backend, GD provider, generic HTTP adapter, auth store, PWA, SSR, or dependency change.
- No deployment or production flag change.
- No broad frontend refactor.

## Acceptance

- [x] Offline fixture product and SKU IDs are globally unique and preserve store ownership.
- [x] Product detail supports deterministic available-SKU selection and truthful add-to-cart state.
- [x] Anonymous writes show a login-required state and never synthesize cart success.
- [x] Actor initialization is attempted only for the accepted initialization condition and is
      retried at most once before the original cart write.
- [x] Cart renders loading, empty, ready, unavailable-item, error, and retry states.
- [x] Absolute quantity set and delete adopt only validated authoritative responses.
- [x] Focused API/state/UI tests, commerce structure tests, one local Playwright journey,
      `npm run check`, `npm run build`, full `npm run verify`, and `git diff --check` pass.

## Rollback

Keep `VITE_COMMERCE_CART_VISIBLE=false` and revert the scoped route, API, UI, test, task, and
handoff changes. The frontend writes no migration or independent business state.
