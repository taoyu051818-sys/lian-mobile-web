# Task: Mounted Profile reaction-membership consumer

## Status and source

- Decision date: 2026-08-11.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3i head `db45dfa`, including the no-replay
  settlement channel, Feed producers/consumer, and mounted Detail consumer.
- Working branch: `codex/audit-f3j-profile-reaction-membership`.
- Status: accepted locally on 2026-08-11.
- Commit chain: task contract `11b1cc1` -> main red tests and inventory
  `c908a4d` -> cross-tab candidate regression `38afc7f` -> synchronous nested
  request-ownership regression `da98eef` -> runtime implementation `48b8ccc`.
- External/remote network and production access remain paused. This task
  authorizes local frontend code, local commits, and hermetic tests only: no
  push, merge, deployment, production mutation, remote/backend server access,
  credential use, or online browser journey.

## Reproduced problem

The App-level Detail overlay keeps the underlying Profile page mounted.
`useProfileTabs` owns the currently loaded collection, but it does not consume
the authoritative Like/Save settlements introduced in F3f-F3i.

Reachable stale-membership journey:

1. Open Profile and load the `liked` or `saved` tab.
2. Open one row in the App-level Detail overlay; Profile remains mounted below.
3. Confirm Unlike or Unsave in Detail.
4. The authoritative API response publishes a settlement and updates Detail
   plus any other settlement-aware consumer that is mounted at that moment.
5. Close Detail. The row remains in the Profile collection until another
   server request happens.

A second race survives a naive immediate filter:

1. A `liked`/`saved` request physically starts and remains pending.
2. A matching negative settlement removes the current mounted row.
3. The older request returns a response that still contains the row.
4. The current request generation accepts the response and re-adds stale
   membership.

`ProfileListItem` intentionally carries row presentation data but no reaction
booleans. Therefore this batch projects **collection membership**, not hidden
reaction fields and not Profile statistics.

## Product decision

F3j is **authoritative Like/Save settlement -> current mounted Profile
`liked`/`saved` membership projection**.

- A matching authoritative negative settlement removes known matching rows
  immediately from the active committed collection.
- The committed collection owner retains the first removed row object and its
  original slot. A later authoritative positive settlement for the same owner
  and `tid` may restore exactly that known row object at the bounded original
  slot.
- A positive settlement for an unknown/uncaptured `tid` never fabricates a
  `ProfileListItem`, never appends a placeholder, and never starts a request.
- Each physical `fetchProfileTab` call captures a request-local sequence
  boundary immediately before the transport call. Matching later settlements
  overlay only membership on that response so a response already in flight
  cannot undo the newer settlement.
- A settlement issued before a physical call does not replay into that request.
  The later transport is authority, even if a backend cache temporarily returns
  old membership.
- `history`, `posts`, `replies`, `drafts`, `map-contributions`, and `orders`
  ignore settlement membership and do not cache it for a future tab.
- Profile stats (`saved`/`liked` counts) remain server-owned and are not
  incremented/decremented from an event that lacks prior-state/change metadata.
- The established named F3f singleton remains the only production port.
  Optional injection is one hermetic-test seam.

This is process-local and mounted-only. It is not a durable/global Profile
cache and adds no replay, persistence, cross-tab delivery, account identity to
events, server revision, or automatic refetch.

## Public composable surface

Keep every existing caller source-compatible and add one optional structured
port:

```ts
export interface UseProfileTabsOptions {
  user: Ref<ProfileUser | null>;
  enterGuestState: () => void;
  isMissingSessionError: (error: unknown) => boolean;
  refreshCurrentSession: () => Promise<ProfileUser | null>;
  resetAccountPresentation: () => void;
  settlements?: PostReactionSettlementPort;
}

export function useProfileTabs(options: UseProfileTabsOptions): {
  // all existing refs/commands
  dispose: () => void;
};
```

Resolve exactly once during construction:

```ts
const settlements = options.settlements ?? postReactionSettlements;
```

Import the port type and named singleton from the established
`../reactions` public barrel. Do not deep-import the channel implementation,
construct a production channel, reset the singleton, branch on environment or
test state, or pass a settlement prop through `ProfileView`.

Install the instance's one persistent subscriber during construction, before
any public load command can start. Every physical request then reuses callbacks
from that same subscription; it must not create a listener whose lifetime is
left to a transport Promise.

