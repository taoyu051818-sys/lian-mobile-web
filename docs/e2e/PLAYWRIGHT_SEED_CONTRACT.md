# Playwright Seed Contract

## Why this doc exists

Issue #763 started as one umbrella for several skipped Playwright lanes. After merged PR #765, the event-runtime proof no longer depends on finding the seeded event in the public feed first. It now reads `/api/fixtures` before falling back to feed discovery, so the old "no event-shaped post in the public feed" skip is no longer the live blocker on `main`.

The remaining truth is narrower:

- `LIAN_E2E_ADMIN_TOKEN` still gates the admin verification aggregate proof.
- `LIAN_E2E_RUNNER_ORDER_ID` still gates the runner transition proof.
- The suite now mixes repo-backed fixture inputs, ordinary account credentials, and a few external/high-privilege inputs. This file is the canonical map.

## Current runtime inputs

### Shared Playwright config

| Env var                  | Read by                                                     | Purpose                                                                                                          | Source of truth          |
| ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `APP_BASE_URL`           | `playwright.config.ts`, multiple specs/helpers              | Base target for nat100 or another LIAN backend. Defaults to `https://lian.nat100.top` when unset.                | External runtime config. |
| `LIAN_E2E_JOURNEY_GROUP` | `playwright.config.ts`, `.github/workflows/e2e-journey.yml` | Filters the workflow-dispatch/nightly suite to one tagged slice such as `account-fixture`, `runner`, or `admin`. | External workflow input. |

### Repo-backed multi-account fixture roles

These are the standard seeded accounts read through `tests/e2e/fixtures/accounts.ts`. When a role's env pair is missing, the relevant spec skips instead of failing.

| Role            | Env vars                                                             | Used by                                                                                 | Source of truth                                                                    |
| --------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `registered`    | `LIAN_E2E_REGISTERED_USERNAME`, `LIAN_E2E_REGISTERED_PASSWORD`       | `journey.spec.ts`, `runner-center.spec.ts`, and any suite using `loginAs("registered")` | External secret that should point at the repo's seeded registered fixture account. |
| `campus`        | `LIAN_E2E_CAMPUS_USERNAME`, `LIAN_E2E_CAMPUS_PASSWORD`               | `event-runtime-proof.spec.ts` and other campus-gated specs                              | External secret pointing at the seeded campus fixture account.                     |
| `merchant`      | `LIAN_E2E_MERCHANT_USERNAME`, `LIAN_E2E_MERCHANT_PASSWORD`           | Merchant-gated E2E lanes                                                                | External secret pointing at the seeded merchant fixture account.                   |
| `runner`        | `LIAN_E2E_RUNNER_USERNAME`, `LIAN_E2E_RUNNER_PASSWORD`               | `runner-center.spec.ts`                                                                 | External secret pointing at the seeded runner fixture account.                     |
| `admin`         | `LIAN_E2E_ADMIN_USERNAME`, `LIAN_E2E_ADMIN_PASSWORD`                 | Admin login-based read-only lanes such as `admin-session-entry.spec.ts`                 | External secret pointing at the seeded admin fixture account.                      |
| `event_creator` | `LIAN_E2E_EVENT_CREATOR_USERNAME`, `LIAN_E2E_EVENT_CREATOR_PASSWORD` | `event-runtime.spec.ts` and fixture-backed event ownership checks                       | External secret pointing at the seeded event-owner fixture account.                |
| `org_member`    | `LIAN_E2E_ORG_MEMBER_USERNAME`, `LIAN_E2E_ORG_MEMBER_PASSWORD`       | `event-runtime.spec.ts` and fixture-backed joiner checks                                | External secret pointing at the seeded org-member fixture account.                 |

### Repo-backed event fixture input

| Env var                    | Read by                                                                  | Purpose                                                                                                                                                        | Source of truth                                           |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `LIAN_E2E_SEEDED_EVENT_ID` | `tests/e2e/fixtures/event-runtime.ts`, `tests/e2e/event-runtime.spec.ts` | Pins the deterministic rewarded-event fixture. The backend currently seeds tid `156` and advertises it through `GET /api/fixtures` as `fixtures.eventRuntime`. | Repo-backed fixture contract plus workflow/secret wiring. |

Notes:

- `tests/e2e/event-runtime.spec.ts` requires this var to be explicitly set before it runs.
- `tests/e2e/event-runtime-proof.spec.ts` now checks `/api/fixtures` first and only falls back to `/api/feed?limit=50` when fixture discovery is unavailable, which is the key change that landed in PR #765.
- `/api/fixtures` is intentionally non-prod gated. Production-mode 404 remains a truthful skip, not a regression.

## Remaining external gaps

### Admin aggregate approval lane

| Env var                            | Read by                                          | Why it still exists                                                                                             | Status                                         |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `LIAN_E2E_ADMIN_TOKEN`             | `tests/e2e/admin-verification-aggregate.spec.ts` | The aggregate proof needs bearer-token access to backend-owned admin approval routes.                           | Still an external configuration gap from #763. |
| `LIAN_E2E_VERIFICATION_REQUEST_ID` | `tests/e2e/admin-verification-aggregate.spec.ts` | Points at a specific pending verification request to approve.                                                   | Still external / run-specific.                 |
| `LIAN_E2E_VERIFICATION_TYPE`       | `tests/e2e/admin-verification-aggregate.spec.ts` | Tells the proof which backend verification route to patch (`org-join`, `realname`, `merchant`, or `runner`).    | Still external / run-specific.                 |
| `LIAN_E2E_VERIFICATION_USERNAME`   | `tests/e2e/admin-verification-aggregate.spec.ts` | Login used after approval to confirm the expected tag reaches `/api/auth/me`.                                   | Still external / run-specific.                 |
| `LIAN_E2E_VERIFICATION_PASSWORD`   | `tests/e2e/admin-verification-aggregate.spec.ts` | Password for the post-approval confirmation login.                                                              | Still external / run-specific.                 |
| `LIAN_E2E_VERIFICATION_TAG`        | `tests/e2e/admin-verification-aggregate.spec.ts` | Optional override when the expected post-approval tag should not be inferred from `LIAN_E2E_VERIFICATION_TYPE`. | Still external / run-specific.                 |

### Runner transition lane

| Env var                    | Read by                           | Why it still exists                                                                                            | Status                                           |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `LIAN_E2E_RUNNER_ORDER_ID` | `tests/e2e/runner-center.spec.ts` | The `accept -> pickup -> deliver` proof still needs one deterministic order that starts in an available state. | Still an open repo-contract gap tracked by #769. |

## Legacy wiring still visible in the repo

`README.md` and `.github/workflows/e2e-journey.yml` still mention `LIAN_E2E_USERNAME` / `LIAN_E2E_PASSWORD` for the old single-account journey path. That pair is not the canonical mainline seed contract anymore.

Current truth on `main` is:

- new account-aware specs read the role-specific `LIAN_E2E_*_{USERNAME,PASSWORD}` pairs from `tests/e2e/fixtures/accounts.ts`
- event-fixture discovery reads `LIAN_E2E_SEEDED_EVENT_ID`
- the remaining unsolved skips are `LIAN_E2E_ADMIN_TOKEN` and `LIAN_E2E_RUNNER_ORDER_ID`

Keep the legacy pair only as compatibility wiring until the old single-account path is intentionally removed or rewritten.

## CI surfaces

| Surface                             | What it wires today                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/e2e-journey.yml` | `APP_BASE_URL`, the legacy single-account pair, all role-specific account secrets, `LIAN_E2E_SEEDED_EVENT_ID`, and `LIAN_E2E_JOURNEY_GROUP` |
| `.github/workflows/e2e-pr-gate.yml` | `APP_BASE_URL`, read-only role credentials, and `LIAN_E2E_SEEDED_EVENT_ID`                                                                  |

The PR gate intentionally does not wire `LIAN_E2E_ADMIN_TOKEN` or `LIAN_E2E_RUNNER_ORDER_ID`, because those lanes are not part of the read-only PR subset.

## Source review baseline

This contract was reviewed against current `main` source in:

- `playwright.config.ts`
- `tests/e2e/fixtures/accounts.ts`
- `tests/e2e/fixtures/event-runtime.ts`
- `tests/e2e/event-runtime.spec.ts`
- `tests/e2e/event-runtime-proof.spec.ts`
- `tests/e2e/admin-verification-aggregate.spec.ts`
- `tests/e2e/runner-center.spec.ts`
- `.github/workflows/e2e-journey.yml`
- `.github/workflows/e2e-pr-gate.yml`

Related to #763.
Related to #765.
Related to #768.
Related to #769.
Does not close #763.
