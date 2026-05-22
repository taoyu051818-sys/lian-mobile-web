# Runner Order Seed Contract

Issue `#769` narrows the remaining runner-center prerequisite after the broader Playwright seed-contract refresh in `#768`.

## Current source of truth

- Backend merged contract: `taoyu051818-sys/lian-platform-server#463`
- Frontend fixture consumer on `main`: `tests/e2e/fixtures/errand-runtime.ts`
- Existing end-to-end proof on `main`: `tests/e2e/errand-full-chain-proof.spec.ts`

`GET /api/fixtures` now surfaces `fixtures.errandJourney` on non-production LIAN hosts. The fixture carries one deterministic runner-available order:

- `orderId === "err_e2e_merchant_runner_001"`
- `order.state === "paid_locked"`
- `order.runnerUserId === null`

The backend self-heals that record on fixture discovery, so the same order id is stable across runs rather than regenerated into a fresh secret every night.

## `LIAN_E2E_RUNNER_ORDER_ID` contract

`LIAN_E2E_RUNNER_ORDER_ID` is now an optional override, not the only way to run the transition proof.

Resolution order in `tests/e2e/runner-center.spec.ts`:

1. If `LIAN_E2E_RUNNER_ORDER_ID` is set, use it directly.
2. Otherwise fetch `/api/fixtures` and use `fixtures.errandJourney.orderId` when the fixture is `ready` and still in runner-available `paid_locked` state.
3. If neither source is ready, skip the mutating transition proof with an explicit reason.

## CI and local runs

The read-only runner-center checks keep the `@runner` tag and remain eligible for `E2E PR Gate`.

The mutating `accept -> pickup -> deliver` proof now uses the `@errand-transition` tag so it stays out of the read-only PR gate and can run only in the journey lane.

Run only the transition proof locally:

```bash
LIAN_E2E_JOURNEY_GROUP=errand-transition npm run test:e2e
```

Run only the transition proof in GitHub Actions:

- Dispatch `E2E Journey`
- Choose `journey_group=errand-transition`

## Truthful stability statement

This contract is **stable per fixture discovery call**, not "one fresh order id per run". The deterministic order id stays the same, and `/api/fixtures` repairs it back to runner-available shape between runs when needed.
