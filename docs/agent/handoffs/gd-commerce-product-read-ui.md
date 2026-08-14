# Handoff: GD commerce product read UI

Status: implementation complete; independently accepted; not deployed

## Summary

The default-off LIAN commerce UI now consumes the accepted anonymous product contract from
GDPlatform provider commit `eb781716d2fe3cdbedd849dee77fa3fa9ae02edb` through LIAN BFF commit
`52d94161028903c2fa4ca756b03828b4d0fd2440`. It adds a product section beneath a successfully
loaded store and a cold-refreshable product detail at `#/commerce/products/{productId}`. The
browser's sole source of truth is LIAN's same-origin
`contracts/commerce-product-v1.openapi.json`, version `1.0.0`.

## Product behavior

- Products remain behind the existing catalog flag and the new exact
  `VITE_COMMERCE_PRODUCT_VISIBLE === "true"` flag. Both default to false.
- A store product list mounts only after that store detail reaches `ready`; store failure and store
  not-found perform zero product work.
- Product cards and return navigation are real anchors. Product detail cold-starts from its URL and
  uses only its validated `storeId` to build the return-to-store link.
- The first slice intentionally shows only the default page 1/20. A truthful, non-interactive
  partial-catalog notice covers full, short and empty `hasMore=true` pages without another request
  or a fake load-more action.
- Product art remains a local CSS placeholder. Product runtime emits no image request and presents
  SKU availability in text.
- Prices are formatted from validated integer minor units without a floating-point major-unit
  conversion. The UI explicitly states that price and availability are discovery information, not
  a quote, inventory reservation or exact stock promise.
- SKU selection, cart, quote, checkout, order, payment, favorite state and all writes remain outside
  this phase.

## Architecture and security

- The raw hash parser accepts only canonical decimal store/product IDs in `1..2147483647`; it does
  not decode, trim or coerce aliases.
- Product calls are literal root-relative GETs to LIAN only, with same-origin credentials,
  `cache: no-store`, redirect rejection and AbortSignal. Runtime cannot use the configurable API
  base, `x-client-id`, GD/LA/internal origins or a compatibility fallback.
- Success adoption requires HTTP 200, JSON, exact `Cache-Control: no-store`, one lowercase UUIDv4
  shared by header/body, schema `1.0.0`, exact nested keys and all text, ID, page, amount, SKU,
  default, availability and price-range invariants.
- Each product list/detail component owns a separate generation and AbortController. Retry, target
  change, timeout and unmount clear old DTOs and permanently stale late settlement.
- The public projection stays anonymous and non-personalized, so this read-only slice does not add
  an account epoch.

## Files changed

All runtime, test and documentation files are inside the exact allowlist in
`docs/agent/tasks/gd-commerce-product-read-ui.md`. No backend, dependency, Profile, bottom-tab,
Vite/PWA configuration or generic HTTP-adapter file changed.

## Validation

- focused commerce Vitest: 190/190 passing;
- test inventory: 180 Vitest files and 68 Node test files;
- commerce structure: 13/13 passing;
- store compatibility E2E with catalog=true/product=false: 4/4 passing;
- product E2E with both frontend flags true: 5/5 passing, covering store-before-products ordering,
  real anchors, cold refresh, strict safe states, partial-page boundaries, hostile API-base
  isolation and zero image requests;
- production build: 681 modules transformed, PWA precache 75 entries;
- full `npm run verify` with both frontend commerce flags explicitly false: 4,868/4,868 Vitest
  assertions, 858/858 Node structure assertions, HTML sanitizer, two production builds, PWA
  generation and 3/3 frontend smoke checks passing;
- the resulting normal preview rendered the local closed state at both
  `#/commerce/stores/1` and `#/commerce/products/10`, with zero `/api/commerce` requests;
- formatting, ESLint, type checking and `git diff --check`: passing.

## Release gates and rollback

- This handoff authorizes no deployment or flag change. The GD provider and LIAN BFF must be
  deployed and smoked before a frontend build enables product discovery.
- GD product preflight, private listener/capability/correlation checks, the inherited real NATAPP
  forged-header test and a shared multi-instance edge limiter remain production gates.
- Rollback first restores `VITE_COMMERCE_PRODUCT_VISIBLE=false`, then closes the LIAN and GD product
  flags if needed. Store discovery may remain enabled. This phase writes no business or user data.

## Acceptance

Independent read-only review accepted the frozen implementation with no remaining P0/P1/P2/P3
issue. The review covered the timeout/late-settlement boundary, both disclaimers, exact allowlist,
strict contracts, serial E2E, full validation and default-off zero-request preview. This acceptance
authorizes the phase commit only; it does not authorize deployment or enabling any flag.
