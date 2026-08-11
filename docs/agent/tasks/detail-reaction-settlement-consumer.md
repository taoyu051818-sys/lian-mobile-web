# Task: Mounted Detail reaction settlement consumer

## Status and source

- Decision date: 2026-08-11.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3h head `72768cf`, with Footer Like runtime
  implementation `956eff8`.
- Working branch: `codex/audit-f3i-detail-reaction-consumer`.
- Status: accepted locally on 2026-08-11; task commit `f46e171`, red-test and
  inventory commit `15fdfbb`, and runtime implementation commit `e78a855`.
- F3f settlement-channel and Feed-consumer ownership, F3g Context Save
  publication, F3h Footer Like publication, the Detail navigation reducer, the
  Detail fetch bridge, `PostDetailPanel`, and `usePostReactions` were reviewed.
- External/remote network and production access remain paused. This task
  authorizes local frontend code and hermetic tests only: no push, merge,
  deployment, production mutation, remote/backend server access, credential
  use, or online browser journey.

## Reproduced problem

F3f-F3h give the current mounted Feed an ephemeral stream of authoritative Like
and Save settlements, but the mounted Detail surface is not a consumer.

### Ready Detail remains stale

1. Detail A is ready with `liked: false`, `likeCount: 4`, and
   `bookmarked: false`.
2. The user confirms Like through A's Feed Footer or Save through A's Feed
   context menu.
3. The producer publishes an authoritative settlement and the mounted Feed is
   updated.
4. `usePostReactions` only publishes; it does not subscribe. The Detail reaction
   refs therefore remain stale until a new server snapshot is loaded.

`PostDetailPanel` resets its reaction refs only when its `post` prop identity
changes. Replacing the ready `post` object is not a safe shortcut: the same
watcher also resets place-sheet, report, reply, gallery, action-message, and
viewer-auth state. A reaction-only settlement must not erase those unrelated
in-progress Detail interactions. A store-level in-place update of exactly the
three reaction fields can preserve identity and close the handoff gap described
below; replacing the object or touching any non-reaction field remains forbidden.

### A late physical Detail response can overwrite a newer settlement

`fetchDetailWithToken` currently calls `fetchPostDetail(tid)` and dispatches the
response unchanged. The reachable race is:

1. Detail A begins a physical GET.
2. While that GET is pending, Footer Like or Context Save settles and publishes.
3. The GET returns older reaction fields but newer title/body/actor data.
4. The reducer correctly accepts the current request token, but the old reaction
   fields become the Detail baseline.

The physical request needs the same field-wise, request-local boundary rule that
F3f established for Feed: transport owns the full snapshot, while settlements
strictly after physical start may overlay only their reaction fields.

### A naive request subscription leaks after close or supersession

Subscribing in `fetcher.ts` and waiting for a generic `finally` is insufficient.
If a physical GET never settles, closing Detail or starting a new token would
leave the old channel listener and request-local maps alive indefinitely.
Predicate guards can reject a write but cannot release the resource.

The store therefore needs a logical loading lease. Closing, superseding,
resetting, or accepting the current result must terminate the lease immediately.
The underlying HTTP Promise may drain silently; it is not necessary to retrofit
transport abort support in this batch.

The lease must also suppress the old fetcher's later dispatch. Otherwise
`__resetStoreForTesting()` can reset the numeric token and a late old token `1`
can collide with a new token `1`, an ABA ownership failure.

### A naive ready subscription rolls a pending action back too far

Like and Save failures currently restore values captured at click time. If a
matching external settlement arrives while a Detail action is pending, that
settlement is the newest confirmed rollback baseline. A current action may
continue and its later authoritative success may win, but a failure must not
restore the older click-time snapshot.

## Product decision

F3i is **authoritative reaction settlement -> current mounted Detail reaction
projection**, with a physical Detail-request lease.

