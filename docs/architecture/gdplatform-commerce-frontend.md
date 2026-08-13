# GDPlatform commerce frontend boundary

Status: accepted implementation baseline
Date: 2026-08-13

## Decision

LIAN is the user experience and same-origin BFF client. GDPlatform is the commercial system of
record. NodeBB remains the community content system. LAPlatform will be retired after its bounded
read compatibility window.

The frontend must not merge these concepts:

- commerce orders and LIAN campus errand orders;
- CNY payments/refunds and LIAN points/honor;
- GD merchant/store status and LIAN campus merchant eligibility;
- GD product/inventory state and NodeBB/LIAN post state.

## Network boundary

The browser or mini-program calls only LIAN `/api/*` routes with the existing LIAN session. It must
never receive or persist a GDPlatform service token, actor assertion, internal origin, payment
credential or verified openid assertion. Pricing, discounts, inventory and payable totals are always
server-calculated.

The existing LAPlatform administrator merchant UI provides reusable request-ownership, abort,
auth-epoch, strict decoding and finite-state patterns. Its LA-specific name, path and DTO are not the
target architecture.

## Feature layout

New commerce journeys belong in independent feature modules:

```text
src/features/commerce/
  catalog/
  store/
  product/
  cart/
  checkout/
  orders/
  refunds/
  post-link/
```

Commerce resource detail must use refreshable parameterized routes. Do not copy the existing errand
module-level singleton navigation pattern. Cart and order state is account-scoped and must be
invalidated on auth epoch changes; late responses from an old account cannot update the new owner.

## Product composition

- Merchant center composes LIAN campus eligibility with GD merchant/store operational state.
- Profile presents separate entries for commerce orders and campus errand orders.
- Merchant posts and commercial product-backed group-buy posts retain NodeBB discussions and store
  stable GD resource references. Campus coordination groups without a commercial product stay in
  LIAN/NodeBB and are not migrated into GDPlatform.
- Post display snapshots are non-authoritative; price, inventory and available actions come from the
  current LIAN commerce BFF response.
- A GD order may link to a LIAN errand, but both keep separate IDs, status machines and failure copy.

## Delivery order

1. Replace the LA administrator read with a neutral commerce route while preserving the accepted
   decoder and request ownership protections.
2. Add store and product resource routing and read-only journeys.
3. Add account-scoped cart, quote and idempotent order creation without real-money payment.
4. Add commerce-order list/detail separately from existing errand order pages.
5. Add payment and refunds only after backend AppID/openid and reconciliation gates pass.
6. Remove LA-specific UI, types and compatibility paths after zero old traffic is verified.

The old LA compatibility path is default-off. It may be enabled only when the backend records a
named owner, exact removal date and per-route traffic telemetry; frontend fallback must not silently
keep it alive or extend the deadline.

Every API slice requires strict DTO tests, auth-switch and stale-response tests, malformed-response
failure, deep-link refresh, no-direct-GD-origin checks and a backend contract reference.
