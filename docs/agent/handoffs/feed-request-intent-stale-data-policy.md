# Handoff: Feed request intent and stale-data policy

## Status

Locally accepted on 2026-08-10. The implementation is commit `fab9dc3` on
`codex/audit-f3c-feed-request-intents`. The task contract is `9d7f5bd`, the
red-test commits are `59f53f4` and `dbcf962`, and the compatibility-contract
commit is `18d7543`. None has been pushed, merged, or deployed. No server,
credential, production, browser automation, or external network access was
used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F3b acceptance `5fdb2db`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

One boolean `loadFeed(reset)` represented initial/context replacement, manual
refresh, pagination, and retry. That ambiguity made three normal UI failures
reachable:

- a failed pull refresh cleared an already useful multi-page list;
- the only error retry reloaded page 1 after page-N pagination failed;
- append failure re-enabled automatic loading and could repeat the same failed
  page without an explicit user retry.

The old Promise also followed physical request lifetime. A superseded pull
gesture could remain busy behind an obsolete transport, while late success,
failure, or `finally` needed separate ownership protection.

## What changed

- Every request captures a frozen descriptor containing only intent, tab,
  canonical visibility membership, and page.
- `replace`, `refresh`, and `append` now have distinct admission, busy, success,
  failure, and retry policies.
- Pull refresh preserves committed items, page, and `hasMore` until a successful
  atomic replacement.
- Append failure preserves prior pages, disables automatic loading, and gives
  the manual action an exact page/tab/filter retry descriptor.
- `loading`, `refreshing`, and `loadingMore` are mutually exclusive;
  `requestPending` powers shared error-action feedback and keeps a strict empty
  refresh out of the ordinary empty state.
- Exact duplicate refresh and retry calls share one logical completion. A real
  replacement/refresh can promptly release an obsolete ordinary caller without
  granting its transport any commit authority.
- The F3b identity-resolution cohort remains shared through auth resolution and
  the latest physical Feed request. Account/guest `read` ownership is attached
  only after a fresh generation/lifecycle check and is never stored in retry
  state.
- Dispose immediately releases all semantic callers and busy flags. Late auth
  or Feed outcomes cannot commit items, pagination, errors, retry ownership, or
  `finally` state.
- F3a first-slot/latest-snapshot merge and non-positive-ID pass-through remain
  unchanged.
- FeedView now routes pull refresh to `refreshFeed()` and the visible error
  action to `retryFailedRequest()` with `requestPending` feedback.

## Test evidence

- The accepted red baseline had 23 intended failures and 42 passing guards.
- Review added direct evidence that ordinary `triggerLoadMore()` and failed
  append retry return the physical attempt's still-pending semantic Promise,
  plus a real context replacement that clears visible old failure ownership.
- Final focused matrix: 7 Vitest files / 96 tests passed.
- Full `npm run verify` passed in 110.3 seconds:
  - 165 Vitest files / 4,133 tests;
  - 65 Node structure files / 820 tests;
  - typecheck, lint, production build (643 modules / PWA 71 entries), HTML
    sanitizer, runtime guards, and 3 loopback smoke checks all passed;
  - lint retained only three pre-existing warnings.
- Two independent reviewers recorded `ACCEPT` with no blocking finding after
  the final Promise-ownership and compatibility checks.

## Files changed

Runtime:

- `src/features/feed/useFeedData.ts`
- `src/features/feed/FeedView.vue`

Tests/gates:

- `scripts/check-test-inventory.mjs`
- `tests/composables/useFeedData.request-intent.test.ts`
- `tests/composables/useFeedData.item-identity.test.ts`
- `tests/composables/useFeedData.request-race.test.ts`
- `tests/composables/useFeedData.read-history-scope.test.ts`
- `tests/feed/feedReadHistoryIdNormalization.contract.test.ts`
- `tests/phase0/phase4-deeplink-contract.test.ts`
- `tests/ui/InlineError.test.ts`

## Data, migration, and compatibility

There is no endpoint, request/response DTO, browser-storage, database, Redis,
service-worker, or schema migration. The change is an in-memory projection and
request-lifecycle correction. F3b scoped history keys and the ignored legacy
key are untouched.

## Known risks and follow-up

- F3c does not abort the physical HTTP request. Logical ownership is released
  promptly and all late commits are rejected, but the transport may still
  finish in the background.
- Server offset pagination still needs a cursor/snapshot contract; F3a/F3c can
  only deduplicate identities the server returned.
- The auto-load sentinel can still miss an `enabled=false -> true` recovery
  while continuously intersecting. That is the next bounded Feed batch and
  must use a one-trigger-per-intersection policy rather than polling.
- Feed/Detail reaction reconciliation, page restoration, and truthful
  bookmark/report/share/context-menu actions remain separate batches.
- Feed instances do not observe cross-tab session mutation while mounted; F3b
  only guarantees the normal app lifecycle and its current owner-resolution
  transaction.

## Rollback

Revert implementation commit `fab9dc3`, compatibility commit `18d7543`,
red-test commits `59f53f4` and `dbcf962`, task commit `9d7f5bd`, plus the
following acceptance commit. Restore Vitest inventory from 165 to 164. No
browser, server, database, Redis, or deployed-state cleanup is required.

## Not done

- No backend, API, DTO, auth/session, browser-storage, cursor, ranking, cache,
  reaction, context-menu, CSS, dependency, build/deploy, or production change.
- No push, pull request, merge, deployment, production access, server access,
  credential use, network probing, or online browser journey.
