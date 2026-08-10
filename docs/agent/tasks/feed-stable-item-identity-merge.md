# Task: Feed stable item identity merge

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F2h baseline `66921af`.
- Working branch: `codex/audit-f3a-feed-actions`.
- Locally accepted on 2026-08-10; implementation commit `70cc4e3`.
- The root rules, current status, Feed view, Feed data composable, Feed API
  adapter, Feed item types, list rendering, pagination tests, and current test
  inventory were checked from the local accepted baseline.
- Three independent local reviewers checked Feed request lifecycle, actions,
  and test coverage. Recent online issues and merged pull requests are
  intentionally not queried because the user paused network/security-related
  activity.
- This is a local client projection correction. It changes no endpoint, query,
  DTO, ranking rule, persistence key, backend, authentication, deployment, or
  production state.

## Reproduced problem

`useFeedData` appends every pagination response directly:

```ts
items.value = [...items.value, ...response.items];
```

The list renders cards by `tid`, but neither a reset response nor an appended
page is merged by that identity. An offset/page backend can legitimately
return an overlapping item when the Feed changes between requests. A single
response may also contain duplicate snapshots. The current client then
renders the same logical post more than once and creates duplicate Vue keys.

The deterministic examples are:

```text
reset response: [1-old, 1-latest, 2]
current result: [1-old, 1-latest, 2]

page 1: [1, 2-old]
page 2: [2-latest, 3]
current result: [1, 2-old, 2-latest, 3]
```

The server-side long-term answer is a stable snapshot/cursor contract. F3a
does not invent that API. It adds the bounded client invariant that a valid
normalized `tid` has one stable list slot.

## Product decision and merge policy

Treat `FeedItem.tid` as the logical identity already used by the renderer:

- one positive normalized `tid` may occupy at most one list slot;
- the first occurrence establishes the slot order;
- a later snapshot with the same `tid` replaces the item in that slot;
- new identities append in incoming order;
- duplicates inside one response follow the same first-slot/last-snapshot
  rule;
- reset starts from an empty list, so an old tab/filter context is never
  merged into the new context;
- different identities are never merged merely because their visible content
  is equal.

The adapter already supplies numeric `tid` values. Validation or dropping of
non-positive IDs is not changed in this batch.

## Goal and state model

Introduce a small identity merge inside `useFeedData` and use it for both reset
and pagination commits:

```text
base list + incoming response
        |
        v
first slot by tid + latest snapshot by tid
        |
        v
stable unique FeedItem[]
```

Required invariants:

- reset response duplicates collapse before publication;
- page overlap updates the original slot and does not append a duplicate;
- a later snapshot replaces all fields of the earlier item;
- new items preserve the incoming order;
- a reset response replaces the previous context completely;
- current request-generation ownership remains unchanged;
- `tabs`, `loading`, `errorMessage`, `page`, `hasMore`, `nextPage`, visibility,
  read-history query, and detail behavior remain unchanged.

## Feed audit queue after F3a

The broader read-only Feed audit found separate work that must not be hidden by
this narrow fix:

1. server-backed cursor/snapshot pagination and no-progress protection;
2. account-scoped read history across login/logout/account changes;
3. canonical reaction/entity reconciliation between Feed and Detail;
4. level-triggered auto-load recovery after detail close or cooldown;
5. explicit request intents for initial load, refresh, context change,
   pagination, and retry, including stale-content preservation and request
   coalescing/cancellation;
6. page/filter/scroll restoration with account ownership;
7. truthful context actions: deterministic long press, control exclusion,
   existing share helper reuse, server-backed bookmark state, and a real
   report intent.

These are follow-up batches. F3a only establishes stable item identity at the
current client merge boundary.

## Allowed files

Runtime:

- `src/features/feed/useFeedData.ts`

Tests and inventory:

- `tests/composables/useFeedData.item-identity.test.ts` (new)
- `scripts/check-test-inventory.mjs` (Vitest 161 -> 162 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-stable-item-identity-merge.md`
- `docs/agent/handoffs/feed-stable-item-identity-merge.md`

## Forbidden files and non-goals

- No `src/api/feed.ts`, `src/types/feed.ts`, Feed SFC, CSS, existing race test,
  E2E, backend/server, endpoint, query, or response-shape change.
- No cursor, snapshot token, ranking, cache, read-history scope, reaction bus,
  auto-load, KeepAlive, or request-intent redesign.
- No invalid-`tid` policy change and no content-based deduplication.
- No copied test implementation. New behavior tests must import and exercise
  the production composable.
- No dependency, build, authentication, deployment, or production change.
- No online origin, server access, credential use, network probing, push,
  merge, or deployment.
- No file outside the allowed list.

## Test-first matrix

The new Vitest file mocks only the Feed transport and browser-storage edge. It
calls the real `useFeedData` composable.

- Reset response `[1-old, 1-latest, 2]` becomes IDs `[1, 2]`; item 1 stays in
  the first slot and contains the latest payload.
- Page 1 `[1, 2-old]`, followed by page 2 `[2-latest, 3]`, becomes IDs
  `[1, 2, 3]`; item 2 stays in its original slot and contains the page-2
  payload.
- Existing content followed by `loadFeed(true)` with `[9]` becomes only `[9]`.
- Different IDs with equal title/body remain separate items.
- A page-2 request superseded by a reset cannot append its overlapping items
  or change the loading flags after it arrives late.
- Pagination still requests page 2 and advances page/hasMore from the response.
- Existing deferred request-generation tests remain unchanged and green.

The first two cases must fail against the old implementation.

## Acceptance criteria

- [x] The old implementation fails the two duplicate-identity behavior cases.
- [x] The minimal merge implementation passes every matrix case.
- [x] The new test imports the production composable and contains no mirrored
      merge implementation or source-regex assertion.
- [x] Existing Feed request-race and adapter tests remain green.
- [x] Vitest inventory is exactly 162; Node structure inventory remains 65.
- [x] Typecheck, build, sanitizer, smoke, focused tests, and full
      `npm run verify` pass.
- [x] Independent review records acceptance and no blocking finding remains.
- [x] Only allowed files change; no network, production, push, merge, or
      deployment action occurs.

## Test-debt note

`tests/feed/normalizeFeedCardTemplate.behavior.test.mjs` mirrors Feed adapter
logic inside the test instead of importing production code. It has already
drifted from the real adapter while both suites remain green. Replacing that
mirror requires a separate adapter-contract decision and is recorded as test
debt; it is not folded into F3a.

## Data, compatibility, and migration

None. Request count, request parameters, response DTO, server records, and
browser storage remain unchanged. Only the client projection of repeated
logical items changes. No migration is required.

## Risks

- Replacing a duplicate in the wrong position could reorder the Feed.
  Mitigation: assert first-slot stability and incoming order for new items.
- Mutating the prior response object could leak state across consumers.
  Mitigation: publish a new array and replace the complete item snapshot.
- A reset could accidentally merge old context state. Mitigation: run the same
  merge from an empty base for reset and assert complete replacement.
- Content-based equality could collapse distinct posts. Mitigation: identity is
  exactly `tid` and equal-content/different-ID is a guard case.

## Rollback

Revert the bounded F3a runtime, test, inventory, and documentation commits. No
API, server, database, Redis, browser-storage, or deployed-state cleanup is
required.

## Validation commands

```bash
npx vitest run \
  tests/composables/useFeedData.item-identity.test.ts \
  tests/composables/useFeedData.request-race.test.ts \
  tests/api/feed.adapter.test.ts
npm run build
npm run verify
```
