# Handoff: Feed stable item identity merge

## Status

Locally accepted on 2026-08-10. The implementation is commit `70cc4e3` on
`codex/audit-f3a-feed-actions`. The task contract is commit `f6725b0` and the
red-test commit is `7d25543`. None of these commits has been pushed, merged, or
deployed. No server, credential, production, browser automation, or external
network access was used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2h acceptance `66921af`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The Feed client appended every page response directly. A repeated `tid` inside
one response or an overlap between offset pages therefore rendered the same
logical post more than once and produced duplicate Vue keys.

Dynamic Feed data makes overlap normal: an insertion before the page boundary
can move an item from page 1 into page 2; deletions or ranking changes can do
the reverse. The server still needs a durable cursor/snapshot contract, but the
client already keys cards by `tid` and can safely enforce one stable slot for
each valid identity.

## What changed

- Added a local pure merge in `useFeedData`.
- The first positive-integer `tid` establishes the list position.
- A later snapshot with the same `tid` replaces the complete object in that
  position instead of appending or field-merging it.
- New identities append in response order.
- Reset responses merge from an empty base; old tab/filter context is not
  retained.
- The merge remains after the request-generation owner check, so a stale page
  cannot participate in the current list projection.
- Non-positive or non-integer IDs retain their old pass-through behavior. F3a
  does not assign identity semantics to malformed items.
- Raised the Vitest file inventory from 161 to 162.

## Files changed

- `src/features/feed/useFeedData.ts`
- `tests/composables/useFeedData.item-identity.test.ts`
- `scripts/check-test-inventory.mjs`
- `docs/agent/tasks/feed-stable-item-identity-merge.md`
- `docs/CURRENT_STATUS.md`
- `docs/agent/handoffs/feed-stable-item-identity-merge.md`

## API, storage, and migration

None. Feed request count, query parameters, response DTO, server records,
ranking, browser storage, and cache policy are unchanged. Only the in-memory
projection of repeated logical items changes. No migration is required.

## Test evidence

- Against the old implementation, the focused matrix produced exactly two
  intended failures:
  - reset response IDs were `[1, 1, 2]` instead of `[1, 2]`;
  - overlapping pages produced `[1, 2, 2, 3]` instead of `[1, 2, 3]`.
- The red suite kept the reset-context, equal-content/different-ID, and stale
  pagination-generation guards green.
- Independent review found one initial contract drift: the first helper also
  collapsed repeated zero/negative IDs. A new test failed against that helper,
  and the final implementation now restricts identity merge to positive
  integers.
- Final focused matrix: 3 Vitest files / 28 tests passed.
- Full `npm run verify` passed in 98.4 seconds:
  - 162 Vitest files / 4,084 tests;
  - 65 Node structure files / 820 tests;
  - typecheck and production build (643 modules, 72 PWA precache entries);
  - HTML sanitizer and runtime guards;
  - loopback smoke 3/3;
  - lint with zero errors and three pre-existing warnings.
- Two independent reviewers recorded final `ACCEPT` with no blocking finding.

## Known risks and follow-up

- Server offset pagination can still omit an item when content disappears
  before the next page boundary. Client deduplication prevents duplicates but
  cannot reconstruct an item the server never returns. Cursor/snapshot
  pagination is a coordinated backend follow-up.
- Read history is still stored under one device-global key. F3b must introduce
  explicit guest/account/unavailable ownership and also fix Profile late-result
  and 401 account-change races.
- Feed and Detail still lack a canonical reaction/entity reconciliation path.
- Auto-load remains edge-triggered and can miss recovery after detail close or
  cooldown.
- Feed initial load, refresh, context change, pagination, and retry still share
  one broad reset API.
- The context menu still exposes incomplete bookmark/report behavior, uses a
  non-deterministic touch long-press path, and does not reuse the complete share
  helper.
- A keyed card whose body changes under the same `tid` does not currently
  remeasure body clamping because the shell watches only `tid`; this is a
  separate presentation-state follow-up.
- A copied Node test for Feed card normalization has drifted from the production
  adapter. It must be replaced under a separate adapter-contract task.

## Rollback

Revert implementation commit `70cc4e3`, red-test commit `7d25543`, and the
following documentation acceptance commit. Restore the Vitest inventory from
162 to 161. No API, server, database, Redis, browser-storage, or deployed-state
cleanup is required.

## Not done

- No cursor API, ranking, adapter, DTO, invalid-ID normalizer, cache, history,
  reaction, auto-load, context-menu, report, bookmark, share, CSS, or SFC change.
- No push, pull request, merge, deployment, production access, server access,
  credential use, network probing, or online browser journey.