- A ready mounted Detail consumes matching Like and Save settlements through two
  coordinated views of the same named singleton: `store.ts` updates exactly the
  ready post's reaction fields in place, while `usePostReactions` updates its
  reaction baseline/display refs.
- Immediate consumption never replaces the reducer-owned ready `post` object and
  never changes a non-reaction field. Stable identity prevents
  `PostDetailPanel`'s broad snapshot-reset watcher from firing.
- A loading Detail has no ready reaction owner. Its current physical request
  instead collects matching, post-boundary settlements and overlays them on the
  eventual response before reducer dispatch.
- The store owns exactly one current loading lease. A close, token/tid change,
  reset, or accepted result synchronously terminates that lease and its channel
  subscription.
- The store also owns one module-lifetime, no-replay ready consumer. This closes
  the result-dispatch -> Vue prop/watch handoff window without retaining any
  per-request map after loading ends.
- Terminating the lease does not abort the network transport. It makes all late
  response, rejection, callback, projection, and dispatch work inert.
- Settlements before physical request start do not replay. A later transport
  response is authority for those earlier events.
- The named F3f singleton remains the only production channel. Optional port
  injection is one hermetic-test seam, not a second product path.

This remains process-local and mounted-only. It is not a durable/global entity
cache and does not add persistence, replay, account identity, cross-tab delivery,
or server reaction revisions.

## Public fetch bridge surface

Extend the existing fetch bridge without changing its three-argument callers:

```ts
export interface FetchDetailWithTokenOptions {
  settlements?: PostReactionSettlementPort;
  signal?: AbortSignal;
}

export function fetchDetailWithToken(
  tid: number,
  token: number,
  dispatch: DetailDispatch,
  options?: FetchDetailWithTokenOptions,
): Promise<void>;
```

At construction of one physical call, resolve exactly once:

```ts
const settlements = options?.settlements ?? postReactionSettlements;
```

The named singleton and port type must come from the established
`../../features/reactions` barrel. Do not construct a channel, deep-import its
implementation, reset the singleton, or branch on environment/test state.

`signal` is a logical projection/commit lease only. It must not be passed to
`fetchPostDetail`, the HTTP layer, or a new transport option.

## Store loading-lease ownership

`store.ts` owns at most one production loading lease:

```ts
interface DetailLoadingOwner {
  tid: number;
  token: number;
  controller: AbortController;
}
```

The object identity is authoritative in addition to `tid` and `token`. A
numeric token alone is not sufficient because the testing reset can reuse it.

Only the production default `fetch` effect creates the controller. Tests that
replace the effect handler continue to observe pure reducer effects and do not
create a synthetic owner without a physical request.

### State transition order

For every dispatch:

1. Run the pure reducer and obtain `nextState`.
2. Compare the active loading owner with `nextState` using all of:
   - `nextState.kind === "loading"`;
   - `nextState.token === owner.token`;
   - `Object.is(nextState.tid, owner.tid)`.
3. If it no longer matches, detach the store pointer first, then synchronously
   and idempotently abort the controller.
4. Reconcile the ready projection owner before state assignment: install a new
   post identity and current-sequence floors only when `nextState` contains a
   different ready post; preserve floors when the identical ready state is
   retained; clear the owner when `nextState` is not ready.
5. Commit `stateRef.value = nextState`.
6. Execute the reducer's new side effects.
7. The production fetch effect rechecks that the state still matches its
   `tid/token`, creates and installs a fresh owner, then calls
   `fetchDetailWithToken(..., { signal: owner.controller.signal })`.
8. The fetch Promise's final cleanup may clear the store pointer only when the
   pointer still references that exact owner object. An old A `finally` must not
   clear a newer B owner.

The same owner-release helper is used by `__resetStoreForTesting()` before it
restores the initial state.

Release synchronously on:

- A loading -> B loading, including A -> B -> A;
- loading -> closed;
- loading -> ready or error;
- `__resetStoreForTesting()`;
- any other real transition for which current `kind/tid/token` no longer matches
  the installed owner.