## Account owner token

Each committed collection and physical request captures one account owner
token:

- when `user.id` is a non-empty string, use the normalized stable id;
- guest/null and authenticated users without a stable non-empty id have no
  eligible projection owner.

The token is a local stale-work guard, not event account identity. Membership
capture/overlay requires a stable non-null token. A request that began with a
stable token may commit only while that exact normalized token remains current.
A request that began with no stable token retains the existing generation-based
transport commit behavior, but it never captures events or installs a
membership owner.

This fail-closed rule matches the F3b identity boundary: a transport may still
load the visible collection for a missing-id user, but process-local reaction
events cannot mutate or overlay it without a stable owner.

Install one `flush: "sync"` watcher over the normalized stable account token.
When a stable token changes to a different token or to null, retire
collection/request ownership and advance request
generation before any later callback can commit. The watcher is an internal
ownership fence; existing Profile commands remain responsible for their current
visible list/account reset order. Stop this watcher in terminal disposal.

Normal Profile account transitions already call `resetList`; that command must
retire collection/request ownership and raise a new hard sequence floor before
any B collection is installed. Because settlement payloads contain no account
id, an old-account event published after B is mounted cannot be identified from
payload alone. That external/same-mount auth-epoch gap remains an explicit
non-goal rather than being hidden by a guessed token.

## Committed collection owner

Only an accepted `liked` or `saved` response installs a membership owner. The
owner holds:

- exact owner object identity for ABA-safe cleanup;
- tab and account token;
- one hard `sequenceFloor` captured at installation;
- per-`tid` greatest applied sequence;
- removed-row candidates containing the original `ProfileListItem` object,
  bounded slot, and removal sequence.

Do not install an owner for an empty/manual array before a transport commit, an
irrelevant tab, guest state, error, reset, orders, or a disposed scope.

### Persistent callback branches

The persistent subscriber evaluates two independent branches for every event:

1. **Request capture** first checks only the exact active physical request,
   request boundary/tab/stable-account ownership, valid tid, and matching kind.
   It does not require a committed collection owner. This is mandatory during
   initial load, when the transport can synchronously publish before any list
   owner exists.
2. **Immediate committed-list projection** separately checks the committed
   owner rules below. Absence or mismatch of that owner cannot suppress request
   capture, and absence/mismatch of a request cannot suppress immediate
   projection.

Each branch advances its own applicable per-`tid` sequence/candidate ownership
before making a reactive array write. Neither branch returns early in a way that
prevents the other eligible branch from running.

### Immediate committed-list application

Map Like events only to `liked` and Save events only to `saved`. Before reading
sequence state require:

- non-terminal instance;
- positive-integer event `tid`;
- owner tab equals both the event kind's tab and current `activeTab`;
- owner account token still equals the current account token;
- event sequence is above the owner's hard floor and the greatest sequence
  already applied for that `tid`.

On a negative event:

- first advance this owner's applicable per-`tid` sequence ownership;
- remove every matching row from a new array;
- preserve nonmatching row identity and order;
- retain the first matching row object and its original slot as the only
  restoration candidate;
- if no row/candidate is known, update the per-`tid` sequence but do not create
  an object or change array identity.

On a positive event:

- first advance this owner's applicable per-`tid` sequence ownership;
- if a matching row is already present, keep the exact array and row identities
  and clear an older candidate;
- otherwise restore only a candidate owned by this exact collection owner;
- clamp the stored slot into the current array bounds;
- insert the same row object once and clear its candidate;
- if no candidate exists, update sequence ownership but do nothing visible.

Delivery stack order is not authority. A prior subscriber may publish a newer
nested event before the outer event reaches Profile. Sequence must be tracked
per `tid`; a newer event for B or the irrelevant kind must not suppress an
older-but-still-current event for A.

### Hard boundaries

Retire the committed owner and all candidates/floors synchronously on:

- `resetList()`;
- guest/account boundary;
- admission of a different tab;
- `orders` admission;
- an accepted error/failure path before it clears the visible list;
- committed replacement by a new accepted list response;
- terminal explicit/scope disposal.

Detachment/terminal ownership changes happen before `activeTab`, account/list
identity, empty/error arrays, or other reactive visible state is written. A
sync watcher triggered by that visible write must never observe the old owner as
current.

