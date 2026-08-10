# Handoff: Feed auto-load sentinel recovery

## Status

Locally accepted on 2026-08-10. The implementation is commit `750973b` on
`codex/audit-f3d-feed-auto-load-sentinel`. The task contract is `1f75320` and
the red-test commit is `5fd7be5`. None has been pushed, merged, or deployed. No
server, credential, production, browser automation, or external network access
was used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F3c acceptance `77874ba`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The old sentinel reacted only at the instant an `IntersectionObserver` callback
arrived. If the target first intersected while Feed loading was disabled, a
later enabled state did not produce a new browser edge. A real exit/re-entry
inside the 900 ms cooldown was also discarded permanently when the target then
remained intersecting.

Both are normal UI sequences: Detail may be open when the sentinel enters its
root margin, or the user may re-enter that margin during cooldown. Pagination
could stop even though the sentinel was visible and eligible.

## What changed

- The composable tracks the current target's continuous intersection residency.
- A disabled first entry is remembered and reconciles once when enabled.
- A genuine exit/re-entry inside cooldown owns one remaining-time timer instead
  of losing the entry.
- A successful emission consumes the residency before invoking the caller. Its
  own loading false-to-true cycle cannot chain another page or create polling.
- Cooldown belongs to the composable instance and survives target
  replacement/removal; residency and timers do not.
- Observer and timer generations reject queued callbacks from old targets or
  canceled timers.
- Callback entries are processed in delivery order for only the current target;
  synchronous terminal disconnect invalidates the rest of the batch.
- Public `disconnect()` is terminal and idempotent. It releases the observer,
  timer, target watcher, and enabled watcher. Target replacement uses a private
  non-terminal teardown.
- Setup remains SSR-safe and does not create observer/watch/timer work before
  mount. Missing `IntersectionObserver` remains a safe no-op.

## Test evidence

- The accepted old-runtime baseline had 9 intended failures and 2 passing
  compatibility guards across the new 11-case recovery suite.
- Review added direct evidence for instance-wide cooldown across removal and
  replacement, timer-handle ownership, old-observer isolation while a new timer
  is pending, two watcher stop handles, disconnect-before-mount, unmount with a
  pending timer, `cooldownMs: 0`, and ordered mixed-entry batches.
- Final focused recovery suite: 11/11 passed; existing sentinel structure suite:
  6/6 passed.
- Full `npm run verify` passed in 98.8 seconds:
  - 166 Vitest files / 4,144 tests;
  - 65 Node structure files / 820 tests;
  - typecheck, lint, production build (643 modules / PWA 71 entries), HTML
    sanitizer, runtime guards, and 3 loopback smoke checks all passed;
  - lint retained only three pre-existing warnings.
- Three independent reviewers recorded `ACCEPT` with no blocking finding after
  adversarial timer, observer, lifecycle, and real Feed reachability review.

## Files changed

Runtime:

- `src/composables/useAutoLoadSentinel.ts`

Tests/gates:

- `tests/composables/useAutoLoadSentinel.recovery.test.ts`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-auto-load-sentinel-recovery.md`
- `docs/agent/handoffs/feed-auto-load-sentinel-recovery.md`

## Data, migration, and compatibility

There is no endpoint, request/response DTO, browser-storage, database, Redis,
service-worker, or schema migration. The public composable signature and exact
observer defaults are unchanged. No user or server data cleanup is required.

## Known risks and follow-up

- One continuous intersection residency intentionally emits at most once. A
  short viewport that needs multiple pages without a real exit/re-entry still
  has the manual load-more button; automatic chaining would require a separate
  no-progress/cursor policy to avoid a network loop.
- Server offset pagination still needs a cursor/snapshot contract.
- Feed/Detail canonical reaction reconciliation, page restoration, and truthful
  bookmark/report/share/context-menu actions remain separate batches.
- Physical browser observer callbacks cannot be canceled once queued, but all
  stale generations are denied state and emission authority.

## Rollback

Revert implementation commit `750973b`, red-test commit `5fd7be5`, task commit
`1f75320`, plus the following acceptance commit. Restore Vitest inventory from
166 to 165. No browser, server, database, Redis, or deployed-state cleanup is
required.

## Not done

- No Feed request/API/DTO/backend/auth/storage/cursor/cache/reaction/menu/CSS,
  dependency, build, deploy, or production change.
- No push, pull request, merge, deployment, production access, server access,
  credential use, network probing, or online browser journey.
