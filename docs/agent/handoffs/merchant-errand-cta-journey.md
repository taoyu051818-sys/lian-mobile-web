# Handoff: Merchant detail → errand-order CTA journey (issue #693)

Date: 2026-05-20
Branch: `codex/issue-693-merchant-errand-cta`
Issue: [#693 — Merchant detail needs explicit errand CTA and verified merchant fixture](https://github.com/taoyu051818-sys/lian-mobile-web/issues/693)

## Summary

The frontend journey from a verified merchant post detail into the errand-order
secret view is fully wired on `main` (shipped under #646 / #647). The original
issue #693 reproduction (`#/post/99` shows no `帮我取` CTA, eligibility probe
returns `not_verified`) is not a frontend wiring gap — it is a **seed/fixture
gap**: no public seeded post on the canary backend currently carries an active
`merchant_verified` grant + `errandSupported=true`, so the detail surface has
no input that would render the CTA.

This handoff:

1. Documents the existing frontend journey end-to-end so QA can reproduce it.
2. Pins the dispatch contract with new structure tests + a unit test for
   `errandReasonText`, so a future refactor cannot silently regress the
   "show backend reasonText on rejection" requirement.
3. Flags the seed-fixture dependency so the backend / data team owns the
   public-fixture work and the frontend doesn't paper it over with a hardcoded
   `tid=99` mock.

No runtime code changed. All changes are tests + this doc.

## Frontend journey

```
Feed/detail (#/post/<tid>) — PostDetailPanel.vue
  └── PostDetailContent.vue
        └── PostDetailMerchantBlock.vue           ← v-if="merchant"
              ├── available branch                ← v-if="errandEntryAvailable"
              │     button MERCHANT_ERRAND_CTA    ← data-testid="post-detail-merchant-errand-cta"
              │     onClick:
              │       useErrandOrderRoute().enterForMerchant(merchantPostId, "feed")
              │       setActiveView("errand-order")
              └── unavailable branch              ← v-else-if="errandEntryAvailable === false"
                    label MERCHANT_ERRAND_UNAVAILABLE_LABEL
                    button (disabled)
                    hint = errandReasonText(...) || MERCHANT_ERRAND_UNAVAILABLE_FALLBACK
                                                  ← data-testid="post-detail-merchant-errand-reason"

useActiveView("errand-order")
  └── AppViewHost.vue (lazy-loads ErrandOrderView)
        └── ErrandOrderView.vue
              consumes useErrandOrderRoute().merchantPostId
              renders ErrandOrderGate.vue when not eligible
              renders form when eligible
              on submit success → enterForOrder(orderId), pivots to ErrandOrderTimelineView
```

Key files:

| File                                              | Role                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/api/posts.ts`                                | `normalizePostDetail` surfaces `errandEntryAvailable`, `errandUnavailableReason`, `errandUnavailableReasonText` |
| `src/types/post.ts`                               | `PostDetail` carries the optional merchant + reason fields                                                      |
| `src/types/merchant.ts`                           | `MerchantErrandUnavailableReason` union + `MerchantErrandEligibility` shape                                     |
| `src/features/detail/PostDetailMerchantBlock.vue` | Renders both branches; dispatches into `useErrandOrderRoute`                                                    |
| `src/features/merchant/merchant-format.ts`        | `errandReasonText` — backend `reasonText` wins over localized code fallback                                     |
| `src/features/errand/useErrandOrderRoute.ts`      | Singleton route store with `merchantPostId` + `origin`                                                          |
| `src/app/AppViewHost.vue`                         | Lazy-loads `ErrandOrderView` for `setActiveView("errand-order")`                                                |

## Eligibility input shape

`GET /api/posts/:tid` is expected to return, for a verified merchant post the
viewer is allowed to interact with:

```jsonc
{
  "tid": 123,
  "title": "...",
  "merchant": {
    "name": "...",
    "category": "food",
    "hours": "...",
    "contact": "...",
    "errandSupported": true,
    "verifiedAt": "2026-05-01T12:00:00Z",
  },
  "errandEntryAvailable": true,
}
```

When the merchant supports errand but the entry is currently unavailable,
backend MAY attach (top-level or under `errand`):

```jsonc
{
  "errandEntryAvailable": false,
  "errandUnavailableReason": "off_hours", // or "no_runner_coverage" | "merchant_paused" | "not_verified" | "unknown"
  "errandUnavailableReasonText": "今晚 22:00 后再来下单。", // optional, server-localized prose
}
```

Frontend rules (pinned by `tests/merchant/errand-reason-text.test.ts`):

- `available=true` → never render rejection prose, even if `reasonText` is set.
- `available=false` + `reasonText` non-empty → render `reasonText` verbatim
  (server gets the final word; we never override server-supplied prose).
- `available=false` + known `reason` code, no `reasonText` → render the
  localized constant (`MERCHANT_ERRAND_REASON_*`).
- `available=false` + unknown / empty reason → fallback to
  `MERCHANT_ERRAND_UNAVAILABLE_FALLBACK`. Never silently hide.

## Browser proof (manual, on canary)

Pre-requisite: a public post `#/post/<tid>` whose backend payload includes
`merchant.errandSupported=true` AND `errandEntryAvailable=true`.

1. Open canary as `e2e-registered` (or anonymous).
2. Navigate to `#/post/<tid>`.
3. Expect: `PostDetailMerchantBlock` renders with category pill, verified
   stamp, hours, contact, **and** the `帮我取` CTA inside a section with
   `data-testid="post-detail-merchant-errand-entry"`.
4. Tap the CTA. Expect:
   - URL changes to `#/errand-order` (or equivalent secret-view hash).
   - `ErrandOrderView` mounts. The form's pickup field defaults to the
     merchant's location (driven by `useErrandOrderRoute().merchantPostId`).
   - Tapping the back affordance returns the user to the **feed tab**, not
     wherever the secret view defaults — because the merchant block dispatched
     `enterForMerchant(merchantPostId, "feed")`.

For the unavailable case (e.g. `errandEntryAvailable=false`,
`errandUnavailableReason="off_hours"`):

5. Expect: section with `data-testid="post-detail-merchant-errand-unavailable"`,
   the disabled `帮我取` button, and a reason line with
   `data-testid="post-detail-merchant-errand-reason"` showing either
   `errandUnavailableReasonText` (if backend attached one) or the localized
   constant for the reason code.

## Seed-fixture dependency (BACKEND / DATA)

> **Frontend cannot satisfy issue #693's "verified merchant fixture exists"
> acceptance criterion alone.** This requires a backend / seed change.

The original repro (`#/post/99` shows no CTA) means: the canary post at
`tid=99` does not currently ship `merchant_verified` + `errandSupported=true`
through `GET /api/posts/99`. Without that, the frontend correctly shows no CTA.

What's needed (out of this PR's scope):