A same-tab refresh may retain the visible owner while transport is pending so
an event can still update the mounted list. The accepted response then replaces
it with a new owner.

A new owner captures `settlements.currentSequence()` before it becomes visible.
Thus an old callback already retained in a channel delivery snapshot cannot
apply to the replacement owner.

## Physical request boundary

Every real `fetchProfileTab` call owns an exact request object containing:

- load generation and physical-call identity;
- requested tab and account token;
- `boundary = settlements.currentSequence()`;
- per-`tid` greatest matching post-boundary event;
- detached known-row candidates captured from the exact same-tab/account
  committed owner at physical start: every currently present valid-tid row with
  its slot, plus existing removed-row candidates. The request may also learn a
  candidate removed while it is active.

Request candidates are an isolated snapshot. Clearing/restoring a committed
owner candidate cannot clear the request's copy. They live only until that exact
physical call settles/retires and are never transferred to retry or another
instance.

### Start order

For each initial call and each same-account 401 retry:

1. retire any prior physical-call object for that load;
2. construct/install the inert exact request object;
3. capture `boundary = settlements.currentSequence()`;
4. recheck terminal state, generation, exact request identity, active tab, and
   stable-account ownership when this is a membership-eligible non-null-token
   request; if any applicable guard changed synchronously, retire this request
   without enabling collection or calling transport. A null-token request, or a
   transport-backed irrelevant-tab request, still calls the existing transport
   but never enables membership capture; the existing `orders` short-circuit
   remains unchanged;
5. detach-copy the eligible same-owner known rows/candidates into this request;
6. enable collection;
7. without an intervening `await`, call the existing `fetchProfileTab` with the
   existing tab/history/filter arguments.

A transparent timing wrapper may synchronously reset, dispose, or supersede from
inside `currentSequence()`. The post-boundary recheck must reject that start.

A transport mock that publishes synchronously inside its function body is
post-boundary. A settlement delivered before step 3 is pre-boundary and is not
retained for the response.

The instance has one channel subscription. Its request branch records without
requiring a committed owner. Recording requires matching tab kind, a captured
stable non-null account token that still matches current, positive `tid`, and
`event.sequence > boundary`; use per-`tid` greatest sequence. Before immediate
negative removal, copy any matching currently present row/slot into the request
candidate map. A committed-owner positive may clear only the owner's candidate;
the detached request candidate remains until request retirement.

### Response overlay and commit

Before overlay or commit, require all existing generation guards plus exact
active-request identity and requested tab still active. When the request
captured a stable token, it must still match current. A null-token request may
commit its unprojected transport result under existing generation guards but
cannot have request-local membership events or install a membership owner.

Response handoff order is exact:

1. capture the prospective new-owner floor with
   `settlements.currentSequence()`;
2. recheck terminal, generation, exact request, tab, and account ownership;
3. only then snapshot request-local latest events/candidates and compute the
   membership overlay;
4. install the new owner/floor/candidates;
5. assign `profileItems` as the last membership-commit write.

If `currentSequence()` synchronously publishes, the still-enabled request
subscriber records that event before the pending snapshot is read. Taking the
pending snapshot first would let the new floor swallow a real post-boundary
event and is forbidden.

- Start from `response.items || []`; transport owns every row field/reference.
- Apply each request-local latest event by sequence-independent `tid` slots.
- Negative removes matching transport rows and retains the first such transport
  row as the new owner's restoration candidate.
- Positive keeps a matching transport row. If transport lacks one, it may
  restore only a candidate already detached into this exact request at start or
  during delivery; unknown positives remain absent.
- A transport response row is the preferred candidate/version whenever it is
  present. Only when transport lacks the row may the request use its older known
  candidate.
- Preserve the original response items array identity when no applicable event
  changes membership. Because `profileItems` is a Vue deep `ref`, this is a raw
  identity contract: `toRaw(profileItems.value) === response.items`; it does not
  require the observable proxy to equal the plain transport array.
- Install one new committed owner with a current hard floor, exact response
  array/snapshot ownership, and any resulting candidates **before** assigning
  `profileItems`. A sync watcher may publish during the assignment; that event
  must see the new owner and cannot fall into a handoff gap.
- Request settle/failure/supersession clears only that exact request's maps;
  old cleanup cannot clear a newer request.

