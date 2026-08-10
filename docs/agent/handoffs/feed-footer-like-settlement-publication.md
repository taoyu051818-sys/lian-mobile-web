# Handoff: Feed Footer Like settlement publication

## Status

- Accepted locally on 2026-08-11 on
  `codex/audit-f3h-feed-footer-like`.
- Accepted prerequisite: F3g head `3a56e12`.
- Commit chain: task contract `e217f6e` -> red tests and inventory `d67b320` ->
  runtime implementation `956eff8`.
- This batch is local frontend code and hermetic validation only. It used no
  external/remote network or remote backend; the only network/server activity
  was the 3 hermetic localhost loopback preview checks. It performed no push,
  merge, deployment, production mutation, or production validation.

## Problem and reachability

The Feed Footer previously held optimistic and authoritative Like state only in
its local component refs. Its `liked` component event had no listening ancestor,
so a successful Like did not update the mounted Feed owner and could disappear
after a card projection, refresh, or recreation.

The old Footer also lacked complete owner boundaries. A reused Footer could let
an old completion regain authority after a `tid` transition, failure restored
click-time values instead of a newer same-`tid` baseline, `finally` could clear a
re-entrant action's busy state, and unmount did not invalidate pending work.

## What changed

- Added `useFeedCardLike`, which owns normalized baseline/display state, a raw
  `tid` owner generation, an independent Like ticket, one active attempt, and a
  terminal idempotent disposal path.
- Every count ingress converts to a finite, truncated, non-negative integer.
  Only a positive integer `tid` can admit a request or settlement.
- A same-`tid` props refresh updates both the latest rollback baseline and the
  displayed state without cancelling the active attempt. Any raw `tid` change
  synchronously retires that attempt, including A -> invalid -> A.
- Current failure restores the newest same-`tid` baseline, releases busy, and
  publishes nothing. Stale success and failure are silent.
- Current authoritative success commits the normalized response, retires the
  attempt, releases busy, then publishes one frozen Like settlement with the
  captured `tid` as its final observable side effect. There is no broad
  `finally`, feedback, component event, or post-publication write.
- The composable defaults once to the established Like API and F3f settlement
  singleton. Its optional dependency and port seams remain confined to
  hermetic tests.
- `FeedItemCardFooter.vue` now derives its Like refs and handler from the
  composable through real prop refs. Avatar-error reset remains a separate
  watcher, and the dead `liked` emit and direct API call were removed.
- The unchanged F3f Feed consumer shallow-projects a current Footer settlement
  into the matching mounted item. F3g's reaction-only continuity preserves
  Context Save/Share ownership and frozen menu snapshots.

## Test evidence

- New Footer Like settlement behavior: 42/42.
- Four F3e-F3h behavior files: 140/140.
- Eight core acceptance files: 177/177.
- Focused structure suite: 20/20.
- Related Footer coverage: 30/30.
- Full Vitest: 170 files / 4,286 tests.
- Full Node structure inventory: 65 files / 830 tests.
- Production build: 647 transformed modules / PWA 71 entries.
- HTML sanitizer: passed.
- Loopback smoke: 3/3.
- Full `npm run verify`: exit 0 in about 97.4 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.

## Files changed

Runtime:

- `src/features/feed/useFeedCardLike.ts`
- `src/features/feed/FeedItemCardFooter.vue`

Tests and inventory:

- `tests/composables/feedFooterLikeSettlement.test.ts`
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-footer-like-settlement-publication.md`
- `docs/agent/handoffs/feed-footer-like-settlement-publication.md`

No file outside the task's exact Allowed files belongs to this batch.

## Compatibility and migration

- No endpoint, request/response DTO, schema, dependency, storage, service
  worker, auth/session, backend, or deployment contract changed.
- Footer DOM/button semantics, optimistic interaction, labels, avatar fallback,
  visibility badge, and card-control isolation remain compatible.
- The settlement channel remains an in-memory mounted-surface coordination port,
  not a durable cache, global canonical entity store, or replay mechanism.
- No browser, account, database, Redis, localStorage, IndexedDB, service-worker,
  or server data migration is required.

## Known risks and follow-up

- Detail is still not a consumer of Feed-origin settlements. A Footer Like that
  overlaps a Detail request or action can therefore leave mounted Detail state
  stale; that needs its own owner and physical-request-boundary design.
- Profile liked collections are not immediately projected.
- Reload, remount, cursor/page restoration, and cross-tab convergence remain
  outside this no-replay mounted-session channel.
- Settlement events carry no account identity or auth epoch. Account-transition
  fencing remains separate work.
- There is no server reaction revision or multi-producer global ordering token,
  so genuinely concurrent clients remain eventually consistent.
- These are candidates for F3i and later bounded batches; this acceptance does
  not expand the current mounted-Feed claim.

## Rollback

- Revert the acceptance-document commit, runtime commit `956eff8`, red-test and
  inventory commit `d67b320`, and task commit `e217f6e` in reverse order.
- Removing `tests/composables/feedFooterLikeSettlement.test.ts` returns the
  Vitest inventory from 170 to 169 files; the Node inventory remains 65 files.
- No client-storage, database, Redis, service-worker, remote-backend, or
  production cleanup is needed. A Like already accepted by the existing server
  is ordinary user data and is not reversed by code rollback.

## Not done

- No Detail consumer, Profile projection, replay, persistence, cache hydration,
  cross-tab transport, account epoch, server revision, cursor/page restoration,
  or durable/global reaction reconciliation was added.
- No online issue/PR check, online browser journey, remote/backend server call,
  push, merge, deployment, credential use, production mutation, or production
  validation was performed.
