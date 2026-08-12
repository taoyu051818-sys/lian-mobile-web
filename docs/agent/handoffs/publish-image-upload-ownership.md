# Handoff: publish-image-upload-ownership

## Status

Locally accepted on 2026-08-10. The implementation is commit `8847203` on
`codex/audit-f2f-publish-image-upload-ownership`. It has not been pushed,
merged, or deployed. Network and production access remained paused, so F2f
has no online control issue; the local task document is the scope record.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2e acceptance `f73e07f`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

Publish previously treated selected files, preview URLs, and uploaded URLs as
three mutable arrays joined only by numeric index. The upload loop retained an
index across an asynchronous request while the normal UI still allowed image
removal. Removing an in-flight entry could therefore attach its late URL to a
different visible file and still pass the existing count-based submit guard.

Resetting or changing draft scope while a request was in flight also allowed
old success, failure, or finalization to mutate the new draft. The removal race
is reachable in the current UI; the reset boundary supports F2e and future
identity-generation work.

## What changed

- Added one authoritative image-entry owner with stable selection IDs, File
  identity, preview URL, upload state, and uploaded URL.
- Derived the old flat arrays as frozen, read-only projections so existing
  Publish consumers keep their current shape without owning duplicate state.
- Guarded asynchronous completion with generation, runner ticket, entry ID,
  File reference, and expected status.
- Made removal of the active upload invalidate its physical result and start a
  replacement runner for remaining entries.
- Transferred the original logical completion to that replacement runner. The
  existing PublishView continuation therefore runs only after the replacement
  image is uploaded and `uploading` is false.
- Kept reset and disposal non-blocking: they immediately release logical
  callers, clear busy state, revoke previews, and allow a new generation while
  obsolete physical requests finish harmlessly.
- Preserved sequential upload order, existing error text, API payload shape,
  nine-image validation, and the public `usePublishDraft` surface.
- Raised the approved Vitest inventory from 158 to 159.

## Files changed

- `src/features/publish/usePublishImageUploads.ts`
- `src/features/publish/usePublishDraft.ts`
- `tests/publish/usePublishImageUploads.test.ts`
- `tests/phase0/phase3-contract.test.ts`
- `scripts/check-test-inventory.mjs`
- `docs/agent/tasks/publish-image-upload-ownership.md`
- `docs/CURRENT_STATUS.md`
- `docs/agent/handoffs/publish-image-upload-ownership.md`

## API, storage, and migration

No HTTP endpoint, request or response DTO, backend, database, Redis, cookie,
sessionStorage schema, route, dependency, or deployment contract changed.
Image ownership exists only in component memory. Existing `imageUrl` and
`imageUrls` payload fields remain unchanged, so no migration is required.

## Test evidence

- The red baseline lacked the new owner and failed all five new delegation and
  stale-index structure assertions; the deferred behavior suite then drove the
  implementation through removal, reset, append, failure, disposal, and
  identical-file cases.
- Final focused suite: 6 files / 77 tests passed.
- Full `npm run verify` passed:
  - 159 Vitest files / 4,052 tests;
  - 65 Node structure files / 817 tests;
  - HTML sanitizer;
  - loopback smoke 3/3;
  - lint with zero errors and the three pre-existing warnings.
- Typecheck and build passed; Vite transformed 643 modules and generated 72
  PWA precache entries.
- Two independent reviewers recorded `ACCEPT`. A separate reachability review
  verified the remove-to-replacement completion chain, reset-to-new-generation
  behavior, and stale physical result guards with no blocking finding.

## Known risks and follow-up

- The implementation invalidates ownership but does not abort the underlying
  HTTP request. A successfully uploaded file later removed by the user can
  remain as an unreferenced server asset under the existing retention policy.
- Recovery after a failed first entry now resumes remaining work when the
  failed entry is removed. A direct PublishView integration test for the
  location-panel callback would strengthen coverage, but the completion
  contract and its prerequisites are already tested and independently reviewed.
- Two low-level timing cases remain useful follow-up coverage: a replacement
  finishing while its invalidated physical predecessor never returns, and
  disposal releasing its logical waiter before a stale network response. The
  implementation was independently inspected for both paths.
- `ERROR_PUBLISH_IMAGE` still reaches the existing integration path, although
  the new structure gate does not assert that text binding directly.
- Mounted cross-tab identity refresh remains outside F2f; F2e likewise did not
  claim that arbitrary mounted account changes are safe.
- The next recommended lane is F2g: capture an immutable submit snapshot and
  bind late publish success/failure to the owning attempt.

## Rollback

Revert implementation commit `8847203` and the following documentation
acceptance commit. No server, API, database, Redis, browser-storage schema, or
deployed-state cleanup is required.

## Not done

- No push, pull request, merge, deployment, production access, server access,
  credential use, or network probing.
- No backend, API client, upload endpoint, auth, Map, Profile, or session-draft
  schema change.
- No AbortController, orphan cleanup, retry UI, compression, parallel upload,
  AI-trigger policy, immutable submit snapshot, or global auth epoch.
