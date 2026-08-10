# Task: Feed Footer Like settlement publication

## Status and source

- Decision date: 2026-08-11.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3g head `3a56e12`, with runtime implementation
  `64a7603`.
- Working branch: `codex/audit-f3h-feed-footer-like`.
- Status: accepted locally on 2026-08-11; task commit `e217f6e`, red-test and
  inventory commit `d67b320`, and runtime implementation commit `956eff8`.
- Current Footer, F3f settlement port and Feed consumer, F3g Context Save owner
  continuity, card/Shell wiring, and their focused suites were reviewed.
- External/remote network and production access remain paused. This task
  authorizes local frontend code and hermetic tests only: no push, merge,
  deployment, production mutation, remote/backend server access, credential
  use, or online browser journey.

## Reproduced problem

`FeedItemCardFooter.vue` owns an optimistic Like ref and calls the real Like
endpoint, but its final state is local to that Footer instance:

1. Mounted Feed owns item A with `liked: false`, `likeCount: 3`.
2. The user presses A's Footer Like button.
3. The endpoint authoritatively returns `liked: true`, `likeCount: 4`.
4. The Footer updates its private refs and emits `liked`, but no ancestor listens
   for that component event; Vue component events do not bubble.
5. Any reaction-only Feed projection, card recreation, refresh, or reopen can
   therefore reveal the Feed-owned stale values again.

The current owner guard is also insufficient:

- the combined props watcher does not include `tid`, so a reused Footer may
  accept A's late completion after A → B → A;
- failure rolls back the values captured at click time, even if a same-tid
  server snapshot arrived while the request was pending;
- a generic `finally` may clear the busy state of a newer action admitted from a
  settlement subscriber;
- unmount does not invalidate the pending continuation;
- count normalization does not distinguish finite values from `NaN` or
  infinities.

F3f already provides the correct mounted-Feed consumer and physical-request
overlay. F3g ensures a Like-only shallow replacement does not cancel a pending
Context Save or Share. The missing coherent unit is the Footer Like producer.

## Product decision

F3h is **Footer authoritative Like success → current mounted Feed projection**.

- The Footer keeps its optimistic interaction.
- Only a current authoritative API success publishes a Like settlement.
- The production default is the existing named F3f singleton.
- An injected port is only a hermetic-test/composable seam, not a second
  production path.
- Same-tid external props refresh becomes the latest rollback baseline without
  invalidating the active Like attempt.
- A real `tid` owner transition invalidates the old attempt immediately.
- Success retires and releases the action before publishing, and publish is the
  final observable producer-side effect.
- Failure restores the newest same-tid baseline, releases busy, and publishes
  nothing. F3h does not add a new toast/haptic product behavior.
- The dead Footer `liked` component event is removed; the settlement port is the
  only cross-component success signal introduced by this batch.

This remains an ephemeral mounted projection. It is not a durable/global
canonical cache and does not add replay, persistence, account identity, or
server reaction revisions.

## Public composable surface

Add `src/features/feed/useFeedCardLike.ts` with one structured options port:

```ts
export interface FeedCardLikeDependencies {
  toggleLike?: typeof togglePostLike;
}

export interface UseFeedCardLikeOptions {
  tid: Readonly<Ref<FeedItemId>>;
  liked: Readonly<Ref<boolean | undefined>>;
  likeCount: Readonly<Ref<number | undefined>>;
  settlements?: PostReactionSettlementPort;
  dependencies?: FeedCardLikeDependencies;
}

export function useFeedCardLike(options: UseFeedCardLikeOptions): {
  liked: Readonly<Ref<boolean>>;
  likeCount: Readonly<Ref<number>>;
  likeBusy: Readonly<Ref<boolean>>;
  likeLabel: Readonly<Ref<string>>;
  handleLike(): Promise<void>;
  dispose(): void;
};
```

Equivalent readonly Vue ref types are allowed. The production Footer must call
the composable with only the three prop-derived refs/getters. It must not pass a
port or dependencies, import the settlement module, or call `togglePostLike`
directly.

At construction, the composable resolves exactly once:

```ts
const settlements = options.settlements ?? postReactionSettlements;
const toggleLike = options.dependencies?.toggleLike ?? togglePostLike;
```