A synchronous transport throw follows the same exact-request retirement and
existing error/401 handling as an asynchronous rejection. It cannot leave an
enabled request or candidates behind; a same-account retry creates a fresh
physical object and boundary.

An event during a failed request may have already changed the current mounted
list, but request-local overlay never turns failure into success and never
transfers to retry. A retry is a new physical boundary; transport is authority
for every event that predates it.

## Terminal disposal

Resolve a single idempotent `dispose()` and register it with `onScopeDispose`
when a Vue scope exists.

Disposal order:

1. mark terminal;
2. detach subscriber ownership and attempt unsubscribe in an isolated cleanup
   path;
3. advance request generation and detach the exact active request;
4. retire committed collection owner/candidates/floors;
5. release `listLoading` ownership;
6. reject future load/reset/event continuation authority.

Callbacks already captured in a channel delivery snapshot check terminal first.
Calling public dispose after scope disposal, or scope disposal after public
dispose, is a no-op. A late transport response/rejection/finally cannot commit or
clear a fresh instance. An injected unsubscribe that throws cannot undo the
terminal flag or prevent the remaining internal ownership cleanup.

## Required RED matrix

Add one behavior suite using the real `useProfileTabs` and real settlement
channel factory/singleton. Only profile API transport and existing browser
storage seams may be mocked. Tests may wrap a real production channel in a
transparent delegate solely to count listeners, make returned unsubscribe
throw after delegation, or trigger the specified synchronous
`currentSequence()` timing edge. The wrapper must delegate real
publish/subscribe/currentSequence behavior, may not copy membership/channel
state, and may not provide fallback semantics. For the invalid-event consumer
guard only, it may retain the exact listener passed to real `subscribe` and
invoke that listener directly with a malformed event whose sequence is above
the current real sequence; this raw delivery must not mutate or emulate channel
sequence/listener state. Do not copy the membership state machine into a fake
consumer.

1. **Liked negative/remove and positive/restore.** Load a real `liked`
   response with A/B/B/C. Unlike B removes every B, preserves A/C
   identities/order, and performs no API call. Retain only the first B candidate.
   Later Like B restores that exact first B object at its original bounded slot
   once. Capture it from the committed reactive ref and require the restored
   observable row to be that same proxy. Repeated/older events do not duplicate
   or roll back.
2. **Saved symmetry.** Repeat the membership direction rules for `saved`.
   Like cannot mutate saved; Save cannot mutate liked.
3. **Unknown positive never fabricates.** Positive for absent/invalid/nonmatching
   tid changes neither array identity nor API count and is not cached for a
   later tab or instance. Because the real channel rejects malformed ids before
   delivery, use the authorized retained-listener probe to deliver zero,
   negative, fractional, `NaN`, and infinite tids directly to the production
   consumer. Repeat against a committed owner and an active pending request;
   neither immediate state nor request-local overlay may change. A later
   transport response alone supplies row data.
4. **Per-tid nested order.** For a committed owner, an earlier listener
   publishes newer B inside outer A delivery. Both current tids apply. A newer
   nested inverse for the same tid wins even though Profile receives
   newer-before-older. An irrelevant-kind nested event cannot raise a global
   floor that suppresses the outer relevant event. Repeat the cross-tid and
   same-tid nested discriminators during an initial pending physical request,
   then resolve a response containing both rows; request-local overlay must be
   per tid rather than one global latest sequence.
5. **Different-tab hard boundary.** Liked A is removed, then admission switches
   to saved/history before an outer callback or positive restore. Old candidate
   and callback cannot affect the new tab. Orders/reset clear the same state.
6. **Account/reset boundary.** For stable A, guest, stable B, and A -> B -> A,
   reset retires candidates and retained delivery callbacks. A response
   captured for A cannot commit after current token becomes B. Missing-id users
   load transport data but are ineligible for event projection. Explicitly
   record that a truly late old-account event cannot be classified without
   account data in the event. Replacing the user object with another object
   carrying the same normalized stable id must retain current owner/request
   continuity and still accept a later matching event.
