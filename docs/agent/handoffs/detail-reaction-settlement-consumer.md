# Handoff: Mounted Detail reaction settlement consumer

## Status

- Accepted locally on 2026-08-11 on
  `codex/audit-f3i-detail-reaction-consumer`.
- Accepted prerequisite: F3h head `72768cf`.
- Commit chain: task contract `f46e171` -> red tests and inventory `15fdfbb` ->
  runtime implementation `e78a855`.
- This batch is local frontend code and hermetic validation only. It used no
  external/remote network or remote backend; the only network/server activity
  was the hermetic localhost preview used by the 3 loopback smoke checks. It
  performed no push, merge, deployment, production mutation, or production
  validation.

## Problem and reachability

F3f-F3h gave the current mounted Feed an in-memory stream of authoritative Like
and Save settlements, but the mounted Detail surface was not a consumer. A
Footer Like or context-menu Save could update Feed while Detail remained stale.

Detail requests also had no settlement boundary. A Like or Save confirmed after
a physical Detail GET began could be overwritten by the older transport
snapshot when that GET resolved. Closing or replacing a never-settling request
did not own a prompt request-local listener release path.

Finally, Detail's own optimistic actions rolled failure back to click-time
values. They did not rebase over a newer same-owner settlement, and their old
publication/finally order could overwrite or release an inverse action admitted
synchronously by a settlement listener.

## What changed

- `fetchDetailWithToken` now resolves one optional/default settlement port and
  owns a request-local listener. It captures the channel sequence immediately
  before the physical `fetchPostDetail(tid)` call and overlays only newer,
  matching Like/Save fields onto a matching response.
- Like and Save request overlays retain independent greatest-sequence state.
  Non-reaction transport fields and nested references remain authoritative. If
  no overlay applies, the exact original response object is dispatched.
- The fetch bridge accepts a logical `AbortSignal` that releases projection
  state and commit authority without changing or cancelling the HTTP transport.
  Pre-abort, abort-during-start, late result, retained callback, error, and
  normal completion all use idempotent cleanup.
- The Detail store now owns the single production loading lease. It detaches an
  exact owner object before aborting, rechecks reducer effects before starting a
  physical request, and lets an old completion clear only that exact owner.
  This fences same-token ABA after testing reset and re-entrant A -> B effects.
- The module singleton store also owns one permanent ready projection listener.
  A new ready post records its pre-commit `toRaw` identity and independent Like
  and Save sequence floors. Matching settlements mutate only
  `liked`/`likeCount`/`bookmarked` in place, preserving observable Detail state,
  post identity, and every unrelated interaction.
- `usePostReactions` now subscribes through the same injected/default port it
  uses for publication. Full snapshots remain hard generation boundaries;
  settlements are reaction-only soft rebases with independent Like/Save floors,
  attempts, tickets, and latest failure baselines.
- Action admission records the current settlement sequence. An event already in
  delivery can update rollback authority without overwriting a newly admitted
  inverse action's optimistic display; a truly newer event updates both.
- Current success commits the authoritative response, retires and releases its
  own attempt, isolates feedback, then publishes exactly once as its final
  observable producer-side effect. Current failure restores the latest
  same-kind baseline and publishes nothing.
- Explicit and Vue-scope disposal share one idempotent terminal path. Late API
  work and callbacks retained in a channel delivery snapshot are silent.

The result is an ephemeral process-local projection between the current mounted
Feed and Detail owners. It is not a durable or global canonical entity model.

## Test evidence

- New Detail settlement behavior: 45/45.
- Nine focused acceptance files: 239/239.
- Projection structure plus Detail feedback: 12/12.
- Full Vitest: 171 files / 4,331 tests.
- Full Node structure inventory: 66 files / 839 tests.
- Production build: 647 transformed modules / PWA 71 entries.
- HTML sanitizer: passed.
- Hermetic localhost loopback smoke: 3/3.
- Full `npm run verify`: exit 0 in about 129.6 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.

## Files changed

Runtime:

- `src/app/detail-navigation/store.ts`
- `src/app/detail-navigation/fetcher.ts`
- `src/features/detail/usePostReactions.ts`

Tests and inventory:

- `tests/composables/detailReactionSettlementConsumer.test.ts`
- `tests/detail-navigation/detailReactionProjectionOwnership.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/detail-reaction-settlement-consumer.md`
- `docs/agent/handoffs/detail-reaction-settlement-consumer.md`

No file outside the task's exact Allowed files belongs to this batch.

## Compatibility and migration

- No endpoint, request/response DTO, reducer state union, component prop, schema,
  dependency, storage, service-worker, auth/session, backend, or deployment
  contract changed.
- Existing Detail URL/history, loading/error, panel, feedback, and Feed producer
  behavior remains compatible.
- Logical request abort does not claim physical HTTP cancellation. It promptly
  removes local projection authority while the old transport may still drain.
- No browser, account, database, Redis, localStorage, IndexedDB, service-worker,
  or server data migration is required.

## Known risks and follow-up

- Profile liked/saved collections are not immediately projected.
- Closing, reload, remount, or a new open receives no replay; the next physical
  Detail/Feed snapshot must establish state again.
- Cross-tab and cross-device convergence remain outside this process-local
  channel.
- Settlement events carry no account identity or auth epoch. A late same-`tid`
  event across an account transition is not fenced by this batch.
- There is no server reaction revision or global multi-producer ordering token,
  so genuinely concurrent clients remain last-response/eventually-consistent.
- Cursor pagination, page restoration, and durable offline reconciliation remain
  separate work.
- Hermetic unit and localhost validation cannot prove remote eventual
  consistency or every physical mobile lifecycle schedule.

## Rollback

- Revert the acceptance-documentation commit, runtime commit `e78a855`, red-test
  and inventory commit `15fdfbb`, and task commit `f46e171` in reverse order.
- Removing the two new tests and reverting the inventory update returns Vitest
  from 171 to 170 files and Node structure tests from 66 to 65 files.
- No client-storage, database, Redis, service-worker, remote-backend, or
  production cleanup is needed. A Like or Save already accepted by the existing
  server is ordinary user data and is not reversed by code rollback.

## Not done

- No Profile projection, replay, persistence, reload/remount hydration,
  cross-tab transport, account epoch, server revision, cursor/page restoration,
  or durable/global reaction reconciliation was added.
- No online issue/PR check, online browser journey, external/remote network,
  remote/backend server call, credential use, push, merge, deployment,
  production mutation, or production validation was performed.
