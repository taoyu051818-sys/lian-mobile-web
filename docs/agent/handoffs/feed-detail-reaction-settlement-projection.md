# Handoff: Detail reaction settlements projected into the mounted Feed

## Status

Locally accepted on 2026-08-10 on
`codex/audit-f3f-feed-detail-like-reconciliation`. The task is `bb33ef1`, the
red-test baseline is `6fc4bdd`, the required feature-public-surface
clarification is `d10090f`, the external-owner test strengthening is
`e2fd712`, and the runtime implementation is `e804e46`. None has been pushed,
merged, or deployed. No credential, production, online browser,
remote/backend server, or external network access was used; the only server
process was the local loopback preview used by the repository smoke checks.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F3e acceptance `f031b22`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The App-level Detail surface opens over the still-mounted Feed. A successful
Like or Save updated only Detail refs, so closing Detail revealed an old Feed
card and reset F3e's truthful Bookmark menu from stale data. A simple event
patch was insufficient because a Feed request already in transport could
return afterward and replace that patch with an older reaction snapshot.

Detail ownership was also tid-only. A same-tid Detail reload or A-to-B-to-A
sequence could let old work pass the post-id check and disturb the new
snapshot's state, feedback, or busy ownership.

## What changed

- A feature-public, process-local settlement channel now exposes one production
  singleton and hermetic factories. It assigns monotonic sequences, freezes
  normalized Like/Save events, snapshots listeners, isolates listener errors,
  supports idempotent unsubscribe, and stores no replay history.
- `usePostReactions` uses a snapshot generation plus independent Like and Save
  tickets. Every reset, including same-tid reset, invalidates older work; Vue
  scope disposal is terminal. Only a current action completion may commit or
  roll back, show its matching feedback, or release its own busy state; only a
  current authoritative success publishes.
- `useFeedData` subscribes when its instance is created. A current settlement
  shallow-replaces only the matching item, preserving slot order, transport
  fields, and nonmatching identities so the F3e Bookmark owner rebases.
- Each physical Feed request captures the channel sequence immediately before
  calling the transport. Only settlements after that boundary are retained in
  that request's private Like/Save projection and re-applied after the normal
  full-snapshot merge.
- Events before physical start do not become sticky state; a later response may
  correct them. Failed, superseded, settled, and disposed requests discard
  their private projections. Feed disposal first makes the instance terminal
  and unsubscribes, then advances request generations and clears request-local
  state; remount has no replay.

## Test evidence

- Original red baseline: 23 intended F3f failures with 76 existing guards
  passing. Review later added a same-generation external-owner predicate and
  current Save rollback discriminator.
- Final F3f behavior: 24/24; combined focused regression: 6 files / 100 tests.
- Full `npm run verify` passed in 94.8 seconds:
  - 168 Vitest files / 4,209 tests;
  - 65 Node structure files / 824 tests;
  - production build: 646 transformed modules / PWA 71 entries;
  - repository guards, typecheck, formatting, lint, HTML sanitizer, and 3/3
    loopback smoke checks passed;
  - lint retained only the existing warnings.
- Two independent reviewers recorded `ACCEPT` with no remaining blocker.

## Files changed

Runtime:

- `src/features/reactions/index.ts`
- `src/features/reactions/postReactionSettlements.ts`
- `src/features/detail/usePostReactions.ts`
- `src/features/feed/useFeedData.ts`

Tests and inventory:

- `tests/composables/feedDetailReactionSettlement.test.ts`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-detail-reaction-settlement-projection.md`
- `docs/agent/handoffs/feed-detail-reaction-settlement-projection.md`

## Data, migration, and compatibility

There is no endpoint, request-envelope, database, Redis, browser-storage,
service-worker, response DTO, or schema migration. Existing Like/Save requests
and responses are unchanged. The settlement channel is memory-only and empty
after reload. Optional injected ports are internal backward-compatible test
seams; production callers share the exported singleton.

## Known risks and follow-up

- This is a mounted-Feed projection, not a durable canonical entity store. A
  later physical response that starts after a settlement is intentionally
  authoritative.
- Feed-card Footer likes and F3e context-menu saves still do not publish into
  this channel. Profile collections, reload persistence, and cross-tab
  reconciliation remain separate work.
- A same-mounted-instance external account/session change still lacks a shared
  auth epoch. No account identity is guessed from viewer-specific reactions.
- Physical requests already in flight may drain, but stale generations and
  stale request-local projections have no commit authority.
- No online or physical-device browser journey was run; validation was
  hermetic and loopback-only.

## Rollback

Revert implementation `e804e46`, test strengthening `e2fd712`, public-surface
clarification `d10090f`, red tests `6fc4bdd`, task `bb33ef1`, and the following
acceptance-document commit. Restore Vitest inventory from 168 to 167. No
database, Redis, browser-storage, service-worker, server, or deployed-state
cleanup is required. Successful reaction requests are ordinary user data and
must not be reversed as part of a code rollback.

## Not done

- No Feed-origin reaction publisher, Profile collection synchronization,
  durable cache, replay, cross-tab transport, account epoch, cursor, page
  restoration, API/backend, auth, storage, dependency, service-worker, or UI
  redesign change.
- No push, pull request, merge, deployment, production access, credential use,
  remote/backend server access, network probing, or online browser journey.
