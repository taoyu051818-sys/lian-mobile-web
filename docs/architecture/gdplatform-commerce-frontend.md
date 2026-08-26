# GDPlatform commerce frontend boundary

Status: RC1 R1 implementation candidate
Date: 2026-08-24

## Decision

LIAN is the user experience and same-origin BFF client. GDPlatform is the commercial system of
record. NodeBB remains the community forum system. LAPlatform is retired from the LIAN frontend:
the browser has no LA client, component, request state, route, fallback or session-derived lane.

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

The request-ownership and auth-epoch protections learned from the former administrator merchant UI
remain in the neutral admin and commerce state owners. No LA-specific name, path, DTO or transport
remains in frontend runtime source.

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

1. RC1 R1 removes the LA administrator browser journey while preserving the legacy LIAN ops-token
   reports, verification, auth-link and audit contract.
2. Add store and product resource routing and read-only journeys.
3. Add account-scoped cart, quote and idempotent order creation without real-money payment.
4. Add commerce-order list/detail separately from existing errand order pages.
5. Add payment and refunds only after backend AppID/openid and reconciliation gates pass.
6. Withdraw the default-off LIAN backend LA route only in the separately reviewed R2 slice after an
   accepted R1 release is observed making zero LA calls.

The backend compatibility route and both default-false flags remain only as a bounded R1 rollback
control. The frontend cannot enable them and never falls back to LA when GD is disabled or fails.

Every API slice requires strict DTO tests, auth-switch and stale-response tests, malformed-response
failure, deep-link refresh, no-direct-GD-origin checks and a backend contract reference.
