# Task: Feed auto-load sentinel recovery

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F3c acceptance `77874ba` with implementation `fab9dc3`.
- Working branch: `codex/audit-f3d-feed-auto-load-sentinel`.
- Status: planned; no runtime or test implementation has started.
- Current code, root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
  `docs/agent/README.md`, `docs/agent/00_AGENT_RULES.md`, the accepted F3a-F3c
  tasks, and available local Feed references were checked.
- Recent online issues and merged pull requests are intentionally not queried
  because the user paused network/security-related activity.
- This is a local frontend observation-state correction. It changes no Feed
  request policy, endpoint, DTO, backend, browser storage, authentication,
  dependency, deployment, or production state.

## Reproduced problem

`useAutoLoadSentinel` currently reacts only to an `IntersectionObserver`
callback edge. At callback time it checks `enabled` and a 900 ms cooldown:

```text
observer callback -> intersecting? -> enabled? -> cooldown elapsed? -> emit
```

If the sentinel becomes intersecting while loading is disabled, the callback
is discarded. When loading later becomes enabled while the same sentinel is
still intersecting, the browser is not required to send another intersection
callback, so pagination can remain stopped indefinitely. The same loss occurs
when a real exit/re-entry arrives during the cooldown: the callback is rejected,
then no timer reconciles the still-intersecting state when the deadline passes.

Normal UI sequences include:

1. Open Detail while the Feed sentinel enters the configured root margin;
   `enabled=false` rejects the callback. Close Detail while the sentinel remains
   intersecting; `enabled=true` produces no new observer edge.
2. Trigger one page, leave the intersection, then re-enter within 900 ms. The
   re-entry callback is rejected by cooldown and the sentinel remains visible.

The repair must recover those lost admissions without turning the sentinel into
a level-triggered polling loop. In particular, the completion of its own Feed
request must not cause another automatic request while the same continuous
intersection residency remains active.

## Product decision

One continuous intersection residency may produce at most one successful
`load-more` emission. A residency begins when the current observed target is
reported intersecting and ends only when that observer reports a non-intersecting
entry, the target is replaced/removed, or the composable is disconnected.

The runtime maintains these private concepts:

```text
disposed / mounted
current observer identity and target
isIntersecting
triggeredForCurrentIntersection
cooldownUntil
one cooldown timer
target watcher and enabled watcher cleanup
```

`reconcile()` is the sole emission gate:

1. If disposed, not intersecting, already triggered for this residency, or
   disabled, it emits nothing. A disabled state cancels any pending cooldown
   timer; the enabled watcher will reconcile again when enabled becomes true.
2. If cooldown remains, it schedules exactly one timer for the remaining time.
   Repeated observer callbacks do not create additional timers.
3. When eligible, it first marks the current residency consumed and advances
   `cooldownUntil`, then synchronously emits once.
4. A successful emission never schedules another timer for the same residency.
   Its own `loadingMore` false-to-true recovery therefore cannot chain pages.

An observer callback with `isIntersecting=false`, target replacement/removal,
or disconnect clears the current residency and any timer. A later genuine
intersection can start a new residency. If that re-entry is within cooldown,
the single timer may emit when the remaining deadline expires, provided the
same current target is still intersecting and enabled.

`cooldownUntil` belongs to the composable instance. Target replacement,
temporary target removal, and later target reacquisition reset the residency
and cancel its old timer, but they do not erase the instance-wide deadline. A
new target that intersects inside the existing window schedules a new timer for
the remaining duration. Eligibility begins when `now >= cooldownUntil`.

Each callback processes only entries from the current observer and current
target, in delivery order. `[true, true]` is one residency; `[false, true]`
ends the old residency and begins a new one subject to the same instance-wide
cooldown. Observer identity and terminal state are checked before every entry,
so a synchronous `disconnect()` from `onIntersect` prevents the remaining
entries from changing state or emitting.

## Public API and lifecycle

The current composable surface remains compatible:

```ts
useAutoLoadSentinel(targetRef, onIntersect, options?) -> { disconnect }
```

Existing defaults remain unchanged:

```text
rootMargin = "720px 0px 720px 0px"
threshold = 0.01
cooldownMs = 900
```

All browser observer creation, enabled watching, and timers begin only after
mount. If `IntersectionObserver` is unavailable, the composable is a safe no-op
and the existing manual load-more path remains available.

`disconnect()` is idempotent and terminal for the current instance. It clears
the timer, intersection/residency state, observer, target watch, and enabled
watch. Queued callbacks from an old observer must be rejected by disposed and
observer-identity checks. Unmount delegates to the same cleanup. Target
replacement instead uses a private, non-terminal observer teardown: it cancels
the old timer, invalidates queued callbacks, resets the residency, and observes
the new target without disposing the composable or stopping either watcher.

## Required invariants

- A first eligible intersection emits exactly once.
- Repeated `true` callbacks, time passage, or enabled false-to-true after a
  successful emission cannot emit again during the same residency.
- An intersection first observed while disabled emits once when enabled becomes
  true, without requiring a second observer callback.
- A genuine exit/re-entry within cooldown emits once at the remaining deadline,
  without requiring a third observer callback.
- Disabling, exiting, removing/replacing the target, disconnecting, or unmounting
  cancels a pending cooldown timer.
- If cooldown expires while disabled, later enabling during the still-current
  unconsumed residency emits once immediately.
- Multiple cooldown-blocked callbacks maintain one timer and one eventual emit.
- Callback entries are processed in delivery order; a synchronous terminal
  disconnect prevents later entries in the same callback from emitting.