Do not release on:

- a same-tid loading no-op;
- an old A `fetch-result` that the reducer drops while current B remains
  loading.

## Store ready-handoff projection

`store.ts` additionally subscribes once, for the lifetime of its existing
module singleton, to the named `postReactionSettlements` channel. This consumer
has no event cache or replay and is distinct from the disposable listener owned
by each physical request.

It tracks only:

- the exact current ready raw `post` object identity (`toRaw`) and its `tid`;
- independent latest-sequence floors for Like and Save.

Whenever dispatch is about to install a different ready post object, after
releasing the old loading lease but before assigning `stateRef.value`:

1. capture one `postReactionSettlements.currentSequence()` value;
2. install the new ready post's `toRaw` identity/tid;
3. assign both per-kind floors to that value;
4. commit the ready state with no intervening `await`.

This means the accepted transport snapshot remains authority for every event
already issued. It also handles a callback captured in an older delivery
snapshot: if an earlier listener synchronously dispatches the ready result, the
later store callback sees a sequence at or below its new floor and no-ops.

When dispatch leaves ready state, clear the ready identity before committing the
new non-ready state. `__resetStoreForTesting()` clears the same ready owner and
floors while leaving the module-lifetime subscription installed.

For each channel callback:

- read the current `stateRef.value` and require `kind === "ready"`;
- require the tracked raw identity to equal `toRaw(state.post)` (Vue may wrap
  the newly assigned state/post in reactive proxies);
- require a positive-integer event tid matching both `state.tid` and
  `state.post.tid`;
- compare sequence only after tid/kind match;
- retain the greatest sequence independently for Like and Save;
- mutate in place only `state.post.liked` and `state.post.likeCount` for Like,
  or only `state.post.bookmarked` for Save;
- preserve the `DetailState` object, `PostDetail` object, and every
  non-reaction value/reference exactly from the consumer's observable reactive
  identities.

While state is loading, the ready consumer ignores events and the disposable
request listener collects post-boundary events. While state is closed or error,
both ready projection and caching are absent.

This permanent ready consumer closes a real handoff window. A current fetch
dispatch terminates its loading listener before Vue renders the new post and
before `PostDetailPanel` runs its default pre-flush watcher. A Footer/Context
continuation may publish in that interval. The store consumer updates the same
ready post object in place, so the later `resetReactions(post)` reads the updated
reaction fields without observing a new object identity or resetting unrelated
Detail interactions.

## Physical request boundary and overlay

Each fetcher invocation owns an isolated closure with terminal state,
unsubscribe, boundary, and latest Like/Save events.

### Start order

The exact start order is:

1. If the supplied signal is already aborted, return fulfilled without
   subscribing, calling the transport, or dispatching.
2. Subscribe with collection still inert.
3. Register the abort listener.
4. Recheck the signal so synchronous subscribe/abort edges cannot escape.
5. Capture `boundary = settlements.currentSequence()`.
6. Recheck terminal/signal state again so an injected port that aborts while
   reporting its boundary cannot start a transport.
7. Enable collection.
8. Without an intervening `await`, call `fetchPostDetail(tid)`.

A mock/transport that synchronously publishes from inside the function body is
therefore post-boundary and must be collected.

### Collection

- Filter by `Object.is(event.tid, requestedTid)` before updating sequence state.
- Accept only `event.sequence > boundary`.
- Track Like and Save independently.
- Within each kind, the greatest sequence wins. Delivery stack order is not
  authority because an earlier listener may publish a nested newer event before
  the outer event reaches this subscriber.
- Nonmatching tids and invalid events do not block a later matching event.

### Response commit

- Overlay only when `Object.is(response.tid, requestedTid)`.
- Preserve the transport's complete non-reaction snapshot and nested references.
- Like may replace only `liked` and `likeCount`.
- Save may replace only `bookmarked`.
- With no applicable event, dispatch the original response object unchanged.
- A transport error dispatches the existing error result only while the lease
  remains live; request-local events are not converted into success and do not
  transfer to retry.

