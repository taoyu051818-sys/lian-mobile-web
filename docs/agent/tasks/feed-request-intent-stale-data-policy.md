# Task: Feed request intent and stale-data policy

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F3b acceptance `5fdb2db` with implementation `05a0fe8`.
- Working branch: `codex/audit-f3c-feed-request-intents`.
- Status: planned; runtime implementation has not started.
- Current code, root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
  `docs/agent/README.md`, `docs/agent/00_AGENT_RULES.md`, the accepted F3a/F3b
  tasks, available local Feed references, and recent local history were checked.
- Several override filenames still listed by the generic task template no longer
  exist in this repository. The available current code and local reference files
  were used instead.
- Recent online issues and merged pull requests are intentionally not queried
  because the user paused network/security-related activity.
- This is a local frontend request-state correction. It changes no endpoint,
  request DTO, response DTO, backend, browser storage, authentication protocol,
  deployment, or production state.

## Reproduced problem

`useFeedData` currently accepts one boolean:

```ts
loadFeed(reset: boolean)
```

That boolean conflates four different user intents:

```text
initial/context replacement
manual pull-to-refresh
append next page
retry the failed request
```

The conflation creates three deterministic failures:

1. A pull-to-refresh uses `loadFeed(true)`. It hides the existing list and, on
   failure, clears every previously loaded item. A transient refresh failure
   destroys a good multi-page snapshot.
2. An append failure preserves page 1, but the only error action also calls
   `loadFeed(true)`. The advertised retry requests page 1 and replaces the
   list instead of retrying the failed page.
3. After an append failure, `loadingMore` becomes false and
   `canAutoLoadMore` becomes true again. A later intersection callback can
   silently repeat the failed page before the user chooses to retry.

F3a already owns stable positive-`tid` merging. F3b already owns history
scope, owner resolution, shared logical completion, request generation, and
dispose. F3c must add intent semantics without weakening either boundary.

## Product decision

Every physical Feed request has one immutable descriptor:

```ts
type FeedRequestKind = "replace" | "refresh" | "append";

type FeedRequestDescriptor = Readonly<{
  kind: FeedRequestKind;
  tab: string;
  visibility?: readonly AudienceVisibility[];
  page: number;
}>;
```

The descriptor is captured before the first `await`. It is the sole source for
`kind`, `tab`, `visibility`, `page`, commit policy, failure policy, and retry.
The F3b `read` value is deliberately not stored in this descriptor: only after
owner resolution and a fresh lifecycle/request-generation check may the
current mounted guest/account owner attach its scoped read query. Retry never
stores, guesses, or reuses an earlier owner's read value.

Visibility is canonicalized as a set: enum members are deduplicated, sorted
into a cloned frozen array, and compared by members rather than Set insertion
order. An empty set is the canonical `undefined` query value. Mutating the
caller's Set after selection or admission cannot change the request or its
retry descriptor. The request `limit` remains the existing `PAGE_SIZE`
constant; it is not mutable descriptor state.

### Replace

Used for first load and real tab/filter context changes.

- page is always 1;
- old-context items are cleared at admission;
- `loading=true` is the blocking busy state;
- success atomically installs a deduplicated response from an empty base;
- failure remains an empty current context and records the exact descriptor;
- retry sends that same page-1 context.

### Refresh

Used only for explicit pull-to-refresh.

- page is always 1;
- existing items, page, and `hasMore` stay visible and unchanged while pending;
- `refreshing=true` and `loading=false`;
- success atomically installs a deduplicated response from an empty base;
- failure preserves the complete prior snapshot and records the exact
  descriptor;
- retry keeps the same stale-while-refresh behavior.

### Append

Used for the next page.

- page is captured from the current committed `page`;
- existing items, page, and `hasMore` stay unchanged while pending;
- `loadingMore=true`;
- success merges through the accepted F3a first-slot/latest-snapshot policy;
- failure preserves the committed snapshot and records the exact descriptor;
- retry sends the same tab, visibility, and page.

### Retry

`retryFailedRequest()` never infers a new intent. It first copies the stored
failed descriptor. A different admitted intent clears the old visible error
and failed record before the new request begins. Exact retry deliberately keeps
the current error and failed descriptor visible while pending so the existing
InlineError action can show `requestPending`; success clears both, while
failure replaces the error and keeps the same current descriptor retryable.

