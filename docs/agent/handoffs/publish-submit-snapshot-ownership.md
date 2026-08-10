# Handoff: publish-submit-snapshot-ownership

## Status

Locally accepted on 2026-08-10. The implementation is commit `ea0c29e` on
`codex/audit-f2g-publish-submit-snapshot`. It has not been pushed, merged, or
deployed. No server, credential, production, or external network access was
used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2f acceptance `8e055ca`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The Publish editor intentionally remains editable while a request is pending.
The old submit flow assembled the HTTP request before awaiting the network but
read live title, body, images, location, Event, Merchant, Trade, and AI refs
again when the response arrived. A successful submission A could therefore
produce an A/B hybrid result preview and unconditionally clear a newer draft B.

Explicit form reset and F2e account-scope adoption called
`resetPublishAttempt()`, but that function previously cleared only the regular
post idempotency fields. A late A success, failure, partial result, or `finally`
could still write into B, resurrect A retry state, or release B's busy flag.
These sequences are deterministic with deferred local promises and require no
server interaction.

## What changed

- Captured one JSON-detached, deeply frozen submission snapshot before the
  first `await` for both regular posts and Events.
- Derived the exact wire request, location fallback, and actionable result
  preview from that snapshot; response handling no longer rereads source refs.
- Added a raw draft-ownership projection in `PublishView` covering reset-owned
  text, panels, images, upload lifecycle, location state, Event, Merchant,
  Trade, and AI candidate fields.
- Added a response generation, unique ticket, and active-request identity.
  Success, error, partial state, haptic feedback, result fields, reset, and
  `finally` commit only for the current owner.
- Split internal logical idempotency cleanup from public request abandonment.
  Payload changes rotate the regular-post key without invalidating the new
  request; explicit reset advances the generation and releases busy
  immediately.
- Kept duplicate submit as a true no-op by checking busy ownership before
  validation and result clearing.
- Reset the form after a successful owned response only when a freshly captured
  raw ownership fingerprint still equals the submitted snapshot. A newer B
  draft is preserved even when its normalized wire payload resembles A.
- Restored the frozen A preview after the production reset callback re-enters
  public request abandonment.
- Raised the approved Vitest file inventory from 159 to 160.

## Files changed

- `src/features/publish/usePublishSubmit.ts`
- `src/features/publish/PublishView.vue`
- `tests/publish/usePublishSubmitSnapshotOwnership.test.ts`
- `tests/publish/usePublishSubmitIdempotency.test.ts`
- `tests/publish/usePublishSubmitEventDraftContext.test.ts`
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `tests/publish/publishActionablePreview.structure.test.mjs`
- `scripts/check-test-inventory.mjs`
- `docs/agent/tasks/publish-submit-snapshot-ownership.md`
- `docs/CURRENT_STATUS.md`
- `docs/agent/handoffs/publish-submit-snapshot-ownership.md`

## API, storage, and migration

No endpoint, request or response DTO, header, backend, database, Redis,
sessionStorage, cookie, route, dependency, or deployment contract changed.
Snapshot and owner state exist only in the mounted Publish composable. Regular
post idempotency keys retain their existing retry behavior. No migration is
required.

## Test evidence

- The frozen old-code baseline produced 12 intended Vitest failures and one
  structure failure across Event/regular deep snapshots, duplicate no-op,
  image pending/success/failure ownership, reset-to-B settle order, and stale
  failure/partial handling.
- Final focused matrix: 8 Vitest files / 82 tests passed, plus 17/17 focused
  Node structure tests.
- The production-style reset re-entry case calls the public abandon function,
  clears live draft/result refs, and proves the frozen A preview is restored
  while the stale `finally` remains harmless.
- Full `npm run verify` passed in 98.9 seconds:
  - 160 Vitest files / 4,067 tests;
  - 65 Node structure files / 819 tests;
  - typecheck and production build (643 modules, 72 PWA precache entries);
  - HTML sanitizer and runtime guards;
  - loopback smoke 3/3;
  - lint with zero errors and three pre-existing warnings.
- Two independent reviewers recorded `ACCEPT`; a third reachability review
  recorded `ACCEPT_WITH_NOTES` and no blocking finding.

## Known risks and follow-up

- Event creation still has no server-backed idempotency key. A server commit
  followed by a lost response can still create a duplicate when the user
  retries. This requires a coordinated backend attempt contract and remains a
  separate release-blocking candidate.
- Public abandonment prevents stale browser-state commits but cannot cancel or
  reverse a server request that already completed.
- The normal post-success actionable result can remain hidden when the live
  draft has been reset because the preview component's render predicate does
  not include the stored published result. That bounded UI defect remains a
  separate follow-up.
- Mounted cross-tab identity refresh and submit-time server identity
  revalidation remain outside F2g. F2e/F2g must not be cited as a global auth
  epoch solution.
- The pre-open reset-confirm path has a structural ordering guard plus
  composable stale-owner behavior coverage; a mounted component journey would
  provide additional UI-level evidence but is not required for this accepted
  in-memory contract.

## Rollback

Revert implementation commit `ea0c29e` and the following documentation
acceptance commit. No server, API, database, Redis, browser-storage schema, or
deployed-state cleanup is required. A request already accepted by a server is
not reversed by client rollback.

## Not done

- No push, pull request, merge, deployment, production access, server access,
  credential use, or network probing.
- No backend, API client, Event DTO, auth, upload, location, session schema, or
  editor-locking change.
- No AbortController, remote side-effect reversal, Event idempotency, global
  auth epoch, or actionable-preview render-policy fix.