Before any success/error dispatch, recheck terminal/signal ownership. Abort
after the physical transport started performs all of these synchronously:

- mark the closure terminal;
- unsubscribe;
- clear request-local event references;
- prevent callbacks retained in a channel delivery snapshot from collecting;
- prevent the eventual response or rejection from dispatching.

Final cleanup removes the abort listener and repeats unsubscribe idempotently.
It never touches another request's lease.

When the current projected success/error dispatch is accepted, `store.ts`
terminates its owner during that dispatch. The response overlay has already been
constructed, so this cleanup cannot erase the accepted payload.

## Mounted Detail reaction ownership

`usePostReactions` keeps its current structured options. The same resolved port
is used for both publishing and subscribing.

Internally own:

- current snapshot `tid` or `null`;
- `baselineLiked`, `baselineLikeCount`, and `baselineSaved`;
- displayed reaction refs and independent Like/Save busy refs;
- snapshot generation plus independent Like/Save tickets;
- active Like/Save attempts, each with object identity, captured tid,
  generation, ticket, desired value, and `admissionSequence`;
- latest matching Like and Save delivery sequence;
- a terminal `disposed` flag and idempotent unsubscribe.

All Like counts use the established finite -> truncation -> lower-bound-zero
normalization. Booleans are normalized with `Boolean`.

### Full snapshot reset is a hard boundary

Every `resetReactions(nextPost)`, including a same-tid new snapshot:

1. advances generation and both action tickets;
2. retires both attempts and clears both busy refs;
3. installs current tid and normalized baselines/displays from the new transport
   snapshot (or null/zero/false when absent);
4. assigns both the Like and Save latest-sequence floors to this reset's exact
   `settlements.currentSequence()` value, and every later callback compares
   against its kind's floor.

The sequence boundary rejects a channel callback already captured before the
reset, including an A -> B -> A reset that occurs earlier in the same delivery
snapshot. Snapshot transport remains authority for all settlements already
issued before the reset.

### Settlement delivery is a soft reaction-only rebase

For a non-terminal callback:

- accept only a positive-integer event tid matching the current snapshot tid;
- compare sequence only after the tid/kind match;
- reject a sequence no newer than the latest matching sequence;
- update only that kind's confirmed baseline;
- never advance snapshot generation/tickets, retire an action, clear busy, or
  affect the sibling kind;
- never itself mutate/replace `PostDetail`, reducer state, or unrelated Detail
  state (the coordinated store consumer owns the exact in-place reaction-field
  projection described above);
- never show feedback or publish another event.

If no same-kind action is active, update the matching display immediately.

If a same-kind action is active:

- the event always becomes the newest failure baseline;
- when `event.sequence > attempt.admissionSequence`, it is truly newer than the
  action and also updates the pending display;
- when `event.sequence <= attempt.admissionSequence`, it was already in delivery
  when a prior subscriber synchronously admitted the action. It updates the
  baseline but must not overwrite the new optimistic display.

The active action remains current and busy. Its later authoritative success may
win and publish a newer settlement; its failure restores the latest external
baseline.

### Action admission and completion

Like and Save remain independent. Admission captures
`settlements.currentSequence()` as `admissionSequence`, applies the existing
optimistic display, marks only its own kind busy, and calls the existing API
exactly once. Busy/disposed/invalid/mismatched-owner admission remains a prompt
no-op Promise.

Current authoritative success order for each kind is:

1. recheck disposed, snapshot generation, action ticket, active-attempt identity,
   captured tid, and the existing external-current predicate;
2. normalize and commit authoritative response to baseline/display;
3. retire the attempt and set that kind's busy ref false;
4. attempt the existing success feedback in an isolated call-site `try/catch`;
5. publish one captured-tid authoritative settlement as the final observable
   producer-side effect;