An append failure pauses automatic loading. A manual error action or load-more
button may retry that append descriptor; automatic intersection callbacks may
not. This relies on the existing sentinel path checking `canAutoLoadMore`
before it emits `triggerLoadMore`; F3c does not change sentinel observation or
cooldown behavior. Refresh/replace failures are retried through the error
action.

## Public state and semantic actions

The composable exposes semantic actions instead of boolean call sites:

```text
initialize()                 -> replace(initial)
refreshFeed()                -> refresh
switchTab(tabId)             -> replace(context) when tab actually changes
setSelectedVisibilities(set) -> replace(context) when the normalized set changes
triggerLoadMore()            -> append, or explicit retry of a failed append
retryFailedRequest()         -> exact failed descriptor
```

`loadFeed` may remain exposed for focused composable tests, but it may accept
only an explicit immutable `FeedRequestKind` string. The descriptor itself is
always built internally as a defensive value copy and frozen before the first
`await`; callers never supply or retain its object identity. `loadFeed` must not
keep a boolean/default or accept a live descriptor object whose meaning can
drift.

Every semantic action that may admit a request returns `Promise<void>`:
`initialize`, `refreshFeed`, `switchTab`, `setSelectedVisibilities`,
`triggerLoadMore`, `retryFailedRequest`, and any explicit `loadFeed` test
surface. Vue templates may ignore the Promise, but request-ownership tests must
be able to await it.

After owner resolution, that Promise represents logical ownership, not the
uncancellable transport lifetime: when a newer replace/refresh supersedes a
started request, the older semantic Promise settles promptly while its physical
fetch drains behind generation/lifecycle guards. This lets
`usePullToRefresh` end an obsolete gesture spinner without granting the stale
transport any commit authority. During unresolved F3b owner lookup, the
existing cohort rule is stronger: every superseded semantic Promise waits for
the one latest physical request or dispose.

A resolving cohort remains a cohort until its shared completion settles, not
merely until auth returns. If auth resolves, the cohort's physical request
starts, and then a new context replace is admitted before completion, that new
request takes ownership of the same cohort. Earlier initialize/refresh Promises
wait for the new latest request; stale physical `finally` cannot settle them
early or leave them hanging.

Busy state is split:

```text
loading      = blocking replace
refreshing   = stale-while-refresh
loadingMore  = append
requestPending = loading || refreshing || loadingMore
```

Only the current request generation may commit items, tabs, pagination,
error, failed descriptor, or busy flags.

`isEmpty` additionally requires `requestPending=false`; a strict refresh of an
empty committed snapshot must not render the ordinary empty state while the
request is pending.

Admission precedence is explicit:

- a real tab/filter replace may supersede any older request;
- a refresh may supersede an older replace or append, but a duplicate refresh
  reuses or waits for the current refresh instead of starting another request;
- append is rejected while any request is pending; retry is also rejected
  except when it is the exact duplicate of the current retry, in which case it
  returns that current logical completion without changing state;
- after an append failure, a no-longer-busy manual `triggerLoadMore()` retries
  that exact append descriptor, while the disabled sentinel cannot invoke it.

Exact duplicate refresh is a strict single-flight exception: it returns the
current refresh logical completion without advancing request generation or
changing busy, error, failed descriptor, items, or pagination state.

If an explicit refresh supersedes initialization while F3b owner resolution is
still pending, its strict intent remains `refresh`: the empty committed
snapshot stays empty, `refreshing=true`, and `loading=false`. F3c does not
silently reinterpret an admitted intent based on item count.

## Required invariants

- Pull-to-refresh never clears an already committed list on admission or
  failure.
- Refresh success replaces the list atomically and still deduplicates duplicate
  positive `tid` values through F3a.
- Real tab/filter changes never display items from the old context.
- Append failure preserves prior pages and pauses automatic loading.
- Append retry sends the same failed page, not page 1.
- Append admission while replace/refresh/append/retry is pending is a no-op and
  cannot supersede that current request.
- Initial/context/refresh retry sends page 1 with the captured tab/filter.
- The error action reflects any current request busy state, not only `loading`.
- Retry feedback is the existing InlineError action spinner. F3c does not reuse
  the pull-gesture capsule for a button retry. A pull gesture's own Promise must
  nevertheless settle promptly when its refresh is superseded so its local
  indicator cannot remain tied to a stale transport.
