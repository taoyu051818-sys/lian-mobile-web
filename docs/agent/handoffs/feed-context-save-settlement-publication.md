# Handoff: Feed context-menu Save settlement publication

## Status

- Accepted locally on 2026-08-11 on
  `codex/audit-f3g-feed-context-save`.
- Accepted prerequisite: F3f head `2d0dd21`.
- Commit chain: task contract `3c53b3f` -> red tests and inventory `80b05ac` ->
  runtime implementation `64a7603`.
- This batch is local frontend code and hermetic validation only. It used no
  external/remote network or remote backend; the only network/server activity
  was the 3 hermetic localhost loopback preview checks. It performed no push,
  merge, deployment, production mutation, or production validation.

## Problem and reachability

F3e made Feed context-menu Save server-authoritative, but its confirmed value
was held only in the card action composable. The Feed-owned item could therefore
remain stale and later replace the card's confirmed bookmark state. F3f added a
settlement channel and mounted Feed consumer for Detail-origin reactions, but
the context-menu Save producer did not yet publish to that channel.

The existing F3f shallow projection also replaces the Feed item object. Before
this batch, the context-action owner treated every object replacement as a real
owner change, so a same-`tid` reaction-only projection could close the menu,
release busy state, invalidate pending Save/Share tickets, or rebase from a
stale bookmark value.

## What changed

- `useFeedCardContextActions` now accepts a typed optional settlement port and
  defaults to the production named singleton used by the existing Feed
  consumer.
- Same-`tid` replacement classification removes exactly the three reaction own
  keys (`liked`, `likeCount`, and `bookmarked`) and then requires an exact
  remaining own-key set with `Object.is` equality for every value. Only that
  exact reaction-only replacement preserves the frozen owner snapshot,
  generation, independent Save/Share tickets, busy state, and menu ownership;
  all real replacements retain F3e invalidation behavior.
- A reaction-only replacement rebases the live bookmark baseline without
  mutating the detached action snapshot used by Report or changing unrelated
  item values.
- Current-owner Save success applies the authoritative response, releases busy
  state, isolates haptic and success-toast failures independently, and then
  publishes the captured `tid` settlement last. There is no `finally` or local
  write after publication, so a synchronous re-entrant listener can start the
  next action without being clobbered by the completed action.
- Current-owner Save failure releases busy state before the existing best-effort
  error feedback, retains the latest external bookmark baseline, and publishes
  no settlement. Share behavior remains unchanged and keeps its independent
  ticket.
- The unchanged F3f Feed consumer immediately shallow-patches a matching mounted
  item and applies a request-local per-reaction overlay at each physical Feed
  request boundary. A later physical request remains authoritative for
  settlements that predate its boundary; the channel remains ephemeral and has
  no replay.

## Test evidence

- New context Save settlement behavior: 35/35.
- Six focused acceptance files: 100/100.
- Focused structure suite: 16/16.
- Full Vitest: 169 files / 4,244 tests.
- Full Node structure inventory: 65 files / 826 tests.
- Production build: 646 transformed modules / PWA 71 entries.
- HTML sanitizer: passed.
- Loopback smoke: 3/3.
- Full `npm run verify`: exit 0 in about 141.9 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.

## Files changed

Runtime:

- `src/features/feed/useFeedCardContextActions.ts`

Tests and inventory:

- `tests/composables/feedContextSaveSettlement.test.ts`
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-context-save-settlement-publication.md`
- `docs/agent/handoffs/feed-context-save-settlement-publication.md`

No file outside the task's exact Allowed files belongs to this batch.

## Compatibility and migration

- No endpoint, request/response DTO, schema, dependency, storage, service
  worker, auth/session, backend, or deployment contract changed.
- The existing Save endpoint, authoritative response, labels, haptic, and toast
  copy remain unchanged.
- The settlement channel is an in-memory mounted-surface coordination port, not
  a durable cache, global canonical entity store, or replay mechanism.
- No browser, account, database, Redis, localStorage, IndexedDB, or server data
  migration is required.

## Known risks and follow-up

- Footer Like still does not publish its authoritative success. It is the next
  bounded producer-owner batch and must preserve the Save/Share independence
  and reaction-only owner rules established here.
- Detail is not a consumer of Feed-origin settlements. Feed/Footer actions that
  overlap Detail opening can therefore leave mounted Detail reaction state
  stale; fixing this requires a separate Detail consumer and physical Detail
  GET boundary design, not a broader claim for this batch.
- Profile collections are not patched by this channel.
- The channel has no persistence or replay, so reload, remount, and cross-tab
  convergence remain outside this batch.
- Settlement events carry no shared account identity or auth epoch. Account
  transition fencing remains a separate risk and this acceptance does not claim
  account-scoped global reconciliation.
- There is no server revision or multi-producer global ordering token. A Feed
  response whose physical request starts after a settlement remains the later
  authority; this batch does not establish a durable or global canonical
  reaction value.

## Rollback

- Revert the acceptance-document change, runtime commit `64a7603`, red-test and
  inventory commit `80b05ac`, and task commit `3c53b3f` in reverse order.
- Removing `tests/composables/feedContextSaveSettlement.test.ts` returns the
  Vitest inventory from 169 to 168 files; the Node inventory remains 65 files.
- No client-storage, database, Redis, service-worker, remote-backend, or
  production cleanup is needed. A Save already accepted by the existing server
  is ordinary user data and is not reversed by code rollback.

## Not done

- No Footer Like producer, Detail consumer/GET boundary, Profile projection,
  persistent entity store, replay, cache hydration, cross-tab transport,
  account epoch, server revision, or multi-device ordering was added.
- No online issue/PR check, online browser journey, remote/backend server call,
  push, merge, deployment, credential use, production mutation, or production
  validation was performed.