6. return with no generic `finally`, duplicate feedback, or post-publish write.

This makes a subscriber's synchronous inverse action real: the outer callback
later receives the older event, but `admissionSequence` preserves the inverse
optimistic display and the old continuation cannot clear the new busy state.

Current failure order is:

1. recheck full ownership;
2. restore display from the latest same-kind baseline;
3. retire the attempt and release only its own busy ref;
4. attempt the existing exact error feedback in an isolated call-site
   `try/catch`;
5. publish nothing and return fulfilled.

Stale success/rejection/finally work is silent. An external-current predicate
that becomes false without a snapshot reset preserves the prior behavior: the
old attempt receives no commit, feedback, publication, or cleanup authority
until its real owner reset/disposal occurs.

### Terminal disposal

Return an idempotent `dispose()` and register it with `onScopeDispose`.

Disposal order:

1. mark terminal;
2. unsubscribe;
3. advance generation/tickets, retire attempts, and clear both busy refs;
4. reject all future admissions and callbacks.

An unsubscribe cannot remove a listener already present in the channel's
delivery snapshot, so the callback itself must check terminal state first.
Calling `dispose()` after scope disposal, or scope disposal after explicit
dispose, remains a no-op.

## Required red-test matrix

Add one behavior suite that executes the real store, fetcher,
`usePostReactions`, channel factory/singleton, and reducer. Only API transports
may be mocked. Tests may additionally wrap a real production channel with a
transparent delegating decorator solely to count subscriptions or synchronously
trigger the specified abort edge at `subscribe`/`currentSequence`; it must retain
the real channel implementation and must not copy channel/request/action state,
alter delivery, or provide fallback behavior.

1. **Ready immediate projection and handoff.** Install a real ready store post
   and reset real `usePostReactions` from it. Matching Footer-like and
   Context-save settlements update both store reaction fields and composable
   refs immediately. The `DetailState` and `PostDetail` identities, all
   non-reaction values/references, action feedback, and unrelated local refs
   remain unchanged. Nonmatching/invalid events do nothing, and Like/Save remain
   independent. Then exercise the exact handoff gap: keep the composable owner
   null as during loading, dispatch a current ready result, publish before
   `resetReactions(readyPost)`, prove the store patches the same post identity,
   and only then reset the composable; it must initialize from the settlement,
   not the stale response. A new ready snapshot establishes per-kind floors so
   an older callback already retained in a delivery snapshot cannot patch it.
2. **Hard reset versus soft rebase.** A matching settlement preserves active
   generation/tickets/busy; a same-tid `resetReactions` is a hard snapshot
   boundary and permanently stales old work. A -> B -> A also rejects old work.
   In a direct delivery-snapshot discriminator, register an earlier listener
   that performs same-tid reset and A -> B -> A before the already-captured
   Detail subscriber receives the outer event; the reset boundary must reject
   that old callback rather than applying it to the new A snapshot.
3. **Latest same-kind baseline.** While a real Detail Like is pending, publish a
   newer external Like with a different direction/count. Busy/ticket remain;
   current rejection restores the external baseline with one exact error and no
   producer event. Repeat symmetrically for Save. A current response after the
   rebase instead wins and publishes exact authoritative values. Add a
   post-admission event whose payload equals the click-time baseline but differs
   from the optimistic display; sequence, not value equality, must update the
   pending display. Invalid/null/mismatched-owner Like and Save admissions are
   direct public no-op cases: API/event/feedback/display/busy remain unchanged
   and their Promises fulfill promptly.
4. **Cross-kind independence.** Pending Detail Save survives Footer Like;
   pending Detail Like survives Context Save. Like and Save can remain busy and
   settle in either order without clearing or rolling back the sibling.