7. **Physical pending overlay.** Prove the liked/saved transport was called and
   remains pending; publish a negative event; then resolve with a stale row and
   newer title/cover on other rows. At least one response contains two rows with
   the same matching `tid`: the negative event must remove both, retain only the
   first transport row as the new owner's candidate, and a later positive event
   must restore that exact object once. Membership follows the settlement while
   all surviving transport fields/references remain authoritative.
   During response assignment, use a sync watcher that publishes another event;
   it must apply to the newly installed owner rather than being lost or applied
   to the retired list. In a separate sync watcher, reset A and start a B load
   during A's assignment; the old A continuation/final cleanup cannot reinstall
   A ownership, commit another A array, or clear B loading/request state.
8. **Response candidate re-entry.** During a physical request publish negative,
   resolve a response containing a newer version of the removed row, then
   publish positive. Restore the response row object/title at its original
   slot, not an older pre-request object; compare raw transport identity with
   `toRaw` because Vue exposes deep-ref rows through proxies.
9. **Positive candidate versus unknown.** Negative then positive while a request
   is pending may restore only a candidate captured by the committed owner or
   response. Also cover a post-boundary positive with no prior negative: a row
   that was present when the request physically started may be restored if the
   stale response omits it. A post-boundary positive for unknown X never appends
   X.
10. **Physical-call boundary.** Publish before `loadProfileList`; later response
    wins. Separately publish synchronously from inside `fetchProfileTab`; the
    persistent subscriber and request boundary must already be live, so the
    event is post-boundary and overlays that response. No applicable event keeps
    exact raw response-items identity via `toRaw(profileItems.value)`. Using the
    transparent timing wrapper, synchronously reset/dispose/supersede from the
    start-boundary `currentSequence()` call and prove transport never starts.
    At response handoff, publish synchronously from the prospective-floor
    `currentSequence()` call and prove the event is included rather than
    swallowed by the new floor.
11. **Same-account 401 retry boundary.** An event during the failed first
    physical call updates the mounted owner but does not transfer into the
    retry. The first exact physical request is retired; the retry captures a new
    boundary immediately before its own transport call. The retry starts after
    that event and its response is authority.
12. **Supersession and cleanup identity.** Old liked request + event is
    superseded by a newer same/different-tab request. Old response/final cleanup
    cannot commit, transfer candidates, hide new loading, or clear the new
    request. Latest response owns the list.
13. **Failure.** A transport rejection remains the existing error path;
    request-local events do not manufacture success or survive into retry. The
    accepted error retires the old committed owner/candidate before clearing the
    list; a later positive event cannot resurrect the row while error state is
    visible. Cover synchronous transport throw as well as async rejection.
14. **Default singleton and injection isolation.** With no `settlements` option,
    the exported named singleton updates a real committed Profile list. An
    injected factory port updates only its matching harness and emits nothing to
    the singleton.
15. **Dispose and no replay.** Explicit and scope disposal are terminal and
    mutually idempotent; stop subscriber/request authority immediately; late
    result/callbacks are silent. A new instance on the same port receives no old
    event/candidate; its first response alone decides membership. A throwing
    injected unsubscribe cannot reopen admission or retain mutation authority.
    Disposing a never-settling load immediately releases `listLoading` and exact
    request/listener ownership. Subsequent public load/reset calls on the old
    disposed instance are prompt no-ops: they cannot call transport or mutate
    visible refs.
16. **Existing guards.** Current request-generation, same-account 401 retry,
    A -> B reset order, history owner ids, posts filters, and orders short-circuit
    suites remain green. The existing direct-composable request-race harness
    must dispose every instance or inject a fresh real factory port so its new
    persistent subscription cannot leak across tests; this is lifecycle-only
    test adaptation and must not weaken or rewrite its assertions.

Behavior assertions must observe real refs/arrays/objects and real channel
delivery. Source-only regex is not a substitute for the behavior matrix.

## Allowed files

Runtime:

- `src/features/profile/useProfileTabs.ts`

Tests/inventory:

- `tests/profile/useProfileTabs.reaction-membership.test.ts` (new)
- `tests/profile/useProfileTabs.reaction-membership.structure.test.mjs` (new)
- `tests/profile/useProfileTabs.request-race.test.ts` (lifecycle-only harness
  adaptation: use a fresh real channel or register/call `dispose()` after every
  direct composable instance; do not alter existing behavioral assertions)
- `scripts/check-test-inventory.mjs` (`171 -> 172` Vitest; `66 -> 67` Node)

