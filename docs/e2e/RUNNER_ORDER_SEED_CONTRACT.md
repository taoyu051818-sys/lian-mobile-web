# Runner Order Seed Contract

This note records the current source of truth for the runner-center transition proof in `tests/e2e/runner-center.spec.ts`.

## Goal

The runner transition proof needs one order that is already in the runner-visible `available` state before it exercises `accept -> pickup -> deliver`.

The contract is now repo-backed by default instead of relying on an unexplained manual id guess.

## Resolution Order

`tests/e2e/fixtures/errand-runtime.ts` resolves the order id in this order:

1. `LIAN_E2E_RUNNER_ORDER_ID` when an explicit override is set.
2. `GET /api/fixtures` -> `fixtures.errandJourney.orderId` when the backend exposes the non-prod fixture surface.

If neither source is available, the transition test skips with a clear reason.

## Repo-Backed Default

The current repo-backed default comes from the backend errand journey fixture consumed by the frontend helper:

- backend surface: `GET /api/fixtures`
- fixture key: `fixtures.errandJourney`
- current deterministic order id: `err_e2e_merchant_runner_001`
- required fresh-state shape:
  - `ready === true`
  - `order.state === "paid_locked"`
  - `order.runnerUserId === null`

That shape is exactly what the runner-center proof expects before it calls `/accept`.

## Stability

The repo-backed id is stable, not regenerated per run.

What resets per run is the order state, not the id itself:

- the backend self-heal path rewrites the same deterministic order back to `paid_locked` with no runner bound when `/api/fixtures` is called successfully
- this makes the same order id reusable across repeated CI and local runs against the seeded non-prod backend

By contrast, `LIAN_E2E_RUNNER_ORDER_ID` is an explicit override. Its stability depends on whatever external environment provides it.

## When To Set `LIAN_E2E_RUNNER_ORDER_ID`

Leave `LIAN_E2E_RUNNER_ORDER_ID` unset when all of these are true:

- the target backend is the seeded non-prod environment
- `GET /api/fixtures` is enabled there
- the caller is happy to use the canonical errand journey fixture

Set `LIAN_E2E_RUNNER_ORDER_ID` explicitly when either of these is true:

- the target backend is production-mode or otherwise returns 404 for `/api/fixtures`
- the proof needs a specific non-canonical available order instead of `err_e2e_merchant_runner_001`

## Validation Expectation

The smallest truthful proof for this contract is:

1. resolve the order id from env override or `fixtures.errandJourney`
2. confirm that the runner available-order list contains that id before accept
3. run the existing `accept -> pickup -> deliver` transition flow

This keeps the lane focused on the runner-order prerequisite only.

Related to #763.
Related to #609.
Does not close #763.