5. **Admission-sequence discriminator.** Register an earlier listener that, in
   an outer matching event, synchronously admits the inverse Detail action before
   the Detail subscriber receives that outer event. The event becomes rollback
   baseline but cannot overwrite the new optimistic display or clear busy.
   Reject that inverse request and require rollback to the outer event's exact
   baseline, one matching error attempt, zero producer publication, and released
   busy. This rejects both “apply the outer event to display” and “ignore the
   outer event entirely” implementations.
6. **Nested delivery order.** A prior listener publishes a newer same-kind event
   reentrantly. The Detail subscriber receives newer-before-older delivery but
   retains the greatest matching sequence. The store ready consumer must retain
   the same newest value in the same delivery. Nonmatching nested events do not
   suppress an older matching event in either consumer.
7. **Own success is terminal publication.** A listener observes authoritative
   state and busy false, synchronously starts the inverse action, and records the
   new request/busy state. The outer action returns without changing it. Settle
   the second request and require two ordered response-valued events.
8. **Feedback/listener isolation.** Parameterize throwing success message,
   throwing error feedback, and an earlier throwing channel listener. Current
   state/busy/event rules remain correct; handlers fulfill and do not reinterpret
   success as failure.
9. **Scope and explicit disposal.** Explicit dispose and scope stop are terminal,
   mutually idempotent, release busy, unsubscribe, reject new admission, and make
   late API/callback work silent. A listener retained in the current delivery
   snapshot still no-ops. A fresh scope on the same port receives no replay.
10. **Pre-boundary authority.** Publish Like/Save, then start a physical Detail
    request. The later response wins all reaction fields and the earlier events
    are not replayed. With no applicable post-boundary event, dispatch must retain
    the exact original response object identity rather than cloning needlessly.
11. **Synchronous physical-call boundary.** The `fetchPostDetail` mock publishes
    from inside its function body before returning its Promise. Subscribe and
    boundary must already be live; settlement wins reaction fields while
    transport wins title/body/actor and other nested references.
12. **Deferred request overlay.** First prove the physical GET has been called
    and is pending, then publish multiple Like/Save events. Per-kind greatest
    sequence wins, including reentrant delivery; nonmatching tids are ignored;
    the full transport snapshot remains otherwise authoritative.
13. **Response-owner validation.** If the returned post tid does not match the
    requested tid, no reaction overlay is applied and the original response
    identity is preserved. The existing reducer/token behavior remains the only
    navigation authority.
14. **Failure and retry retirement.** Events during a failing physical request do
    not turn failure into success and do not transfer. A retry captures a fresh
    boundary; an earlier event does not replay and the retry response may win.
15. **A -> B -> A request isolation.** Use real concurrent fetchers and reducer
    tokens. Old A projection/result cannot write B or new A, cannot transfer its
    maps, and its final cleanup cannot clear the new owner's subscriber.
16. **Never-settling close/supersede cleanup.** Start a physical request that
    never settles. Closing A changes total active request subscribers from one to
    zero immediately while the physical Promise remains pending. In a separate
    A -> B supersession, A must unsubscribe before B subscribes; A ownership is
    zero and the final total is exactly one subscriber belonging only to B. A's
    late response/rejection, delivery-snapshot callback, and `finally` are silent
    and cannot clear B's remaining subscriber.
17. **Reset-token ABA.** Start old token 1, call `__resetStoreForTesting()`, then
    start a new token 1. The old signal is terminal; its late result must not
    dispatch or affect the new loading owner.
18. **Current and stale result ownership.** Accepted success/error immediately
    releases its own lease. A stale A result arriving while B is loading must not
    abort B. A same-tid loading no-op must not replace the controller or issue a
    second fetch. Add a `flush: "sync"` watcher that reentrantly opens B while
    outer A's loading state is being committed, before outer A's effect loop
    resumes. Drive both transitions with `url-sync` actions (or an exactly
    equivalent no-history source) so no history-push reentrancy is in scope. B may
    start exactly once; the stale outer A fetch effect must fail its state recheck
    and must not replace or abort B's owner.