- Same-tab and equal-visibility selections are no-ops and create no request.
- Same-tab/equal-visibility no-ops also preserve the current error and failed
  descriptor rather than accidentally consuming retry ownership.
- A newer replace or refresh can supersede an older physical request; stale
  success, failure, and `finally` cannot change the newer intent's state.
- F3a `mergeFeedItems([], incoming)` is used for replace/refresh success;
  `mergeFeedItems(currentItems, incoming)` is used for append success.
- Non-positive IDs retain the accepted F3a pass-through policy.
- F3b guest/account/unavailable read-history ownership is unchanged.
- While F3b owner resolution is pending, all intents retain one shared logical
  completion: superseded callers settle only after the latest physical request
  or dispose.
- F3b dispose invalidates replace, refresh, append, retry, auth resolution, and
  every late `catch`/`finally` commit.
- No request is physically aborted in F3c; late transport may drain, but it
  cannot mutate current state.

## Allowed files

Runtime:

- `src/features/feed/useFeedData.ts`
- `src/features/feed/FeedView.vue`

Tests and inventory:

- `tests/composables/useFeedData.request-intent.test.ts` (new)
- `tests/composables/useFeedData.item-identity.test.ts`
- `tests/composables/useFeedData.request-race.test.ts`
- `tests/composables/useFeedData.read-history-scope.test.ts`
- `tests/feed/feedReadHistoryIdNormalization.contract.test.ts`
- `tests/phase0/phase4-deeplink-contract.test.ts` (update only the stale
  `async function loadFeed` structural matcher so a direct Promise-returning
  semantic action remains covered)
- `tests/ui/InlineError.test.ts`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-request-intent-stale-data-policy.md`
- `docs/agent/handoffs/feed-request-intent-stale-data-policy.md`

## Forbidden files and non-goals

- No file outside the exact Allowed files list.
- No backend, API adapter, DTO, route, query parameter, auth, profile, storage,
  service worker, dependency, build, deployment, or production change.
- No cursor/snapshot API, request abort, general/cross-intent coalescing,
  no-progress detector, page cache, scroll restoration, or KeepAlive. The only
  post-owner single-flight exceptions are idempotent `initialize()`, exact
  duplicate refresh, and exact duplicate retry.
- No auto-load sentinel level recovery. That is F3d and must use a bounded
  continuous-intersection policy.
- No Feed/Detail reaction reconciliation, save/share/report behavior, long-press
  behavior, Club-card parity, menu ownership, CSS, or visual redesign.
- No online E2E or production browser session.

## Test-first matrix

The old implementation must fail the new behavior suite before runtime edits.

1. Load two committed pages, start refresh, then reject:
   items/page/`hasMore` stay unchanged throughout; `refreshing` is the only busy
   flag; retry sends the same page-1 context; a later success atomically replaces.
2. Change tab or visibility:
   admission clears old-context items and enters blocking `loading`; failure
   stays on the new empty context; retry uses the new context and page 1.
3. Fail page 2 append:
   page-1 items/page/`hasMore` remain; automatic loading is false; retry sends
   page 2; success applies F3a overlap merge in the original slot.
4. Fail initial load:
   empty current context records an exact page-1 retry.
5. Append pending then refresh/context replacement, and refresh pending then
   tab/filter replacement: old semantic action settles promptly after
   supersession; old success/error/finally cannot commit or clear the new busy
   flag. Attempting append while refresh is pending is a no-op and does not
   change refresh state.
6. While F3b identity is resolving, initialize plus refresh/tab/filter retains
   exactly one latest physical request. All captured semantic-action promises
   remain pending until that latest request succeeds or fails. On latest
   rejection the current error/failed descriptor is committed, every caller
   settles, and all busy flags clear.
7. If auth owner resolution never returns, `dispose()` settles `initialize()`
   and all resolving semantic-action promises without resolving auth, performs
   zero Feed/read work, and clears all three busy flags. For each already-started
   replace, refresh, append, and exact retry, use a deliberately never-settling
   physical fetch: `dispose()` must still promptly settle every semantic Promise
   and clear all three busy flags without resolving transport. Separate late
   resolve and reject cases then prove result/error/finally cannot mutate
   disposed state.
8. Same tab and normalized-equal visibility sets issue no request and preserve
   any existing failure. Reverse insertion order is equal. Mutating the caller's
   Set while owner resolution is pending cannot change the eventual physical
   payload or retry descriptor.
9. During deferred refresh retry the error remains rendered and
   `requestPending` plus `refreshing` are true; during deferred append retry the
   error remains rendered and `requestPending` plus `loadingMore` are true.
   Success clears the error/failed descriptor; repeated failure updates the
   message and remains retryable.
10. Existing F3a item-identity, F3b read-history ownership, and request-generation
    suites remain green after adapting only the explicit call shape.
11. FeedView structure proves pull-to-refresh uses `refreshFeed`, InlineError
    uses `retryFailedRequest`, and its loading state is `requestPending`.
12. A strict refresh with no committed items keeps `isEmpty=false` while
    pending; ordinary empty state is evaluated only after the request settles.
13. Two refresh calls while the first refresh is pending start one physical
    request; both return the same logical completion, request generation and all
    visible state remain unchanged on the duplicate, and both settle together.
14. After the owner-ready initialization cohort has fully completed, start an
    ordinary pending blocking replace and supersede it with strict empty
    refresh. The old semantic Promise settles promptly, state switches
    exclusively to `refreshing`, `isEmpty=false`, and every late replace
    commit/finally write is rejected. This ordinary non-cohort rule does not
    weaken the stronger active-cohort rule in #17.
15. Dispose during a deferred exact retry immediately clears the kind-specific
    busy flag and `requestPending`; a late retry rejection cannot replace the
    pre-dispose error or restore retry/busy state.
16. Initial/context replace retry keeps InlineError visible with `loading` and
    `requestPending`; rapid duplicate retry calls start one physical request and
    share its logical completion.
17. Resolve auth and let the resolving cohort's refresh physical request start;
    before it settles, admit tab B replace. The original initialize/refresh
    Promises remain pending, B becomes the sole latest request, stale refresh
    completion cannot settle or mutate the cohort, and all callers settle with
    B success/failure or dispose.

## Validation commands

Focused red/green validation:

```bash
npx vitest run \
  tests/composables/useFeedData.request-intent.test.ts \
  tests/composables/useFeedData.item-identity.test.ts \
  tests/composables/useFeedData.request-race.test.ts \
  tests/composables/useFeedData.read-history-scope.test.ts \
  tests/feed/feedReadHistoryIdNormalization.contract.test.ts \
  tests/phase0/phase4-deeplink-contract.test.ts \
  tests/ui/InlineError.test.ts
