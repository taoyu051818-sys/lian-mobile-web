# Handoff: LA2b LAPlatform merchants administrator UI

## Status

- Local acceptance date: 2026-08-12.
- Accepted GREEN implementation commit: `7716d81`.
- Final loading-lease RED commit: `44014d6`.
- Frozen task SHA-256: `7179398A...A1340EB`.
- Local prerequisite base: `0d78fda` (accepted F3j profile reaction membership).
- No commit in this frontend LA2b chain was pushed, merged, deployed, or used to change a real
  environment. Production remains on **HOLD**.
- A frontend PR is not ready: `0d78fda` is not yet part of the real remote `main`. F3j must land
  first, or this branch must be restacked onto a real `main` containing the equivalent accepted
  chain, followed by a complete scope and validation rerun.

## Commit chain

1. `44f503a` defines the LA2b merchants UI task on `0d78fda`.
2. `81d9c17` clarifies the pagination evidence boundary.
3. `923e0c3` adds the initial behavioral RED boundary.
4. `27a534e` adds authorization, account-isolation, and ownership gap REDs.
5. `f0923a4` closes the nested-owner and hermetic Edge fixture gaps.
6. `44014d6` adds the final pre-existing-independent-reload loading-lease RED.
7. `7716d81` adds the accepted GREEN runtime and final evidence corrections.

This handoff is the only acceptance-phase file added after `7716d81`.

## Delivered journey

The frontend now consumes exactly one fixed cookie-session BFF route:

```text
GET /api/admin/laplatform/merchants
```

The API client accepts only bounded merchant list query fields and an optional abort signal. It
does not accept a token, URL, method, headers, or generic request options. Successful 2xx data is
strictly decoded, including exact envelope keys, UUID request ID, safe pagination integers, dense
merchant arrays, field descriptors, and real UTC timestamps. Malformed responses and failures are
rebuilt as fixed local error categories; raw response messages, bodies, URLs, headers, causes, and
credentials are not rendered or retained.

Administrator access is an explicit finite-state lane:

- `probing`: no privileged UI or legacy request is visible.
- `session-merchants`: only the read-only merchants surface is visible and only the BFF is called.
- `ops`: only the existing legacy reports, verification, auth-link, and audit surfaces are visible;
  they continue to use the explicit stored operations token.
- `gate` / `probe-error`: no merchant or legacy privileged data is shown.

A strict initial merchants response both establishes `session-merchants` and supplies the first
queue, so there is no duplicate request. Stored operations tokens are never added to the merchants
BFF request. Session and operations surfaces are mutually exclusive.

The merchants surface includes safe loading, rows, empty state, fixed errors, bounded manual retry,
1-to-60-second 429 cooldown, search, status filters, refresh, and offset pagination through the
inclusive 1,000,000 maximum. A new search intent remains available while a previous request is
loading so the composable can physically abort the predecessor. Response settlement is guarded by
lane, auth epoch, lifecycle, query sequence, and exact owner identity.

Legacy operations remain logically fenced rather than physically aborted. Each public operation
uses lane, token, auth epoch, lifecycle, authorization version, and per-operation sequence. Nested
verification/auth-link reloads additionally use exact loading leases with an optional parent outer
owner. An outer failure can release only the exact same-key stale nested lease it inherited; it
cannot clear a parentless independent reload, a later replacement, or a create/revoke cross-key
owner.

Current 401/403, explicit administrator exit, account change, logout, and component disposal clear
the applicable token, epoch, merchant state, legacy ephemeral data, verification notes, timers,
controllers, and logical owners before returning to an unprivileged lane. Late success, error, and
finally paths cannot revive a retired account or clear a new account's state.

## Files delivered by `7716d81`

- `src/api/adminLaPlatform.ts`
- `src/features/admin/AdminLaMerchantsBlock.vue`
- `src/features/admin/AdminView.vue`
- `src/features/admin/index.ts`
- `src/features/admin/useAdminAccess.ts`
- `src/features/admin/useAdminConsole.ts`
- `src/features/admin/useAdminMerchants.ts`
- `src/features/admin/useAdminToken.ts`
- `tests/admin/admin-console.structure.test.mjs`
- `tests/e2e/local/admin-la-merchants-journeys.spec.ts`

The task, inventory update, initial RED files, gap RED files, and final loading-lease RED were
committed separately before the GREEN implementation.

## RED evidence

- Initial RED against the old runtime collected 248 focused tests: 6 compatibility controls passed
  and 242 intended behavioral expectations failed without suite collapse.
- The first ownership-gap follow-up collected 248 tests with 33 intended failures against the then
  provisional runtime.