19. **Pre-abort and abort timing.** A pre-aborted fetcher call does not subscribe,
    call the API, or dispatch. Abort after subscribe but before physical call
    performs the same cleanup; drive this otherwise synchronous edge only with
    the permitted transparent decorator that delegates the real subscribe,
    triggers the supplied controller before returning (or while delegating
    `currentSequence`), and changes no channel behavior. Abort after physical
    start stops collection and dispatch while the transport drains.
20. **Default singleton integration.** With no injected port, a real Footer/Context
    publication updates an uninjected mounted Detail, and a synchronous publish
    inside an uninjected Detail fetch overlays its response. Both paths must use
    the exported named singleton in the same module graph.
21. **Regression guards.** Existing F3f/F3g/F3h behavior suites,
    detail-navigation reducer/store tests, Detail feedback, DetailSurface,
    Profile detail entry, Feed ownership, and build/SSR structure contracts stay
    green.

## Required structure gate

Add one Node structure contract that locks relationships rather than local names:

- `FetchDetailWithTokenOptions` exposes optional typed `settlements` and
  `signal`;
- fetcher imports the port type and named singleton from the exact public
  reactions barrel and resolves the optional port to that singleton;
- store creates `AbortController`, passes only its signal into the fetch bridge,
  and uses the same release path for state-owner changes and
  `__resetStoreForTesting`;
- store resolves the named singleton directly for one module-lifetime ready
  subscriber, owns per-kind sequence floors, compares the pre-commit raw post to
  the post-commit reactive proxy through `toRaw`, and writes only the three
  whitelisted reaction fields in place while preserving observable state/post
  identity;
- `fetchPostDetail` still receives only the tid; signal is not relayed into API,
  HTTP, components, or props;
- `usePostReactions` resolves one port for publish/subscribe, installs terminal
  unsubscribe, and exposes idempotent disposal;
- `state.ts`, `DetailSurface.vue`, and `PostDetailPanel.vue` do not import the
  channel, own request controllers, or receive a settlement/signal prop;
- no environment/test branch, factory-created production channel, replay cache,
  ready-post replacement, or non-reaction ready-post mutation is introduced.

## Allowed files

Runtime:

- `src/app/detail-navigation/store.ts`
- `src/app/detail-navigation/fetcher.ts`
- `src/features/detail/usePostReactions.ts`

Tests and inventory:

- `tests/composables/detailReactionSettlementConsumer.test.ts` (new)
- `tests/detail-navigation/detailReactionProjectionOwnership.structure.test.mjs`
  (new)
- `scripts/check-test-inventory.mjs` (`170 -> 171` Vitest files; `65 -> 66`
  Node files)

