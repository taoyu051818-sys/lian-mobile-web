# LIAN Mobile Web

Frontend/mobile web workspace for LIAN.

This repository owns the Vue 3 + Vite frontend, design tokens, frontend assets,
task-board UI, and frontend documentation. The legacy static runtime has been
migrated to `taoyu051818-sys/-lian-mobile-web-legacy`. Use GitHub issues and PRs
as the queue and contract source of truth.

Read [`docs/CURRENT_STATUS.md`](docs/CURRENT_STATUS.md) before starting work. The dated coordination and phase snapshot formerly kept here is archived at [`docs/archive/status-snapshot-2026-06.md`](docs/archive/status-snapshot-2026-06.md).

## Runtime model

The frontend is a Vue 3 + Vite application. `npm start` runs `vite preview` on
port 4301. `npm run dev` starts the Vite dev server on port 5173.

```txt
Vite preview/dev:  http://127.0.0.1:4301 (preview) / http://127.0.0.1:5173 (dev)
backend API:       http://127.0.0.1:4200
image proxy:       http://127.0.0.1:4201
```

Start the backend separately when smoke tests need live `/api/*` responses. Check
`docs/CURRENT_STATUS.md`, open GitHub issues, and merged backend changes when a
frontend lane depends on backend contract truth.

## Locale coverage and RTL scope

The shipped mobile-web UI locale set is defined by `src/locales/resolveLocale.ts`
and wired through `src/locales/index.ts`. See
`docs/architecture/blcu-locale-coverage.md` for the durable BLCU wave lineage and
RTL boundary note.

- Shipped locales: zh-CN, zh-TW, en, ja, ko, ru, vi, id, es, fr, ar, de, it, pt, tr, th, mn, kk
- Pre-BLCU baseline: zh-CN, zh-TW, en, ja
- BLCU wave 1: ko, ru, vi, id, es, fr, ar
- BLCU wave 2: de, it, pt, tr, th, mn, kk
- RTL locales: ar

BLCU waves 1-2 ship locale files, resolver mappings, runtime switching, and
message-key parity against `zh-CN` for the registered locales above. RTL scope is
limited to setting `<html lang>` and `<html dir>` from the active locale; only
Arabic (`ar`) ships with `dir="rtl"` today. Merchant/errand domain constants that
still live outside `src/locales/` are not claimed as localized by this coverage
note.

## Toolchain baseline

- `.nvmrc` pins the repo Node baseline to `22`.
- The frontend GitHub Actions workflow reads that same file through `actions/setup-node`.
- `package-lock.json` is required, and CI installs from it with `npm ci`.

## Install dependencies

```bash
npm ci
```

Use `npm install` only when adding or updating dependencies locally.

## Start frontend

```bash
npm start
```

## Build

```bash
npm run build
```

This runs `vue-tsc --noEmit` and `vite build`.

## Validate

```bash
npm run check
npm run ops:guard
npm run build
npm run test
```

Or run the full frontend verification bundle:

```bash
npm run verify
```

Current meanings:

- `npm run check` validates required project files, encoding contamination, runtime exposure, and unsafe DOM sinks.
- `npm run ops:guard` checks runtime inventory guardrails.
- `npm run test` runs the Vue smoke test against `http://127.0.0.1:4301`.
- `npm run test:unit` runs vitest unit tests.
- `npm run verify:static` runs check, ops guard, and build.
- `npm run verify:smoke` runs the Vite-preview-backed smoke flow.
- `npm run verify` runs `verify:static`, unit tests, and `verify:smoke`.

## Run E2E locally

The Playwright journey tests target `https://lian.nat100.top` by default and do not
require a local backend.

For the current env/seed matrix, read `docs/e2e/PLAYWRIGHT_SEED_CONTRACT.md`
first. That file is the canonical source of truth for:

- role-specific `LIAN_E2E_*` account credentials
- `LIAN_E2E_SEEDED_EVENT_ID`
- `LIAN_E2E_ADMIN_TOKEN` and the related verification env inputs
- `LIAN_E2E_RUNNER_ORDER_ID`
- the post-#765 `/api/fixtures` event-runtime contract

