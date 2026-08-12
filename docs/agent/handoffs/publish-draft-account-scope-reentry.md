# Handoff: publish-draft-account-scope-reentry

## Status

Locally accepted on 2026-08-10. The implementation is commit `d93721e` on
`codex/audit-f2e-publish-draft-scope-reentry`. It has not been pushed, merged,
or deployed. Control issue:
[#1090](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1090).

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2d acceptance `3afb386`
- Historical account-scope work checked: issue #692 and merged PR #694
  (`af35b2d`)
- Runtime used for validation: Node 22.23.2

## Reachability and scope

Normal in-app login/logout currently unmounts Publish, so A -> B -> A is not a
currently reachable normal-UI incident. The underlying composable contract was
still defective: revisiting A skipped its restore, left B's form visible while
ownership pointed at A, and allowed the next edit to overwrite A's saved slot.

This lane repairs that idle, synchronous state transaction. It does not enable
or certify mounted identity refresh. Cross-tab auth changes and late results
from upload, publish, AI, audience, merchant, trade, or verification requests
remain separate work.

## What changed

- Removed the one-time `restoredScopes` cache and restored the target snapshot
  on every account-scope entry.
- Persisted the outgoing scope synchronously, temporarily removed form
  ownership, reset page-owned transient state, restored the target, and only
  then published the new ownership generation.
- Added `flush: "sync"` identity adoption so an edit made after assigning the
  new identity in the same tick belongs only to the target account.
- Added `restoreGeneration` as a monotonic completion signal while preserving
  the existing `restoreSettled` readiness gate.
- Discarded unowned pending location handoffs during a real owned-scope
  transition, while preserving the existing initial-mount adoption path.
- Reset File/upload previews, AI attempt state, Event/Merchant/Trade inputs,
  geolocation state, result copy, and reset-dialog state before target restore.
- Raised the approved Vitest inventory from 157 to 158.

## Files changed

- `src/features/publish/usePublishDraftSession.ts`
- `src/features/publish/PublishView.vue`
- `tests/publish/usePublishDraftSession.test.ts`
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `scripts/check-test-inventory.mjs`
- `docs/agent/tasks/publish-draft-account-scope-reentry.md`
- `docs/CURRENT_STATUS.md`
- `docs/agent/handoffs/publish-draft-account-scope-reentry.md`

## API and data contract

No HTTP, backend, database, Redis, cookie, storage-key, or snapshot-schema
contract changed. The internal Publish draft-session composable now returns a
monotonic `restoreGeneration`. Existing account-scoped sessionStorage values
remain readable and require no migration.

## Test evidence

- Old implementation: 4 focused files / 48 tests produced 8 intentional
  failures. A separate identity-first same-tick test also failed before the
  synchronous watch was added.
- Final focused suite: 4 files / 50 tests passed.
- Typecheck and build passed; Vite transformed 642 modules and generated 72
  PWA precache entries.
- Full `npm run verify` passed:
  - 158 Vitest files / 4,031 tests;
  - 65 Node structure files / 817 tests;
  - HTML sanitizer;
  - loopback smoke 3/3;
  - lint with zero errors and the three pre-existing warnings.
- Storage-operation tests assert exact A/B keys, serialized payloads, ordering,
  and the absence of unrelated scope mutations.
- Two independent reviewers recorded `ACCEPT` after the same-tick,
  operation-payload, initial-adoption, and formatting gaps were closed.

## Known risks and follow-up

- Publish still does not observe a global or cross-tab auth epoch.
- Submit-time identity is not revalidated in this lane.
- Upload, publish, AI preview, audience/capability, merchant/trade, and
  verification results do not yet carry an account generation and could be
  stale if a future mounted identity-refresh path is introduced.
- F2e must be described as an idle synchronous scope fix, not proof that
  arbitrary mounted account changes are safe.

The next recommended lane is a bounded Publish image-upload ownership/order
audit, followed by immutable submit-snapshot ownership. Both should remain
local, test-first, and independent of production systems.

## Rollback

Revert implementation commit `d93721e` and the following acceptance-document
commit. No server, API, database, Redis, browser-storage schema, or deployed
state needs cleanup.

## Not done

- No push, pull request, merge, deployment, production access, server access,
  credential use, or network probing.
- No backend or authentication-route changes.
- No global auth-refresh or asynchronous-request cancellation redesign.
