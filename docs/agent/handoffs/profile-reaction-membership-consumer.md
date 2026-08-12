# Handoff: Mounted Profile reaction-membership consumer

## Status

- Accepted locally on 2026-08-11 on
  `codex/audit-f3j-profile-reaction-membership`.
- Accepted prerequisite: F3i head `db45dfa`.
- Commit chain: task contract `11b1cc1` -> main red tests and inventory
  `c908a4d` -> cross-tab candidate regression `38afc7f` -> synchronous nested
  request-ownership regression `da98eef` -> runtime implementation `48b8ccc`.
- This batch is local frontend code and hermetic validation only. It used no
  external/remote network or remote backend; the only network/server activity
  was the hermetic localhost preview used by the 3 loopback smoke checks. It
  performed no credential use, push, merge, deployment, production mutation,
  or production validation.

## Problem and reachability

The App-level Detail overlay leaves its underlying Profile page mounted. F3i
made the mounted Detail surface a consumer and producer of authoritative Like
and Save settlements, but `useProfileTabs` did not consume them. After a user
removed Like or Save in Detail and closed the overlay, the corresponding row
could remain in the mounted Profile collection until another server request.

A simple immediate filter was insufficient. A `liked` or `saved` request that
started before the settlement could later return a stale membership snapshot
and reinsert the removed row. Tab/account transitions, duplicate rows, nested
channel delivery, same-account 401 retry, response handoff, synchronous reactive
re-entry, failure, and disposal all needed explicit owner boundaries.

## What changed

- `useProfileTabs` now accepts an optional typed settlement port and otherwise
  resolves the established named singleton once. One construction-time
  subscriber serves both immediate committed-list projection and request-local
  capture; explicit and Vue-scope disposal share one idempotent terminal path.
- An accepted `liked` or `saved` response installs a committed owner identified
  by collection tab and normalized stable account ID. It owns a hard sequence
  floor, independent per-`tid` floors, and bounded removed-row candidates.
- A matching negative event removes every duplicate row for that `tid` and
  retains only the first known row object and slot. A later positive event for
  the same mounted owner may restore that exact object once. A positive event
  for an unknown `tid` cannot fabricate or append a `ProfileListItem` DTO.
- Every physical Profile request installs an exact request owner, captures the
  settlement sequence immediately before the transport call, and records only
  newer matching events. Response overlay changes membership only; surviving
  transport rows and all non-membership fields remain authoritative.
- Initial and same-tab requests may learn candidates from the exact matching
  owner or their own transport response. Different-tab visible rows cannot be
  captured as candidates for the new tab, and accepted empty refreshes clear
  candidates from the prior owner.
- Initial request, same-account 401 retry, response-floor handoff, supersession,
  synchronous transport throw, accepted failure, and exact old cleanup all use
  independent request objects and generation checks. Older cleanup cannot clear
  a newer request or transfer request-local events/candidates.
- Stable account IDs are normalized. A new user object with the same normalized
  ID preserves continuity; a different ID or null token synchronously retires
  request and committed authority. Users without a stable ID may still receive
  transport data but do not receive settlement projection.
- Committed owner/request state is retired before reactive hard-boundary writes.
  Admission, error, response assignment, reset, orders, account change, and
  disposal paths fence synchronous re-entry so an outer continuation cannot
  overwrite a newly admitted request or its loading state.

The result is a mounted, in-memory projection of known `liked` and `saved`
collection membership. It is not a durable Profile cache or a global canonical
reaction model.

## Test evidence

- New Profile membership behavior: 65/65.
- New relationship structure suite: 6/6.
- Six request-race and F3e-F3i compatibility-guard files: 196/196.
- Full Vitest: 172 files / 4,396 tests.
- Full Node structure inventory: 67 files / 845 tests.
- Production build: 647 transformed modules / PWA 71 entries.
- HTML sanitizer: passed.
- Hermetic localhost loopback smoke: 3/3.
- Full `npm run verify`: exit 0 in about 105.5 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.

## Files changed

Runtime:

- `src/features/profile/useProfileTabs.ts`

Tests and inventory:

- `tests/profile/useProfileTabs.reaction-membership.test.ts`
- `tests/profile/useProfileTabs.reaction-membership.structure.test.mjs`
- `tests/profile/useProfileTabs.request-race.test.ts`
- `scripts/check-test-inventory.mjs`

Acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/profile-reaction-membership-consumer.md`
- `docs/agent/handoffs/profile-reaction-membership-consumer.md`

No file outside the task's exact Allowed files belongs to this batch.

## Compatibility and migration

- No endpoint, request/response DTO, Profile component prop, route, dependency,
  auth/session, storage, service-worker, backend, database, Redis, schema, or
  deployment contract changed.
- Existing history, posts-filter, orders, loading/error, same-account 401, and
  Profile view/statistics behavior remains compatible.
- No browser storage, server data, cache, database, Redis, or schema migration
  is required.
- Like and Save actions already accepted by the server remain ordinary user
  state. A frontend code rollback must not reverse those server side effects.

## Known risks and follow-up

- Profile statistics remain server-owned and do not increment or decrement from
  settlement events.
- Positive settlement for an unknown row cannot append because the event does
  not carry a Profile DTO snapshot.
- Reload, remount, or a new composable instance receives no replay; its next
  physical response establishes authority.
- Cross-browser-tab and cross-device convergence remain outside this
  process-local channel.
- Settlement events carry no account identity or auth epoch. Normal mounted
  transitions are fenced, but a truly late old-account event published after a
  new account is mounted cannot be classified.
- There is no server reaction revision or global multi-producer ordering token.
  A request started after an event is transport-authoritative.
- The reviewed server Profile cache adapter is currently a no-op. If a real TTL
  adapter is enabled, Like/Save invalidation and request authority must be
  reviewed before claiming cache-safe convergence.
- Feed cursor pagination, Profile page/scroll restoration, durable offline
  reconciliation, and global canonical reaction state remain separate work.
- A future controlled deployment is a separate release phase. This local
  acceptance provides no production access or deployment authority.

## Rollback

- Revert the eventual acceptance-documentation commit, runtime commit
  `48b8ccc`, synchronous nested-request RED commit `da98eef`, cross-tab
  candidate RED commit `38afc7f`, main RED/inventory commit `c908a4d`, and task
  commit `11b1cc1` in reverse order.
- Reverting `c908a4d` removes the two new test files, restores the request-race
  harness, and returns inventory from 172 to 171 Vitest files and from 67 to 66
  Node structure files.
- No client-storage, database, Redis, schema, service-worker, remote-backend, or
  production cleanup is needed. Successfully completed Like/Save server state
  is not reversed by code rollback.

## Not done

- No Profile statistics, unknown-row DTO synthesis, replay, persistence,
  reload/remount hydration, cross-tab transport, account epoch, server revision,
  real cache-adapter invalidation, page restoration, or durable/global reaction
  reconciliation was added.
- No online issue/PR check, online browser journey, external/remote network,
  remote/backend server call, credential use, push, merge, deployment,
  production mutation, or production validation was performed.