Task/acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/detail-reaction-settlement-consumer.md`
- `docs/agent/handoffs/detail-reaction-settlement-consumer.md` (new at
  acceptance)

The task commit changes only this task document. The red-test commit may change
only the two new tests and inventory. The runtime commit may change only the
three runtime files. Acceptance documentation is a separate final commit.

## Forbidden in F3i

- No change to `state.ts`, `DetailSurface.vue`, `PostDetailPanel.vue`,
  `PostReplyDock.vue`, Feed/Footer/Context runtime, the settlement channel,
  API/DTO/HTTP, Profile, auth/storage, backend, dependencies, service worker, or
  deployment configuration.
- No replacement of the reducer-owned ready `PostDetail`; no mutation beyond
  the exact in-place `liked`/`likeCount`/`bookmarked` store projection.
- No signal/AbortController prop relay and no transport API change.
- No replay cache, persistent/global entity store, cross-tab broadcast, account
  guessing, server-revision synthesis, retry queue, or settlement history.
- No broad listener/finally that waits on a never-settling transport before
  release.
- No claim that Feed, Detail, and Profile are now globally or durably canonical.
- No external/remote network, remote backend, online browser, credential,
  production, push, merge, or deploy action.

## Compatibility and known risks

- No API, DTO, schema, storage, dependency, service-worker, or backend migration.
- The Detail reducer, state union, URL/history behavior, token progression,
  loading/error surfaces, and PostDetailPanel props remain compatible.
- The logical lease does not cancel the physical HTTP transport. It only releases
  projection resources and removes commit authority; the old Promise may remain
  pending in browser/network infrastructure.
- Immediate ready projection lives in both the reducer-owned ready post's three
  in-place reaction fields and the currently mounted `usePostReactions` refs.
  All non-reaction fields remain the last transport snapshot, and post identity
  stays stable to avoid the broad Panel reset. Closing clears ready state; a new
  open must fetch server state and receives no replay.
- Profile liked/saved collections are not projected.
- Same mounted-session external account changes remain outside the channel's
  identity model. A stale settlement for the same numeric tid across accounts
  can still be misattributed without a shared auth epoch.
- Server responses have no reaction revision, so genuinely concurrent clients
  remain last-response/eventually-consistent.
- Cross-tab/device delivery, durable offline state, reload/remount replay, cursor
  pagination, and page restoration remain separate work.
- Hermetic unit/loopback validation cannot prove remote eventual-consistency or
  every physical mobile lifecycle schedule.

## Validation gates

Before local acceptance:

1. New Detail consumer/request-lease behavior suite fully green.
2. New Detail projection structure gate fully green.
3. F3f/F3g/F3h settlement behavior, Detail navigation reducer/store, reaction
   feedback, DetailSurface, Feed ownership, SSR, and Profile entry regressions
   green.
4. Inventory reports `171 Vitest / 66 Node`.
5. `vue-tsc --noEmit`, ESLint, Prettier, encoding, conflict-marker, and diff
   checks green for the allowed files.
6. Production build, sanitizer, all local smoke checks, full Vitest, all Node
   structure tests, and complete `npm run verify` green.
7. Allowed-file scope audit confirms no unrelated runtime/test/docs changes.
8. At least two independent reviewers return `ACCEPT` with no blocker.

The local loopback preview processes used by repository smoke checks are the
only permitted network/server activity. They do not authorize remote/backend or
production access.

## Local acceptance evidence

- Accepted prerequisite: F3h head `72768cf`.
- Commit chain: task contract `f46e171` -> red tests and inventory `15fdfbb` ->
  runtime implementation `e78a855`.
- The new behavior suite passed 45/45; nine focused files passed 239/239; and
  the new projection structure plus existing Detail feedback suites passed
  12/12.
- Full validation passed 171 Vitest files / 4,331 tests and 66 Node structure
  files / 839 tests. The production build transformed 647 modules and produced
  71 PWA entries; the HTML sanitizer and all 3 hermetic localhost loopback
  smoke checks passed.
- Full `npm run verify` exited 0 in about 129.6 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.
- The accepted file scope is exactly three runtime files, two new tests plus
  the inventory update, and three acceptance-documentation files.
- This is a local frontend acceptance only. It used no external/remote network
  or remote backend; the only network/server activity was the hermetic
  localhost preview used by the 3 loopback smoke checks. It performed no push,
  merge, deployment, production mutation, or production validation.

## Rollback

Revert in reverse order:

1. acceptance documentation commit;
2. runtime implementation commit `e78a855`;
3. red-test and inventory commit `15fdfbb`, restoring inventory `171 -> 170`
   Vitest and `66 -> 65` Node files;
4. task contract commit `f46e171`.

Rollback requires no DB, Redis, browser storage, schema, cache, service-worker,
or backend cleanup. Already-successful reactions are ordinary user/server state
and must not be undone by a code rollback. No online rollback is needed because
this batch is not deployed.

## Acceptance authority

This task authorizes only the exact local files and validation commands above.
Runtime work begins only after the contract and red matrix are independently
reviewed. Local acceptance requires the specified evidence and reviewers; it
does not authorize push, merge, deployment, production access, remote/backend
access, or a claim of durable/global reaction reconciliation.
