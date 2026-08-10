# Task: publish-submit-snapshot-ownership

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F2f acceptance `8e055ca` with implementation `8847203`.
- Working branch: `codex/audit-f2g-publish-submit-snapshot`.
- Online issue creation and duplicate search are intentionally paused. This
  document is the local scope record and must not be described as merged or
  integrated until an authorized operator publishes it.
- Root rules, current status, F2b/F2d/F2e/F2f handoffs, Publish components,
  `usePublishSubmit`, post/event clients, payload builders, and current submit,
  idempotency, event, location, session, upload, and preview tests were checked.
- This is a local in-memory correctness change. It alters no product field,
  HTTP endpoint, DTO, storage key, backend, or deployment contract.

## Reproduced problem

The Publish editor remains mutable while a request is pending. That is current
normal UI behavior: title, body, images, location, tag, visibility, Event,
Merchant, and Trade controls are not disabled by `publishing`.

The request body is assembled before the network wait, but both regular and
Event success paths read live refs again after the response. They also reset
the entire current form unconditionally. The deterministic sequence is:

```text
submit A -> request A pending -> edit current form to B -> response A
```

The result preview can mix A and B, and the success path clears B from memory
and the account-scoped session draft. A scope/reset transition is worse:
F2e already calls `resetPublishAttempt()` before resetting and restoring the
target scope, but that function currently clears only idempotency fields. A
late A success, failure, partial response, or `finally` can therefore write
into B, clear B, resurrect A's retry state, or clear B's busy state.

The current regular-post idempotency rules are otherwise correct: an ambiguous
failure retries the same payload with the same key, a changed payload starts a
new key, and recoverable metadata completion retains its key.

## Product decision

Do not freeze the editor in F2g. A user may continue editing B while A is in
flight. Correctness comes from immutable A state and conditional cleanup:

- A's current, owned result may still be shown;
- A's preview must describe only A;
- B must remain untouched when the live draft no longer matches A;
- explicit reset or scope adoption abandons A completely, so no A result is
  committed to the current page state.

## Goal and state model

Capture every request and user-visible result before the first `await`:

```ts
interface SubmitSnapshot<TRequest> {
  readonly route: "post" | "event";
  readonly fingerprint: string;
  readonly request: Readonly<TRequest>;
  readonly preview: Readonly<PublishActionablePostPreview>;
  readonly locationFallback: string;
  readonly draftOwnership: Readonly<unknown>;
}

interface ActiveSubmitRequest<TRequest> {
  readonly generation: number;
  readonly ticket: number;
  readonly snapshot: SubmitSnapshot<TRequest>;
}
```

Keep physical request ownership separate from the existing logical regular-post
idempotency attempt:

```ts
interface LogicalPublishAttempt {
  key: string;
  payloadSnapshot: Readonly<PublishPayload> | null;
  hasPartialResult: boolean;
}
```

Required invariants:

- Snapshot capture is synchronous and precedes the network call.
- No snapshot retains a Vue ref, source array, or nested source object.
- Snapshot request and preview are deeply copied and frozen.
- Regular and Event request inputs, previews, and location fallback text all
  come from their single captured snapshot.
- `PublishView` supplies an exact, JSON-safe ownership projection for every
  reset-owned raw draft field that is not reliably represented by the wire
  request. It includes raw text/meta fields, Event/Merchant/Trade inputs, AI
  candidates, location search/binding state, image preview URLs, selected and
  uploaded counts/URLs, and upload state. F2f preview URLs distinguish two
  otherwise identical local File selections.
- Every physical request captures one monotonic generation and unique ticket.
- Success, failure, haptic, partial/idempotency state, preview, `lastTid`, form
  reset, and `finally` may commit only for the active generation and ticket.
- `resetPublishAttempt()` abandons the logical idempotency attempt, advances
  response generation, invalidates the active ticket, and releases
  `publishing` without waiting for the physical network request.
- A new B request may start while abandoned A is still physically pending.
  A's later success, failure, or `finally` cannot mutate B.
- Result ownership and regular-post idempotency transitions are separate. When
  a recoverable A is edited into B, B clears A's logical attempt before B
  captures its own request owner; B must not invalidate itself.
- Internal payload-change or confirmed-completion handling calls a dedicated
  `clearLogicalPublishAttempt()` that only clears key/payload/partial state.
  It must never advance response generation, invalidate a ticket, or release
  busy. Only the public `resetPublishAttempt()` performs external abandon.
- The busy guard runs before validation and result clearing, so a duplicate
  submit while a request is active is a true no-op.
- An owned success resets the form only if a fresh live fingerprint still
  equals its submission fingerprint. Reverted-to-equal content may be reset;
  diverged B content is preserved.

## Allowed files

Runtime:

- `src/features/publish/usePublishSubmit.ts`
- `src/features/publish/PublishView.vue` (ownership projection wiring only)

Tests and inventory:

- `tests/publish/usePublishSubmitSnapshotOwnership.test.ts` (new)
- `tests/publish/usePublishSubmitIdempotency.test.ts`
- `tests/publish/usePublishSubmitEventDraftContext.test.ts`
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `tests/publish/publishActionablePreview.structure.test.mjs`
- `scripts/check-test-inventory.mjs` (Vitest 159 -> 160 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-submit-snapshot-ownership.md`
- `docs/agent/handoffs/publish-submit-snapshot-ownership.md`

## Forbidden files and non-goals

- No backend, API client, DTO, event input, HTTP header, route, database,
  Redis, authentication, dependency, deployment, or production change.
- No editor-locking, `PublishComposer`, control-component, or visual redesign.
  The only `PublishView` change is the plain ownership-projection callback.
- No global/cross-tab auth epoch or claim that arbitrary mounted identity
  changes are now safe.
- No true request cancellation, AbortController, retry/backoff UI, or remote
  side-effect reversal.
- No F2b AI trigger change, F2d location/handoff change, F2e session schema
  change, or F2f upload-owner change.
- No Event idempotency invention. Ambiguous Event retry requires a coordinated
  backend attempt contract and remains finding 40/B4.
- No 202 metadata-recovery policy change.
- The separate UI defect where a normal post-reset actionable preview is not
  rendered remains a bounded follow-up. In the diverged A/B case, the existing
  live draft preview may continue to describe B while the stored
  `actionablePost` result subpanel describes A; F2g guarantees that stored A
  result never mixes B fields.
- No file outside the allowed list.

## Test-first matrix

The new suite uses deferred local promises and must never call a real network,
browser, server, or production system.

- Regular A pending -> mutate title, body, image list, location, candidates,
  and Merchant/Trade values -> A response uses only A request and A preview.
- Image ownership uses three explicit B arms after A starts: B upload pending,
  B upload success, and B upload failure with one selected preview but no new
  uploaded URL. None may be cleared by A success.
- Event A pending -> mutate time, capacity, join policy, images, location, and
  candidates -> Event request and preview remain A.
- Owned, unchanged A success writes `lastTid`, message, haptic, snapshot
  preview, resets exactly once, and releases busy.
- Owned A success after editing B writes A's result/preview but never resets B.
- A pending -> explicit/scope reset -> seed B -> A success: no A result,
  partial state, haptic, reset, or busy mutation.
- The same sequence with A failure and recoverable partial response is also
  silent and cannot resurrect A's logical retry state.
- Owned recoverable A may land after B edits without resetting B. B submit then
  clears A's logical/result state before capturing B's owner, keeps busy true,
  rejects duplicate submit as a no-op, and uses a new key. The same transition
  from a regular partial A into Event B must not self-invalidate.
- A pending -> reset -> B pending -> A settles first: A `finally` cannot clear
  B busy; B result remains authoritative after either settle order.
- Duplicate submit while `publishing=true` performs no validation mutation,
  result clearing, key generation, request, or haptic.
- Same-payload ambiguous failure continues to reuse one key; changed payload,
  explicit reset, and confirmed completion continue to rotate it.
- F2e structure coverage proves scope invalidation still happens before form
  reset/restore; F2f image projections are copied rather than retained.
- Manual reset coverage proves a pre-open confirmation calls external abandon
  before clearing the form. A later stale result cannot repopulate it.

Fingerprint equality is exact draft ownership, not merely normalized wire
equality. The `PublishView` projection records raw title/body/tag/identity,
place and panel/search state, Event/Merchant/Trade fields, AI candidates, and
image preview/upload lifecycle. A user edit that later restores the same raw
projection may be treated as unchanged; normalized-equal but raw-different
content remains B and must be preserved.

## Acceptance criteria

- [x] Old implementation fails the deferred snapshot and owner tests for the
      intended live-ref/reset/stale-result reasons.
- [x] Regular and Event snapshots contain no live source references.
- [x] All success, failure, partial, reset, scope, settle-order, and duplicate
      submit matrix cases pass.
- [x] Existing idempotency, Event, AI, location, account-scope, image-upload,
      actionable-preview-state, and submit tests do not regress.
- [x] Vitest inventory is exactly 160; Node structure inventory remains 65.
- [x] Typecheck, build, sanitizer, smoke, focused tests, and full
      `npm run verify` pass.
- [x] Independent review records acceptance and no blocking finding remains.
- [x] Only allowed files change; no network, production, push, merge, or
      deployment action occurs.

## Data, compatibility, and migration

No migration. Snapshot and request-owner state exist only in the mounted
Publish composable. Existing payloads, idempotency keys, session drafts,
location envelopes, image URLs, Event inputs, and backend data are unchanged.

Client ownership cannot undo an old request that already succeeded on the
server. It only prevents that abandoned request from mutating the current
browser form or result state. Server-side duplicate prevention remains the
responsibility of the existing regular-post key and the future Event contract.

## Rollback

Revert the bounded F2g runtime, tests, inventory, and documentation commits.
No database, Redis, browser-storage, API, or deployed-state migration needs
reversal. Any server publish that completed before rollback remains a normal
server record.

## Validation commands

```bash
npx vitest run \
  tests/publish/usePublishSubmitSnapshotOwnership.test.ts \
  tests/publish/usePublishSubmitIdempotency.test.ts \
  tests/publish/usePublishSubmitEventDraftContext.test.ts \
  tests/publish/usePublishAiDraft.test.ts \
  tests/publish/usePublishDraftSession.test.ts \
  tests/publish/usePublishImageUploads.test.ts \
  tests/publish/usePublishLocationOptions.test.ts \
  tests/publish/publishLocationHandoff.structure.test.ts
node --test \
  tests/publish/publishActionablePreview.structure.test.mjs \
  tests/publish/viewPostEntry.structure.test.mjs
npm run build
npm run verify
```