Both named imports come from their established production modules. Do not add a
factory reset, environment branch, test-only singleton, or channel export from
the Footer.

## Normalization and owner state

Use these value rules everywhere: initial props, same-tid rebase, optimistic
count, authoritative response, event payload, and label.

- `liked`: `Boolean(value)`.
- `likeCount`: `Number(value)`, then finite check, integer truncation, and lower
  bound zero. `NaN`, `Infinity`, `-Infinity`, missing, or otherwise non-finite
  values become zero.
- `tid`: only a positive integer can admit a request or settlement.

The composable owns:

- `baselineLiked` and `baselineLikeCount`;
- displayed `liked` and `likeCount` refs;
- `likeBusy`;
- `ownerGeneration` for `tid` transitions;
- an independent monotonic `likeTicket`;
- a terminal `disposed` flag;
- at most one active Like attempt containing captured `tid`, generation, ticket,
  and desired value.

Owner identity is the raw `tid` value compared with `Object.is`; positive-integer
validation is a separate admission rule. Any raw change for which
`Object.is(previousTid, nextTid)` is false—including 0 → -1—is an owner boundary.
`NaN` → `NaN` is unchanged. In particular, A → invalid → A must permanently stale
the first A attempt even though the final positive `tid` equals the original one.

### Prop watcher rules

Watch `tid`, `liked`, and `likeCount` synchronously.

1. Initial observation normalizes and installs the baseline/display.
2. If the raw owner `tid` changes by `Object.is`, including A → B → A and
   A → invalid → A:
   - advance owner generation and Like ticket;
   - retire the active attempt and synchronously set `likeBusy = false`;
   - install the new owner's normalized baseline/display;
   - the old completion, rejection, or logical cleanup has no authority.
3. If `tid` is unchanged:
   - update the baseline from the newest props;
   - update the displayed value even while the request is pending;
   - do not advance generation/ticket and do not release busy;
   - current authoritative success may still replace that baseline;
   - current failure must restore this newest baseline, not click-time values.
4. Save-only projections do not change these three inputs and therefore must not
   alter a pending Like attempt.

The production behavior test must also update `tid`, `liked`, and `likeCount` in
one real parent rerender, not only by sequentially assigning test refs. This
locks the final synchronous Vue props boundary rather than a test-only update
order.

The Footer keeps avatar-error ownership separate. Its avatar URL watcher may
reset `avatarError`, but must not be coupled to the Like generation or baseline.

## Admission and completion ordering

### Admission

`handleLike()` returns a semantic `Promise<void>`.

- If disposed, busy, or `tid` is not a positive integer, it returns a promptly
  settled Promise and performs no API call or state change.
- Otherwise it captures the current owner/generation/ticket/tid, computes the
  inverse desired value, applies the normalized optimistic display, marks busy,
  and calls `toggleLike(capturedTid, desiredLiked)` exactly once.
- Repeated presses while busy are ignored and must not create another request,
  attempt, generation, or ticket. The duplicate call may return its own promptly
  fulfilled Promise; it must not reuse or wait on the active action Promise.

### Current authoritative success

After the API fulfills, recheck terminal state, owner generation, Like ticket,
and the active attempt identity. If any check fails, return silently.

For a current success, the exact observable order is:

1. normalize the authoritative `response.liked` and `response.likeCount`;
2. update baseline and displayed refs from that response;
3. retire the active attempt and set `likeBusy = false`;
4. publish exactly one frozen Like settlement using the captured positive `tid`;
5. return with no `finally`, component `liked` emit, feedback, or other write
   after publish.

This ordering makes a subscriber's synchronous inverse `handleLike()` a real
new action. The old continuation must not clear or mutate that new action when
the outer handler returns. A throwing subscriber is already isolated by the
channel and must not reject or reinterpret the successful handler.

### Current failure

If the API rejects and the attempt still owns the current generation/ticket:

1. restore displayed refs from the **latest same-tid baseline**;
2. retire the active attempt and set `likeBusy = false`;
3. publish no settlement and return fulfilled.

Stale rejection is silent and cannot restore old values or clear a new owner's
busy state. F3h intentionally preserves the existing no-toast Footer failure
surface; error feedback can be a separate bounded product decision.

### Terminal disposal

`dispose()` is terminal and idempotent:

- set disposed before other cleanup;
- advance generation/ticket, retire the active attempt, and synchronously clear
  busy;
- stop all owned watchers;
- late success/rejection/channel delivery has no state, event, or busy authority;
- `onScopeDispose(dispose)` uses the same path;
- post-dispose `handleLike()` never calls the API.

## Feed projection integration

No F3h change is allowed in the channel or Feed consumer.

The existing F3f/F3g guarantees remain authoritative:

- a current Like settlement shallow-replaces only the matching positive `tid`,
  preserving slot and all non-reaction fields;
- Like and Save fields remain independent;
- a physical replace/refresh/append request captures its reaction boundary
  immediately before `fetchFeed` and overlays only later request-local events;
- an event settled before a later physical request does not replay or override
  that response;
- stale/superseded request projections do not transfer;
- dispose unsubscribes and remount has no replay.

F3g continuity must also remain true in production:

- Footer Like settlement is a reaction-only shallow replacement;
- it must not close a Context menu, change its frozen snapshot, clear a pending
  Save/Share, or roll back a confirmed bookmark;
- a true non-reaction replacement still invalidates the Context owner.

## Required red-test matrix

Add one behavior suite that executes the production composable and the real
production Footer seam. It may use Vue's custom renderer/lifecycle harness and
module mocks, but must not duplicate the state machine or use a fake channel.
The missing new module must not reduce the whole suite to one collection error:
old runtime must reach multiple semantic assertions through the existing
Footer, while type/structure gates separately lock the new surface.

The red commit does not add a runtime placeholder. Existing-Footer cases import
and mount that SFC normally. Direct new-composable cases must use a test-body
runtime import (`await import(...)`/`vi.importActual(...)`) and fail closed when
the module is missing; they must not top-level import the absent module, skip,
conditionally return, inspect file existence, or substitute a fallback fake.
After the module exists, every direct case must execute the real exported
composable.

1. **All normalization ingress points.** Direct production-composable cases
   separately feed fractional, negative, missing, `NaN`, `Infinity`, and
   `-Infinity` counts through initial props, idle same-tid rebase, pending
   same-tid rebase, optimistic decrement/increment, and authoritative response.
   At every stage the local displayed count and `likeLabel` expose a finite,
   truncated, non-negative integer; do not rely on the real channel's second
   normalization to hide a bad producer value. For the authority discriminator,
   start false/count 2, click desired true, and return
   `{ liked: false, likeCount: 7.9 }`; final label/state/event are false/7, not
   desired. Spy the real factory port's `publish` call while retaining its real
   implementation and assert the producer input is already normalized before
   channel delivery. Event uses the captured positive `tid`.
2. **Busy single-flight and semantic Promise.** The first Footer click returns a
   Promise that stays pending with its deferred transport; a rapid second call
   creates no request/ticket and its own Promise fulfills promptly while the
   first remains pending. Success/failure settles only the first logical action.
3. **Same-tid latest baseline.** During a pending Like, deliver same-tid external
   liked/count props that differ from click-time values. Pending display/baseline
   rebases without clearing busy. Current failure restores that latest baseline,
   publishes zero events, leaves a normalized failure label, and a retry
   publishes once.
4. **Save-only projection continuity.** Pending Footer Like → Context Save
   settlement through the same real port and mounted real Feed, with the Footer
   refs derived from the matching Feed item. First prove matching item identity
   was shallow-replaced and bookmark changed; the Like attempt must remain busy
   and current, then publish exactly once on success.
5. **Real Context integration.** Use one real mounted Feed, real Context actions,
   and Footer producer on the same port. Cover two distinct states:
   - keep a live menu open with its frozen Report snapshot, publish Footer Like,
     and prove the matching item identity changes while menu visibility and the
     detached title/item/bounds remain unchanged;
   - admit Save, reopen, admit Share, then reopen a third menu before Footer Like
     so Save/Share each hold captured action snapshots while a live menu snapshot
     also exists. Footer publication must preserve both tickets/busy states and
     the third menu snapshot; Report still emits its original detached payload,
     and Save/Share can settle normally without bookmark rollback.
     A confirmed Context Save followed by Footer Like must make the next Save
     direction the opposite of the confirmed value.