- At least one publicly-readable seed post on canary whose payload has
  `merchant.errandSupported=true` and either
  - `errandEntryAvailable=true` (happy-path proof), or
  - `errandEntryAvailable=false` + a `errandUnavailableReason` (rejection-path proof, ideally a second post).
- The `e2e-merchant` account's `merchant_verified` grant should remain active
  on the seed dataset (env: `LIAN_E2E_MERCHANT_USERNAME`/`LIAN_E2E_MERCHANT_PASSWORD`),
  so that account can publish the fixture if seed scripts don't bake one in.
- Surface the chosen seed `tid` in the e2e suite (`tests/e2e/post-detail-cold-start.spec.ts`
  or equivalent) so the merchant→errand journey can be exercised end-to-end
  against the canary backend without environment-specific magic numbers
  scattered across specs.

The frontend deliberately does **not** fake a verified merchant post by
hardcoding `tid=99` or adding a client-side mock. Doing so would let a real
backend regression hide behind a frontend stub.

## Tests added in this PR

| Test                                                             | What it pins                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/merchant/errand-reason-text.test.ts`                      | `errandReasonText` honors `available=true`, prefers backend `reasonText` over localized code, falls back to constants per code, fallback for unknown / empty reason.                                                                                                                                                                           |
| `tests/detail/merchant-block.structure.test.mjs` (5 new asserts) | CTA gated by `errandEntryAvailable === true` AND positive `merchantPostId`; click dispatches `enterForMerchant(merchantPostId, "feed")` + `setActiveView("errand-order")`; unavailable branch surfaces `errandReasonText(...)` and the fallback constant; the block does not grow an "暂未开放" chip when `errandEntryAvailable` is undefined. |

## Out of scope

- Backend seed changes (callout above).
- Changes to the publish form, ErrandOrderView form, or eligibility probe API.
- Mounting `PostDetailMerchantBlock` in a Vitest harness (no `@vue/test-utils`
  in this repo today; existing detail-block coverage is structure-style + e2e).