- Old observer callbacks and timers cannot affect a replacement target or a
  disconnected instance.
- No interval, recursive timer, or “while intersecting” repeat loop is allowed.
- Existing F3c append failure, retry, request ownership, and `canAutoLoadMore`
  policies remain unchanged.

## Allowed files

Runtime:

- `src/composables/useAutoLoadSentinel.ts`

Tests and inventory:

- `tests/composables/useAutoLoadSentinel.recovery.test.ts` (new)
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-auto-load-sentinel-recovery.md`
- `docs/agent/handoffs/feed-auto-load-sentinel-recovery.md`

## Forbidden files and non-goals

- No file outside the exact Allowed files list.
- No change to `FeedView.vue`, `useFeedData.ts`, `FeedAutoLoadSentinel.vue`,
  `FeedLoadMore.vue`, API adapters, DTOs, backend, auth, storage, routes, CSS,
  service worker, dependencies, build, deployment, or production.
- Existing Feed sentinel structure and browser tests are validation-only and
  must not be edited in this lane.
- No cursor/snapshot API, no-progress detector, request retry policy, request
  abort, Feed cache, scroll restoration, KeepAlive, ResizeObserver,
  MutationObserver, or periodic polling.
- No automatic repeated page loading while one residency remains intersecting.
- No Feed/Detail reconciliation, save/share/report behavior, menu ownership,
  long-press change, Club-card parity, or visual redesign.
- No online E2E or production browser session.

## Test-first matrix

The new test must import and exercise the production composable. It may stub
Vue lifecycle registration and `IntersectionObserver`, and may use fake timers,
but it must not copy the runtime state machine or assert only source text.

1. With enabled true, the first `true` entry emits once. Repeated `true`
   callbacks in the same residency, including after cooldown, emit no more;
   no timer remains after success even when time advances through multiple
   cooldown windows.
2. A first `true` entry while disabled emits nothing. Changing enabled to true
   while it remains intersecting emits once without a second observer callback.
3. After a successful emission, enabled false-to-true while still intersecting
   does not emit a second time and creates no timer.
4. After success, a `false` exit followed by `true` re-entry within cooldown
   emits nothing before the remaining deadline and exactly once at the deadline,
   without another observer callback.
5. If the re-entry timer is pending and enabled becomes false, the deadline
   emits nothing. Re-enabling before expiry creates one timer for only the
   remaining time; re-enabling after expiry emits once immediately.
6. A pending timer is canceled by a `false` entry or target removal. Advancing
   time emits nothing; a later genuine re-entry can emit once.
7. Multiple cooldown-blocked `true` callbacks create one pending timer and one
   eventual emission.
8. Target replacement disconnects the old observer and resets residency. Old
   queued callbacks/timers cannot emit; the new observer can emit normally,
   after any remaining instance-wide cooldown.
9. Explicit disconnect and unmount are idempotent, clear pending timers and both
   watchers, and reject later observer callbacks/enabled changes. Explicit
   disconnect before the captured mount hook runs prevents mount from reviving
   the instance.
10. Missing `IntersectionObserver` is a safe no-op. Custom/default observer
    options and cooldown values remain compatible. Merely running setup without
    the captured mount hook creates no observer, watcher, or timer.
11. Batched entries are processed in delivery order for the current target:
    `[true, true]` is one residency; `[true, false]` ends outside with no pending
    recovery; `[false, true]` starts a new residency subject to cooldown. A
    synchronous terminal disconnect from the first emission invalidates the
    remainder of that callback batch.

The old implementation must fail at least the disabled-to-enabled recovery and
cooldown-deadline recovery cases while all existing regressions remain green.
The repaired implementation must also fail a deliberately naive same-residency
level-retrigger implementation through cases 1 and 3.

## Validation commands

Focused red/green validation:

```bash
npx vitest run tests/composables/useAutoLoadSentinel.recovery.test.ts
node --test tests/feed/feedAutoLoadSentinel.structure.test.mjs
npm run check:test-inventory
npm run build
npm run verify
```

Also run Prettier, ESLint, TypeScript, and `git diff --check` on the allowed
files before review. The new Vitest file raises inventory from 165 to 166;
Node inventory remains 65.

## Risks and mitigations

- Risk: recovery becomes an automatic request loop. Mitigation: consume one
  emission per continuous residency and never self-schedule after success.
- Risk: old callbacks affect a new target. Mitigation: observer identity plus
  disposed/target lifecycle guards and adversarial queued-callback tests.
- Risk: timers survive disable/unmount. Mitigation: one owned timer, synchronous
  cancellation, enabled watcher recovery, and fake-timer cleanup assertions.
- Risk: lifecycle mocking makes tests pass without real Vue reactivity.
  Mitigation: use real refs/watchers, capture only lifecycle hooks, and invoke
  the actual production composable.

## Data, migration, compatibility, and rollback

- No API, browser-storage, database, Redis, service worker, or schema migration.
- No change to Feed request payloads, responses, or user data.
- Rollback reverts the bounded runtime/test/docs commits and changes inventory
  from 166 back to 165. No client or server data cleanup is required.

## Acceptance authority

- The implementation thread may report completion but cannot accept the lane.
- At least two independent reviewers must inspect bounded residency semantics,
  timer and observer ownership, SSR behavior, test discrimination, and exact
  allowed-file scope.
- Only the primary review thread may record F3d as locally accepted.
- No push, merge, deployment, production mutation, or online validation is
  authorized by this task.