Task/status/handoff:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/profile-reaction-membership-consumer.md`
- `docs/agent/handoffs/profile-reaction-membership-consumer.md` (new)

Validation-only, unchanged unless a separate scope review authorizes otherwise:

- F3f-F3i settlement behavior and structure suites
- Profile view/stats/collection structure suites

## Forbidden changes

- no change to `src/features/reactions/**`;
- no change to Feed, Detail, `ProfileView.vue`, `ProfileCollectionList.vue`, or
  `ProfileStatsBlock.vue`;
- no change to profile API/DTO/types, backend handlers, auth/session, storage,
  service worker, dependencies, router, or shell;
- no automatic refresh, polling, interval, replay cache, persistence, tab relay,
  placeholder row, or synthetic Profile statistic;
- no API, database, Redis, schema, migration, or production-data change;
- no external/remote network, credential, production, push, merge, or deploy
  action.

## Acceptance evidence

All acceptance gates passed locally:

1. The behavior contract was RED for semantic reasons against the accepted F3i
   runtime, including the later cross-tab candidate and synchronous nested-load
   ownership regressions; compatibility guards remained green.
2. The final behavior suite passed 65/65 after the single runtime change.
3. The relationship structure suite passed 6/6, proving the optional typed
   port, exact public-barrel/default-singleton path, one construction-time
   subscriber, production `ProfileView` default path, disposal ownership, and
   absence of alternate channel or replay storage.
4. Six `useProfileTabs.request-race` and F3e-F3i compatibility-guard files
   passed 196/196.
5. Full Vitest passed 172 files / 4,396 tests; full Node structure tests passed
   67 files / 845 tests.
6. The production build passed with 647 transformed modules and 71 PWA precache
   entries; the HTML sanitizer and 3/3 hermetic localhost smoke checks passed.
7. Full `npm run verify` exited 0 in about 105.5 seconds. Type checking,
   changed-file ESLint, Prettier, inventory, encoding, conflict-marker, and diff
   checks also passed.
8. Two independent reviewers returned `ACCEPT` with no blocking finding.
9. Validation was local-only. The only network/server activity was the
   hermetic localhost preview used by the smoke runner; no external/remote
   network, remote backend, production access, credential use, push, merge, or
   deployment occurred.

## Known limits and non-goals

- Positive settlement for an unknown row cannot append because the event has no
  Profile DTO snapshot.
- Profile stats do not update from settlement events.
- A request started after a settlement is transport-authoritative. Without a
  server revision, a later response cannot be proven newer than the local event;
  keeping a sticky client overlay would be a different and potentially
  incorrect global-cache design. The currently reviewed server cache adapter is
  a no-op, so this task does not claim an active 30-second Profile cache bug.
  The liked/saved use cases do declare a TTL, however; if a real adapter is
  enabled later, toggle-side invalidation must be reviewed with it.
- Reload/remount receives no replay; first transport response is authority.
- Cross-tab events and persistence are absent.
- Missing-id authenticated users deliberately do not receive event projection;
  their transport collection remains usable and authoritative.
- Settlement events carry no account identity. Normal reset boundaries are
  guarded, but an external old-account event published after B is mounted is
  indistinguishable.
- Server reaction revisions, idempotency guarantees, Profile counts, and
  cross-device reconciliation remain open.
- Feed cursor and page/scroll restoration remain separate batches.

## Rollback

Rollback is code-only and local:

1. revert the eventual acceptance-doc commit;
2. revert runtime commit `48b8ccc`;
3. revert synchronous nested-request RED commit `da98eef`;
4. revert cross-tab candidate RED commit `38afc7f`;
5. revert main RED/inventory commit `c908a4d`, removing the two new test files,
   restoring the request-race harness, and returning inventory `172 -> 171`
   Vitest and `67 -> 66` Node;
6. revert task commit `11b1cc1`.

No database, Redis, storage, schema, service-worker, or user-data cleanup is
required. Successfully completed Like/Save actions are ordinary server user
state and must not be undone by a frontend code rollback. No deployment exists,
so there is no production rollback action.

## Acceptance authority

This task authorizes only the local files and checks listed above. It does not
authorize external access, production mutation, push, merge, or deployment.
Implementation is accepted only after the RED distribution is reviewed, the
single runtime scope is independently audited, full verification is green, and
the mounted-only limits are recorded in status and handoff documents.