6. **Owner transitions.** Parameterize A → B and A → B → A, with old A success
   and rejection. Old completion publishes zero, changes no B/new-A state, and
   cannot clear a new owner's busy action. Include one real parent rerender that
   atomically changes tid/liked/count. Parameterize invalid `tid` as zero,
   negative, fractional, `NaN`, `Infinity`, and `-Infinity`; API, display/busy,
   and event remain unchanged. Do not expose internal tickets only for testing;
   A → invalid → A supplies the observable stale-attempt discriminator.
7. **Same-tid success after rebase.** Props rebase while pending, then current
   response direction/count deliberately differs; response wins and publishes
   exact normalized values.
8. **Publish-terminal reentry.** A subscriber observes final baseline/display and
   `likeBusy = false`, synchronously starts the inverse Like, and records new
   busy/request state. After the outer handler returns, the second action remains
   busy and untouched until its own response. Settle the second response too and
   assert two ordered, response-valued settlements and final `likeBusy = false`.
9. **Listener isolation.** A prior listener throws; the next listener and Feed
   receive the event exactly once, and the successful handler fulfills without
   rollback.
10. **Injected port isolation.** Action and Feed share a real factory port while
    the named singleton is observed separately. Only the injected port receives
    the event. No factory reset or fallback fake is allowed.
11. **Production default singleton and API seam.** Mount the real Footer with no
    port or dependencies and a Feed using its required `detailOpen`/`closeDetail`
    options but omitting `settlements`, in the same module graph. Mock the default
    API only; first prove it was called once with captured tid/desired, then return
    an opposite-direction, fractional-count response. Footer, named singleton
    subscriber, and Feed must all use the normalized response rather than desired
    state. The production Footer must not import reactions, construct a channel,
    inject dependencies, or bypass the default API.
12. **Physical request boundary and real unmount topology.** Split the evidence:
    - for refresh and append, use the real mounted Footer/Feed path, first prove
      `fetchFeed` is physically called and deferred, then settle Footer Like,
      then return stale reaction fields with newer title/body; settlement wins
      reactions and transport wins the other fields;
    - replace synchronously clears Feed items and unmounts the real Footer. In a
      true nested Footer path, admit Like, start replace, prove unmount/dispose,
      then settle Like and require zero event/Feed write;
    - test replace consumer overlay separately with an independent but real
      production-composable producer sharing the real port with Feed. This is a
      consumer-boundary seam, not a claim that the removed card stays mounted.
      In the inverse order—Footer settlement, then a later physical
      replace/refresh/append—the later response wins.
13. **No replay/request-local retirement.** Late subscriber gets no old event and
    does not advance sequence; dispose/remount with the same port receives no old
    state; first new fetch is authoritative; superseded request-local projection
    does not transfer to the next request.
14. **Dispose paths.** Explicit dispose and scope unmount each release busy
    immediately, stop owned watchers, reject post-dispose admission, and make
    late success/rejection silent. A fresh instance on the same port still works.
15. **Type/default structure, Footer wiring, and dead-event removal.** The new
    composable publicly declares top-level optional
    `settlements?: PostReactionSettlementPort` and independent
    `dependencies?: { toggleLike?: typeof togglePostLike }`. It imports the port
    type and named singleton from the exact `../reactions` barrel, imports the
    API from its established module, and resolves
    `options.settlements ?? postReactionSettlements` plus
    `options.dependencies?.toggleLike ?? togglePostLike`; no deep import,
    factory, env/test branch, or fallback singleton is allowed.
    `FeedItemCardFooter.vue` calls it with real `tid/liked/likeCount` prop
    refs/getters, binds the returned refs/handler to the real button, and keeps
    avatar-error reset separate. It no longer imports/calls `togglePostLike`,
    defines/emits `liked`, imports reactions, or passes settlements/dependencies.
    Shell/Card/List/View contain no `@liked` relay or settlement prop plumbing.
16. **Regression guards.** F3a merge, F3b owner resolution, F3c intents/dispose,
    F3e Context actions, F3f Detail projection, F3g Context Save projection,
    card control isolation, avatar fallback, keyboard/short-click, and existing
    structure gates remain green.

## Allowed files

Runtime:

- `src/features/feed/useFeedCardLike.ts` (new)
- `src/features/feed/FeedItemCardFooter.vue`

Tests and inventory:

- `tests/composables/feedFooterLikeSettlement.test.ts` (new)
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs` (`169 → 170` Vitest files; Node remains
  `65`)

Task/acceptance documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-footer-like-settlement-publication.md`
- `docs/agent/handoffs/feed-footer-like-settlement-publication.md` (new at
  acceptance)

The red-test commit may change only the new behavior test, the existing
structure test, and inventory. The runtime commit may change only the two
runtime files. Acceptance documentation is a separate final commit.

## Forbidden in F3h

- No change to `src/features/reactions/**`, `useFeedData.ts`,
  `useFeedCardContextActions.ts`, `FeedItemCard.vue`, `FeedItemCardShell.vue`,
  Feed list/view, Detail/Profile, API adapters/DTOs, auth/storage, backend,
  dependencies, service worker, or deployment configuration.
- No settlement prop relay through Card/Shell/List/View.
- No replay cache, persistence, cross-tab broadcast, Pinia/global entity store,
  account guessing, server-revision synthesis, retry queue, or transport abort.
- No optimistic settlement publication, click-time failure rollback, old `liked`
  emit, broad `finally`, or writes after publish.
- No claim that Feed and Detail are now bidirectionally or globally canonical.
- No external/remote network, remote backend, online browser, credential,
  production, push, merge, or deploy action.

## Compatibility and known risks

- No API, DTO, schema, storage, dependency, service-worker, or backend migration.
- Footer DOM/button semantics, optimistic interaction, labels, avatar fallback,
  visibility badge, and card-control event isolation remain compatible.
- The channel remains no-replay and process-local. A fresh Feed must fetch server
  state.
- Profile liked collections are not immediately projected.
- Same mounted-session external account changes remain outside the channel's
  identity model.
- Server responses have no reaction revision, so genuinely concurrent clients
  remain last-response/eventually-consistent.
- Detail is still not a consumer of Footer settlements. Footer Like while Detail
  GET/action is pending can leave Detail stale; that requires a separate owner
  and physical-boundary design.
- Local component/loopback tests cannot prove every physical mobile browser's
  event scheduling, though this batch does not alter pointer interaction.

## Validation gates

Before local acceptance:

1. New Footer settlement behavior suite fully green.
2. Updated Footer/Card structure gate fully green.
3. F3e/F3f/F3g behavior and accepted Feed regression suites green.
4. Inventory reports `170 Vitest / 65 Node`.
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

- Accepted prerequisite: F3g head `3a56e12`.
- Commit chain: task contract `e217f6e` -> red tests and inventory `d67b320` ->
  runtime implementation `956eff8`.
- The new behavior suite passed 42/42; the four F3e-F3h behavior files passed
  140/140; eight core acceptance files passed 177/177; the structure suite
  passed 20/20; and related Footer coverage passed 30/30.
- Full validation passed 170 Vitest files / 4,286 tests and 65 Node structure
  files / 830 tests. The production build transformed 647 modules and produced
  71 PWA entries; the HTML sanitizer and all 3 loopback smoke checks passed.
- Full `npm run verify` exited 0 in about 97.4 seconds.
- Two independent reviewers returned `ACCEPT` with no blocking finding.
- The accepted file scope is exactly two runtime files, three red-test/inventory
  files, and three acceptance-documentation files.
- This is a local frontend acceptance only. It used no external/remote network
  or remote backend; the only network/server activity was the 3 hermetic
  localhost loopback preview checks. It performed no push, merge, deployment,
  production mutation, or production validation.

## Rollback

Revert in reverse order:

1. acceptance documentation commit;
2. runtime commit `956eff8`;
3. red-test and inventory commit `d67b320`, restoring inventory `170 → 169`;
4. task commit `e217f6e`.

Rollback requires no DB, Redis, browser storage, schema, cache, service-worker,
or backend cleanup. Already-successful Likes are ordinary user/server state and
must not be undone by a code rollback. No online rollback is needed because this
batch is not deployed.

## Acceptance authority

This task authorizes only the exact local files and validation commands above.
Runtime work begins only after the contract and red matrix are independently
reviewed. Local acceptance requires the specified evidence and reviewers; it
does not authorize push, merge, deployment, production access, remote/backend
access, or a claim of durable/global reaction reconciliation.