Minimal local baseline:

```bash
export APP_BASE_URL=https://lian.nat100.top
npx playwright install chromium
npm run test:e2e
```

On PowerShell:

```powershell
$env:APP_BASE_URL = "https://lian.nat100.top"
npx playwright install chromium
npm run test:e2e
```

The legacy `journey.spec.ts` logs in through `/api/auth/login`, exercises the public
post journey, and verifies the public share URL still renders.

### Multi-account fixture (#644, #707)

The Playwright account fixture in `tests/e2e/fixtures/accounts.ts` defines the
roles the journey suites can target. Each role reads credentials from
environment variables. Roles whose env vars are absent are **skipped** (not
failed) so a missing seed never silently passes as green.

| Role            | Env user                          | Env password                      | Expected verification tags                           |
| --------------- | --------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `anonymous`     | _(none)_                          | _(none)_                          | _(none, never logs in)_                              |
| `registered`    | `LIAN_E2E_REGISTERED_USERNAME`    | `LIAN_E2E_REGISTERED_PASSWORD`    | _(none)_                                             |
| `campus`        | `LIAN_E2E_CAMPUS_USERNAME`        | `LIAN_E2E_CAMPUS_PASSWORD`        | `campus_verified`                                    |
| `merchant`      | `LIAN_E2E_MERCHANT_USERNAME`      | `LIAN_E2E_MERCHANT_PASSWORD`      | `merchant_verified` (often with `realname_verified`) |
| `runner`        | `LIAN_E2E_RUNNER_USERNAME`        | `LIAN_E2E_RUNNER_PASSWORD`        | `runner`                                             |
| `admin`         | `LIAN_E2E_ADMIN_USERNAME`         | `LIAN_E2E_ADMIN_PASSWORD`         | _(role asserted via NodeBB group, no LIAN tag)_      |
| `event_creator` | `LIAN_E2E_EVENT_CREATOR_USERNAME` | `LIAN_E2E_EVENT_CREATOR_PASSWORD` | `campus_verified`, `realname_verified`               |
| `org_member`    | `LIAN_E2E_ORG_MEMBER_USERNAME`    | `LIAN_E2E_ORG_MEMBER_PASSWORD`    | `campus_verified`, `org_member`                      |

The runner capability uses `runner` as the canonical verification tag across frontend and backend runner gates. Do not introduce `runner_verified`; treat it as product-language shorthand, not a wire-format tag.

The `event_creator` / `org_member` accounts back the rewarded-event journey
landed by `lian-platform-server` PR #443 (issue #439). The same backend seeds
a deterministic rewarded event at tid `156` and surfaces it via
`GET /api/fixtures` (non-prod gated) under `fixtures.eventRuntime`. The
Playwright helpers in `tests/e2e/fixtures/event-runtime.ts` consume that
discovery endpoint so spec code never has to hardcode the tid:

| Env var                    | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `LIAN_E2E_SEEDED_EVENT_ID` | Seeded event tid (`156` today). Specs skip when this is unset. |

Run only the fixture validation suite:

```bash
npm run test:e2e -- --grep @account-fixture
```

In CI, the **E2E Journey** workflow exposes a `journey_group` `workflow_dispatch`
input. Choose `account-fixture`, `anonymous`, `registered`, `campus`, `merchant`,
`runner`, `admin`, or `all`. The selection is wired through
`LIAN_E2E_JOURNEY_GROUP` to Playwright's `grep` so unrelated suites are skipped.

Locally, set the same env var to filter:

```bash
LIAN_E2E_JOURNEY_GROUP=account-fixture npm run test:e2e
```

Never paste the seeded passwords into PRs, issues, or commit messages — the only
sources are GitHub Actions secrets and your local 1Password.

## Agent documentation

Before starting implementation, read:

1. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
2. `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
3. `docs/agent/references/DOC_REVIEW_FINDINGS_2026-05-05.md`
4. `docs/agent/README.md`

These files override older task-board and handoff text when they conflict with current merged PRs and code.