- The nested-successor follow-up collected 254 tests with only its 3 new intended failures.
- The final loading-lease RED at `44014d6` collected 257 tests: 254 passed and the 3 new
  review/create/revoke ownership expectations failed. All three proved that an outer ordinary
  failure incorrectly cleared a pre-existing independent current reload.
- RED runs had no skips, cancellations, todos, unhandled rejections, production requests, or
  credential reads.

## Final GREEN evidence

All final evidence used Node.js 22.23.2 from the pinned local workspace runtime.

- Focused Vitest: 5 files, 288/288 passed.
- Full Vitest: 175 files, 4,677/4,677 passed.
- Node structure suite: 67 files, 845/845 passed.
- Hermetic Microsoft Edge journeys: 76/76 passed with one worker against the local Vite server.
- Test inventory: exactly 175 Vitest files and 67 Node test files.
- Project structure: 46/46; public runtime exposure: 8/8; runtime inventory: 6/6.
- Encoding scan: 219 files; unsafe DOM scan: 414 files; view-boundary violations: 0.
- Type checking, Prettier, ESLint, and `git diff --check` passed. ESLint retains only 3 unrelated
  pre-existing warnings.
- Production build passed with 653 transformed modules; PWA generation precached 71 entries.
- Repository `npm run verify` passed, including full static checks, unit and structure suites, HTML
  sanitizer, rebuild, and the 3/3 local preview smoke checks.
- Two independent read-only reviewers accepted the final implementation, scope, security boundary,
  concurrency ownership, and rollback:
  - `/root/la2b_followup_red_review`: `ACCEPT`.
  - `/root/la2b_edge_four_review`: `ACCEPT`.

The Edge fixture originally used a broad `**/api/**` glob that intercepted Vite source modules;
the accepted fixture matches only URL pathnames rooted at `/api/`. A final logout assertion also
waits for the successful asynchronous logout continuation rather than treating request admission as
completion. Neither correction weakens the runtime contract.

Validation artifacts (`dist`, Playwright results, and generated ownership documentation) were
moved recoverably under `work/verification/e1` through `work/verification/e9` outside the Git
worktree. No generated artifact is part of the accepted tracked diff.

## Security and release boundary

- No `Authorization`, `x-admin-token`, LAPlatform service token, direct LAPlatform origin, dynamic
  BFF path, caller headers, or generic request options were added to the browser integration.
- Merchant data, capabilities, filters, request IDs, and auth epochs are not persisted in browser
  storage, IndexedDB, Cache API, or the service worker.
- `/api/admin/me`, its frontend helper, legacy admin API contracts, global HTTP behavior, service
  worker policy, dependencies, lockfiles, Vite configuration, and live E2E remain unchanged.
- No backend, LAPlatform, DSPlatform, NodeBB, database, Redis, wallet, runtime-data, schema, or
  deployment file changed.
- Backend defaults remain `LAPLATFORM_ENABLED=false` and
  `LAPLATFORM_MERCHANTS_BFF_ENABLED=false`. This frontend batch did not enable or change either
  flag.
- No real credential was read, created, copied, rotated, or installed. No staging or production
  origin was contacted.

## Explicit non-actions and remaining prerequisites

- No push, PR, merge, deployment, release, feature activation, or production validation occurred.
- The accepted backend BFF implementation `e02d647` is local-only and still requires its own
  reviewed landing sequence.
- The independent prerequisites remain LAPlatform `906ea56`, LIAN LA1 `ceaecaa`, and LIAN LA2a
  `6012d56`; their existing draft PRs do not authorize deployment.
- A separate release task must first establish a reviewed real-main frontend base, exact
  non-production staging origin, credential-safe configuration, both disabled flags, and rollback
  authority before any staging enablement.
- The shared `ShellChrome` typed-tabs branch currently does not render simultaneous action buttons.
  LA2b therefore owns a local accessible exit button inside `AdminView` and does not modify the
  shared shell. A future separately scoped shell task may fix typed tabs plus actions and check the
  equivalent Runner Center behavior.

## Rollback

Keep both LAPlatform flags false. For a complete code/test/document rollback, revert in this order:

1. The future acceptance-document commit containing this handoff.
2. `7716d81` (GREEN runtime and final evidence corrections).
3. `44014d6` (loading-lease RED).
4. `f0923a4` (nested-owner and Edge fixture RED follow-up).
5. `27a534e` (authorization/account ownership gap RED).
6. `923e0c3` (initial RED boundary).
7. `81d9c17` (pagination evidence clarification).
8. `44f503a` (task contract).

Stop at `0d78fda`. This batch is read-only with respect to merchant and backend data, so rollback
requires no database, Redis, file, browser-cache, NodeBB, DSPlatform, or LAPlatform data cleanup.
Token rotation is not required without separate evidence of credential exposure. Rollback does not
authorize a deployment or production action.
