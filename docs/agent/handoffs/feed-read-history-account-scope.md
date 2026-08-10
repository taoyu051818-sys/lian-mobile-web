# Handoff: Feed read-history account scope

## Status

Locally accepted on 2026-08-10. The implementation is commit `05a0fe8` on
`codex/audit-f3b-read-history-scope`. The initial task contract is `373e292`,
its lifecycle refinements are `a098c1f` and `e53ac6c`, and the red-test commits
are `8932df8` and `ee28ade`. None of these commits has been pushed, merged, or
deployed. No server, credential, production, browser automation, or external
network access was used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F3a acceptance `2bb52f6`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The old browser key `lian.readHistory` mixed account A, account B, and guest
history on a shared browser. Feed sent that global list with public requests,
and Profile posted it to whichever account was currently authenticated.

A storage rename alone was insufficient. Feed could resolve old A ownership
after unmount and send A IDs with B's newer cookie. Profile could let a late A
request repopulate guest/B state, reuse A IDs after a 401 refreshed to B, or
replace the user without remounting account-owned child components.

## What changed

- Read-history helpers now require an explicit guest or account scope.
- New keys are `lian.readHistory.v2:guest` and
  `lian.readHistory.v2:account:<encoded userId>`.
- The unowned legacy key remains byte-for-byte untouched and is never guessed
  into a v2 owner.
- Feed resolves `/api/auth/me` before its first read-history-aware request.
  Explicit `null` is guest; a valid ID is account; lookup error or missing ID
  is unavailable and loads Feed without a `read` query.
- Owner-resolution-time reset/tab/filter calls share one logical completion;
  only the latest request generation performs a physical Feed request, and all
  callers settle with that request.
- Feed unmount disposes owner and request generations. Late identity or Feed
  responses cannot read history or commit items, pagination, errors, or busy
  state.
- Profile derives history IDs from the current user for every physical attempt.
  `refreshCurrentSession()` returns a candidate without mutating live identity.
- A-to-B refresh performs list reset, external account presentation reset,
  `user = B`, and a new B-owned request in that order. Same-stable-ID refresh
  updates the user without clearing the current collection.
- Missing stable IDs never prove same-account ownership and take the
  conservative reset path.
- The authenticated Profile subtree is keyed by proven account ownership (and
  an unowned generation), so Stats, Rewards, ServerChan, Settings, and other
  mount-loaded children cannot retain A state under B.
- Raised the Vitest file inventory from 162 to 164. Node inventory remains 65.

## Storage and migration

There is no server, API, database, or Redis migration. Browser migration is a
deliberate safe default:

- preserve `lian.readHistory` unchanged;
- ignore it because its owner cannot be proven;
- begin each v2 scope empty;
- keep v2 keys on rollback because old code does not read them.

Users lose one-time visibility of the unowned legacy history after upgrade.
An explicit user-controlled import could be designed later, but F3b must not
silently assign mixed history to an account or guest.

## Test evidence

- The first red matrix had 27 intended failures and 34 passing guards. Existing
  F3a Feed identity/request-race tests stayed green.
- Review added four discriminating boundaries before acceptance:
  - dispose after a Feed request has already started;
  - every resolving caller waits for the latest physical request;
  - two missing-ID candidates cannot be treated as the same account;
  - a real account change remounts the full authenticated Profile subtree.
- Final focused matrix: 8 Vitest files / 65 tests passed.
- Two affected Node structure files: 46/46 tests passed.
- Full `npm run verify` passed in 100.3 seconds:
  - 164 Vitest files / 4,112 tests;
  - 65 Node structure files / 820 tests;
  - typecheck, lint, production build, HTML sanitizer, runtime guards, and
    loopback smoke all passed;
  - lint retained only three pre-existing warnings.
- Three independent reviewers recorded `ACCEPT` or `ACCEPT_WITH_NOTES` with no
  blocking finding after the final fixes.

## Files changed

Runtime:

- `src/platform/browser-storage.ts`
- `src/features/feed/useFeedData.ts`
- `src/features/feed/FeedView.vue`
- `src/features/profile/useProfileSession.ts`
- `src/features/profile/useProfileTabs.ts`
- `src/features/profile/ProfileView.vue`

Tests/gates:

- `scripts/check-test-inventory.mjs`
- `tests/profile/read-history-storage.test.ts`
- `tests/composables/useFeedData.read-history-scope.test.ts`
- `tests/composables/useFeedData.request-race.test.ts`
- `tests/profile/useProfileTabs.request-race.test.ts`
- `tests/profile/useProfileSession.account-transition.test.ts`
- `tests/profile/profile-view-structure.test.ts`
- `tests/profile/serverchan-settings.structure.test.mjs`
- `tests/profile/settings-block.structure.test.mjs`
- `tests/feed/feedReadHistoryIdNormalization.contract.test.ts`

## Known risks and follow-up

- The transport layer is not aborted. Disposal prevents all late commits, but
  an already-started HTTP request may still finish physically.
- `loadProfile()` bootstrap arbitration outside the history-triggered 401 path
  remains a separate identity-lifecycle follow-up.
- Cross-tab cookie/session mutation, focus/visibility auth epochs, and
  localStorage write locking remain out of scope.
- Read history remains local, unencrypted, device-specific convenience data.
- Server offset pagination still needs a cursor/snapshot contract; F3a only
  prevents duplicate valid identities already returned by the server.
- Feed/Detail reactions, auto-load recovery, explicit request intents, page
  restoration, and truthful bookmark/report/share/context-menu actions remain
  separate Feed batches.

## Rollback

Revert implementation commit `05a0fe8`, red-test commits `8932df8` and
`ee28ade`, task commits `373e292`, `a098c1f`, and `e53ac6c`, plus the following
acceptance commit. Restore Vitest inventory from 164 to 162. The legacy key is
still present for the prior version; v2 keys may remain harmlessly. No server,
database, Redis, or deployed-state cleanup is required.

## Not done

- No endpoint, DTO, auth cookie/session format, backend, cursor, Feed ranking,
  cache, reaction, context-menu, CSS redesign, dependency, or deployment
  change.
- No push, pull request, merge, deployment, production access, server access,
  credential use, network probing, or online browser journey.
