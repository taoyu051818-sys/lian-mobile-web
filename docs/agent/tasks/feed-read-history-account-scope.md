# Task: Feed read-history account scope

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F3a acceptance `2bb52f6` with implementation `70cc4e3`.
- Working branch: `codex/audit-f3b-read-history-scope`.
- Status: planned; no runtime or test implementation has started.
- The root rules, current status, browser-storage helpers, Feed initialization,
  Profile identity/session/list lifecycle, auth/profile API contracts, and
  current read-history tests were checked from the local accepted baseline.
- Recent online issues and merged pull requests are intentionally not queried
  because the user paused network/security-related activity.
- This is a local browser-state ownership correction. It changes no endpoint,
  request DTO, response DTO, backend, cookie, authentication protocol,
  deployment, or production state.

## Reproduced problem

Every visitor and account currently shares one browser key:

```text
lian.readHistory
```

Feed sends that global list with each request, and Profile posts it to the
current account's `/api/me/history` endpoint. The deterministic cross-account
sequence is:

```text
account A opens post 101
  -> global key contains 101
account A logs out
account B logs in on the same browser
  -> B's Feed and Profile history reuse A's 101
```

Two Profile races make a storage-only rename insufficient:

1. A history request can finish after logout and write A's rows back into the
   guest view because `enterGuestState()` does not advance the list generation.
2. If A's history request receives 401 and session refresh resolves to B, the
   retry currently reuses the `tids` captured for A and sends them to B.

F3b must close the browser key ownership and those two request boundaries in
one coherent batch.

## Product decision

Read history is browser-local convenience data, owned by exactly one explicit
scope:

```ts
type ReadHistoryScope = { kind: "guest" } | { kind: "account"; userId: string };

type FeedHistoryOwner =
  | { status: "resolving" }
  | { status: "ready"; scope: ReadHistoryScope }
  | { status: "unavailable" };
```

Rules:

- `fetchAuthMe() === null` is the only signal that establishes guest scope.
- An authenticated user establishes account scope only when `id` is a
  non-empty trimmed string.
- Auth lookup failure or an authenticated object without a usable ID is
  `unavailable`, never guest.
- Unavailable history ownership must not block public Feed loading; the Feed
  request simply omits `read`, and card opens do not persist local history.
- Each mounted Feed resolves ownership before its first request. Normal in-app
  account changes go through Profile and unmount Feed, so the next Feed mount
  resolves the new owner.
- Profile history is account-only. Guest or missing-ID state supplies no local
  history IDs.
- Every Profile history request attempt derives IDs from the current user. A
  401 retry after identity refresh must not reuse the first attempt's IDs.
- Guest/authenticated Profile boundaries synchronously invalidate the prior
  collection request before changing identity or loading the next account.
- Logout does not delete an account's scoped history. A later login as the
  same account can recover it; another account and guest cannot see it.

## Storage key and migration policy

Use a versioned key family with one key per owner:

```text
lian.readHistory.v2:guest
lian.readHistory.v2:account:<encoded stable userId>
```

The old `lian.readHistory` value has no ownership proof and may already mix
multiple accounts. It must not be assigned automatically to the first account
or to guest.

Migration policy:

- keep the legacy key untouched and ignored;
- start each v2 scope empty;
- never delete or rewrite the legacy key in F3b;
- a future explicit import UI may offer a user-controlled migration, but that
  is outside this batch.

This sacrifices one-time visibility of legacy local history in exchange for a
deterministic no-guess ownership boundary. Rollback remains safe because the
legacy key is preserved.

## Goal and state transitions

### Feed

```text
mounted
  -> resolving owner
     -> explicit guest/account -> load Feed with that scope's read query
     -> unavailable            -> load Feed without read query

card open
  -> ready owner      -> write only that scope
  -> unavailable      -> no-op, still open detail
```

`loadFeed()` remains callable for current internal tests and later refreshes;
`initialize()` owns the first identity resolution plus first reset load.

### Profile

```text
load history attempt
  -> derive scope/tids from current user
  -> 401 -> refresh current session
         -> derive scope/tids again
         -> retry for refreshed owner

guest/authenticated boundary
  -> resetList() / generation++
  -> reset other session-owned state
  -> change/load identity
```

## Required invariants

- A, B, and guest read/write/query independent keys.
- Duplicate writes reorder within one scope without affecting another.
- Each scope keeps the existing 500-entry cap and 50-entry Profile recent
  limit.
- Malformed data or storage exceptions in one scope degrade to empty/no-op.
- The legacy key is ignored and preserved byte-for-byte.
- Blank account IDs cannot construct an account scope.
- Feed never reads or writes guest history before guest identity is explicit.
- Feed auth lookup error still produces a normal Feed request with no `read`.
- A Profile request invalidated by logout/account change cannot write rows or
  loading/error state afterward.
- A 401 refresh from A to B retries with B's IDs.
- Existing F3a identity merge and Feed request-generation behavior remain
  unchanged.

## Allowed files

Runtime:

- `src/platform/browser-storage.ts`
- `src/features/feed/useFeedData.ts`
- `src/features/feed/FeedView.vue`
- `src/features/profile/useProfileTabs.ts`
- `src/features/profile/ProfileView.vue`

Tests and inventory:

- `tests/profile/read-history-storage.test.ts`
- `tests/composables/useFeedData.read-history-scope.test.ts` (new)
- `tests/composables/useFeedData.request-race.test.ts`
- `tests/profile/useProfileTabs.request-race.test.ts`
- `tests/profile/profile-view-structure.test.ts`
- `tests/feed/feedReadHistoryIdNormalization.contract.test.ts`
- `scripts/check-test-inventory.mjs` (Vitest 162 -> 163 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-read-history-account-scope.md`
- `docs/agent/handoffs/feed-read-history-account-scope.md`

## Forbidden files and non-goals

- No `src/api/profile.ts`, `src/api/feed.ts`, auth component, type DTO,
  endpoint, backend/server, cookie, session format, CSS, or dependency change.
- No global auth store/event, cross-tab identity refresh, `storage` event,
  focus/visibility auth epoch, or mounted external cookie-change support.
- No server-backed history, cross-device sync, encryption, TTL, clear-history
  UI, account deletion cleanup, or multi-tab write locking.
- No F3a merge, cursor, Feed request-intent, refresh, auto-load, reaction,
  context-menu, report, bookmark, share, or KeepAlive change.
- No automatic legacy history migration or deletion.
- No E2E call to an online origin, server access, credential use, network
  probing, push, merge, or deployment.
- No file outside the allowed list.

## Test-first matrix

All new behavior is deterministic in-process. No browser server, backend, or
network request is required.

### Browser storage

- A writes 101, B writes 202, guest writes 303; each reads and queries only its
  own value.
- A writes 101 twice; it moves to newest position once, while B is unchanged.
- The 500-entry storage cap and 50-entry recent limit apply independently per
  scope.
- Malformed payload and throwing storage degrade only that call to empty/no-op.
- A seeded legacy key is ignored by A, B, and guest; v2 writes do not modify or
  delete it.
- blank/whitespace account IDs return no scope.

### Feed

- Auth A resolves before the first Feed request; only A IDs enter `read`, and
  card open writes only A.
- Independent A and B mounts read/write separate scopes.
- Explicit auth null uses guest history and never account history.
- Auth reject or a user without ID still loads Feed with no `read`; remember is
  a no-op and does not fall back to guest.
- No Feed request starts before initial owner resolution settles.
- Existing request-generation and F3a identity tests remain green.

### Profile

- User A history request sends A IDs; after changing to B, the next request
  sends only B IDs; null/missing ID sends none.
- A history request pending, followed by `resetList()`, cannot commit A rows or
  clear the newer loading state when it arrives late.
- A history request receives 401; refresh changes the user to B; retry derives
  and sends B IDs instead of A IDs.
- A same-account 401 refresh retains that account's IDs.
- Profile guest and authenticated boundaries call `resetList()` before user
  assignment/load, preserving the existing ServerChan resets.

## Acceptance criteria

- [ ] Old storage tests fail account/guest separation and legacy-ignore cases.
- [ ] Old Feed code fails identity-first initialization and unavailable-owner
      cases.
- [ ] Old Profile code fails logout-late and A-to-B 401 retry cases.
- [ ] Final focused matrix passes with tests importing real production helpers
      and composables rather than copied implementations.
- [ ] Existing Feed request-generation, F3a identity, Profile tab/filter, and
      F1a session-reset tests remain green.
- [ ] Vitest inventory is exactly 163; Node structure inventory remains 65.
- [ ] Typecheck, build, sanitizer, smoke, focused tests, and full
      `npm run verify` pass.
- [ ] Independent review records acceptance and no blocking finding remains.
- [ ] Only allowed files change; no network, production, push, merge, or
      deployment action occurs.

## Risks

- Identity resolution adds one serial `/api/auth/me` request before initial
  Feed load. This batch prefers ownership correctness over sending an early
  read query from an unknown account. A future shared auth bootstrap may remove
  the latency without weakening the boundary.
- Treating auth lookup failure as guest would leak guest history into an
  unknown authenticated session. Mitigation: explicit unavailable state and
  tests asserting no read/write.
- Reusing first-attempt history IDs after 401 could cross accounts. Mitigation:
  rebuild IDs after every successful session refresh.
- Resetting Profile after assigning B could persist a visible A result for one
  tick. Mitigation: invalidate list generation before identity assignment/load
  and assert source order.
- Account ID key encoding may evolve. The v2 prefix makes later versioning
  possible without interpreting old keys.

## Rollback

Revert the bounded F3b runtime, test, inventory, and documentation commits.
Restore the Vitest inventory from 163 to 162. The untouched legacy key remains
available to the prior version; v2 keys can remain harmlessly in localStorage
because rollback code does not read them. No API, server, database, Redis, or
deployed-state cleanup is required.

## Validation commands

```bash
npx vitest run \
  tests/profile/read-history-storage.test.ts \
  tests/composables/useFeedData.read-history-scope.test.ts \
  tests/composables/useFeedData.request-race.test.ts \
  tests/composables/useFeedData.item-identity.test.ts \
  tests/profile/useProfileTabs.request-race.test.ts \
  tests/profile/profile-view-structure.test.ts \
  tests/feed/feedReadHistoryIdNormalization.contract.test.ts
npm run build
npm run verify
```