node --test tests/feed/feedAutoLoadSentinel.structure.test.mjs
npm run check:test-inventory
npm run build
npm run verify
```

Also run Prettier, ESLint, TypeScript, and `git diff --check` on the allowed
files before review. A new Vitest file raises inventory from 164 to 165; Node
inventory remains 65.

## Risks and mitigations

- Risk: intent refactor weakens F3b resolving completion. Mitigation: keep the
  same lifecycle/request guards and add deferred resolving-intent tests.
- Risk: refresh accidentally merges stale pages. Mitigation: refresh success
  always uses an empty merge base and installs response pagination atomically.
- Risk: retry silently follows changed context. Mitigation: store an immutable
  descriptor and clear it whenever a different context is admitted.
- Risk: append failure creates an automatic retry loop. Mitigation:
  `canAutoLoadMore` additionally requires no failed descriptor.
- Risk: boolean compatibility preserves the original ambiguity. Mitigation:
  remove boolean/default call sites and enforce explicit semantic actions.

## Data, migration, compatibility, and rollback

- No API, browser-storage, database, Redis, service worker, or schema migration.
- Request payload fields and response DTO interpretation remain unchanged.
- Existing committed Feed items are in-memory only; the change affects when a
  current instance replaces or preserves them.
- Rollback reverts the bounded runtime/tests/docs commits and changes inventory
  from 165 back to 164. No client or server data cleanup is required.

## Acceptance authority

- The implementation thread may report completion but cannot accept the lane.
- At least two independent reviewers must inspect request ownership, F3a/F3b
  compatibility, exact retry descriptors, test discrimination, and allowed-file
  scope.
- Only the primary review thread may record F3c as locally accepted.
- No push, merge, deployment, production mutation, or online validation is
  authorized by this task.
