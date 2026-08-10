# Task: publish-image-upload-ownership

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F2e acceptance `f73e07f` with implementation `d93721e`.
- Working branch: `codex/audit-f2f-publish-image-upload-ownership`.
- Online issue creation and duplicate search are intentionally paused. This
  task document is the local scope record and must not be described as merged
  or integrated until an authorized operator publishes it.
- Root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`, agent rules,
  development principles, F2e handoff, current Publish upload code, submit
  consumers, validation rules, and existing upload tests were checked.
- This is a pure internal correctness fix. It changes no product semantics,
  API, DTO, storage, route, or deployment contract, so no cross-cutting review
  meeting is required by the current development principles.

## Problem statement

`usePublishDraft` currently treats three mutable arrays as one image record:

```text
selectedFiles[index]
localPreviewUrls[index]
uploadedImageUrls[index]
```

The upload loop captures a numeric index across `await`, while the visible UI
can remove or append entries and `resetForm` can clear all three arrays. A late
response therefore writes into the current meaning of an old index.

Two deterministic failures result:

1. With A uploaded, B in flight, and C pending, removing B allows B's result
   to occupy C's position and can skip C entirely. The visible list is A/C,
   but the submitted URLs can be A/B. Counts are equal, so the existing count
   validation does not detect the ownership error.
2. Resetting while A is in flight and selecting B leaves the old runner busy.
   B may not start, and A's late success, failure, or `finally` can populate or
   mutate the new draft.

The first path is reachable in the current normal Publish UI because removal
remains enabled while upload is active. The reset/scope path is defensive work
needed by F2e and future account-generation lanes.

## Goal

Make each selected image a stable, locally owned record. Upload completion may
mutate state only when the current generation, runner ticket, entry ID, File
reference, and entry status still match. The published URL projection must
always preserve the current visible entry order.

## State model

Use one authoritative entry collection:

```ts
type PublishImageStatus = "pending" | "uploading" | "uploaded" | "failed";

interface PublishImageEntry {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly status: PublishImageStatus;
  readonly uploadedUrl: string | null;
}
```

The existing public refs remain flat projections for compatibility:

- `selectedFiles`: entry files in visible order;
- `localPreviewUrls`: preview URLs in the same order;
- `uploadedImageUrls`: uploaded URLs in current visible order;
- `uploading`: true only for the active runner ticket.

Required invariants:

- Entry IDs represent selection instances. File names, sizes, and timestamps
  are not identity; two identical-looking File objects remain distinct.
- No asynchronous result writes by a captured array index.
- Upload result ownership requires the active generation and runner ticket,
  the same entry ID and File reference, and an `uploading` entry status.
- Removal resolves the current index to an entry ID synchronously. Removing an
  in-flight entry invalidates its ownership; the remaining queue continues.
- Appending during an active drain uploads each accepted entry exactly once.
- Reset and disposal increment generation before clearing state, release the
  current busy flag immediately, revoke owned preview URLs exactly once, and
  allow a new generation to start without waiting for old network work.
- Old success, old failure, and old `finally` do not mutate the current URL,
  error, or busy state.
- A current failure remains visible through the existing publish error path;
  the failed entry prevents count validation until removed. F2f adds no retry
  UI or product-policy change.
- Object URLs are created only for accepted files. Removal revokes the removed
  entry; reset/disposal revoke the remaining entries; remote HTTP URLs are
  never revoked.
- `imageUrl` and `imageUrls` keep the existing API shape. Their order at the
  F2f boundary equals the current UI order.

## Allowed files

Runtime:

- `src/features/publish/usePublishImageUploads.ts` (new)
- `src/features/publish/usePublishDraft.ts`

Tests and inventory:

- `tests/publish/usePublishImageUploads.test.ts` (new)
- `tests/phase0/phase3-contract.test.ts`
- `scripts/check-test-inventory.mjs` (Vitest 158 -> 159 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-image-upload-ownership.md`
- `docs/agent/handoffs/publish-image-upload-ownership.md`

## Forbidden files and non-goals

- No backend, API, HTTP client, upload endpoint, auth, route, server,
  deployment, or production changes.
- No `PublishView`, `PublishComposer`, `PublishImagePreview`, Map, Profile,
  session snapshot, or F2e scope-transaction change.
- No AbortController, true network cancellation, remote orphan deletion,
  compression, EXIF handling, chunked/parallel upload, retry/backoff, or byte
  progress redesign.
- No immutable submit snapshot or response-preview fix; that is F2g.
- No global/cross-tab auth epoch or claim that mounted account switching is
  now safe.
- No AI image-trigger policy change and no removal of existing E2E fixmes.
- No dependency or package-script change.
- No file outside the allowed list.

## Test-first matrix

The new behavior suite uses injected deferred upload promises and injected
object-URL functions. It must never call a real network or browser service.

- A pending -> remove A with B remaining -> A late result ignored, B uploads
  once, and projections contain only B.
- A complete/B pending/C queued -> remove B -> final URLs are A/C in order and
  never contain B.
- B pending -> remove A -> B/C keep their identities and order.
- A pending -> append B/C -> each file uploads exactly once in selection order.
- A pending -> reset -> add B -> B starts immediately; late A success, failure,
  and `finally` cannot affect B URL, error, or busy state.
- Reset before adding B but after A returns still cannot make A count as B.
- Current-generation failure uses `ERROR_PUBLISH_IMAGE`, releases busy, and
  leaves validation incomplete until the failed entry is removed.
- Reset/disposal and removal revoke each accepted preview exactly once; stale
  completion performs no extra revoke.
- Identical name/size/lastModified files receive distinct IDs and results.
- Stable happy path preserves the existing sequential upload behavior and
  flat `usePublishDraft` public surface.
- Structure coverage proves `usePublishDraft` delegates selection, removal,
  reset, and disposal to the new owner and no longer writes remote URLs by
  numeric index.

## Acceptance criteria

- [ ] Old implementation fails the focused ownership/race tests for the
      intended stale-index and stale-generation reasons.
- [ ] Single-entry state is the only upload ownership source.
- [ ] All removal, append, reset, and disposal matrix cases pass.
- [ ] Existing image validation, AI, F2d location, F2e scope reset, submit, and
      9-image-limit tests do not regress.
- [ ] Vitest inventory is exactly 159; Node structure inventory remains 65.
- [ ] Typecheck, build, sanitizer, smoke, focused tests, and full
      `npm run verify` pass.
- [ ] Independent review records acceptance and no blocking finding remains.
- [ ] Only allowed files change; no network, production, push, merge, or
      deployment action occurs.

## Data, compatibility, and migration

No migration. The authoritative entries are component-memory state only.
HTTP request shape, final `imageUrl/imageUrls`, account-scoped session draft
format, and backend data remain unchanged. Existing consumers continue to read
the same flat refs.

An already completed upload whose owner is later removed may remain as an
unreferenced server asset. F2f prevents the client from publishing it but does
not introduce server-side deletion or retention policy.

## Rollback

Revert the bounded F2f runtime, tests, inventory, and documentation commits.
No database, Redis, browser-storage, server asset, API, or deployed-state
migration needs reversal.

## Validation commands

```bash
npx vitest run \
  tests/publish/usePublishImageUploads.test.ts \
  tests/phase0/phase3-contract.test.ts \
  tests/publish/publishImageValidation.test.ts \
  tests/publish/usePublishAiDraft.test.ts \
  tests/publish/usePublishDraftSession.test.ts \
  tests/publish/usePublishSubmitIdempotency.test.ts
npm run build
npm run verify
```
