# Task: Feed context-menu Save settlement publication

## Status and source

- Decision date: 2026-08-11.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3f head `2d0dd21`, with runtime implementation
  `e804e46`.
- Working branch: `codex/audit-f3g-feed-context-save`.
- Status: contract drafted; implementation has not started.
- Current code, repository rules/status, accepted F3a-F3f tasks/handoffs,
  `useFeedCardContextActions`, the F3f settlement port/Feed consumer, and their
  behavior/structure suites were checked.
- Recent online issues and pull requests are intentionally not queried because
  network/security-related work remains paused.
- This task is local frontend code and hermetic tests only. It authorizes no
  push, merge, deployment, production mutation, remote/backend server access,
  credential use, or online browser journey.

## Reproduced problem

F3e made Feed context-menu Save a real server action with authoritative result,
feedback, owner generation, and stale-result guards. Its confirmed value still
lives only in `useFeedCardContextActions.bookmarked`:

1. Feed item A is owned by `useFeedData.items` with `bookmarked: false`.
2. The user opens A's context menu and the Save endpoint authoritatively returns
   `saved: true`.
3. F3e shows success and updates only the card action ref. The Feed-owned A
   object remains `bookmarked: false`.
4. Recreating the card, receiving another Feed snapshot, or opening a new owner
   resets the context action from the stale Feed item.

F3f introduced another now-reachable interaction. A Detail Like/Save settlement
shallow-replaces the matching Feed item. The current F3e item watcher treats
**every** item identity replacement as a new owner, increments both Save and
Share tickets, closes the menu, and rebases `bookmarked` from that item:

- after a confirmed local context Save, a later Like-only projection preserves
  Feed's stale `bookmarked: false`; the watcher then visibly reverts the
  confirmed Save;
- if Save is physically pending when a Like projection arrives, the same
  watcher invalidates its ticket and clears busy. The server may then confirm
  Save, but the continuation is silently discarded, produces no feedback, and
  still does not update Feed;
- an unrelated Share for the same card can also be invalidated by a reaction-
  only shallow replacement.

A one-line `settlements.publish()` after the Save response is not enough unless
the owner watcher distinguishes same-card reaction projection from a real card
owner replacement and unless success ordering prevents the action from
invalidating itself.

## Product decision

F3g makes the F3e context-menu Save action a producer on the existing F3f
settlement channel and adds a narrow same-card reaction-projection continuity
rule to its item watcher.

This batch is deliberately specific to **context-menu Save → mounted Feed**.
Footer Like remains a separate owner/baseline state machine and is the next
producer batch after F3g. F3g does not make Detail a live consumer, update
Profile collections, add replay/persistence, or solve account/server revision
ordering.

The result must be described as "authoritative context Save projected into the
mounted Feed owner", not global or durable reaction synchronization.

## Runtime port

Extend the existing options at the top level:

```ts
export interface UseFeedCardContextActionsOptions {
  item: Readonly<Ref<FeedItem>>;
  title: () => string;
  emitOpen: (id: FeedItemId, payload?: { item: FeedItem; rect: FeedCardBounds }) => void;
  settlements?: PostReactionSettlementPort;
  dependencies?: FeedCardContextActionDependencies;
}
```

- Resolve the port once as
  `options.settlements ?? postReactionSettlements`, importing the type and named
  production singleton from the existing `../reactions` feature barrel.
- The settlement port is ownership infrastructure, not an API/UI dependency;
  it must not be placed inside `dependencies`.
- Production `FeedItemCard.vue` continues to omit the option and therefore uses
  the named production singleton. It must not import the channel, create a
  factory, or inject another port.
- Tests may inject one real factory port. There is no fake channel, reset hook,
  replay cache, or second production path.

## Same-card reaction projection continuity

The item watcher must distinguish two transitions.

### Real owner replacement

Keep the F3e behavior when any non-reaction ownership field changes, keys are
added/removed outside the reaction set, or tid changes:

- advance `ownerGeneration`, `saveTicket`, and `shareTicket`;
- release Save/Share busy refs;
- close and discard the frozen menu snapshot;
- rebase `bookmarked` from the new item.

This remains true for a same-tid full snapshot whose title/body/actor/
presentation data or nested references changed. A→B and A1→A2 full-owner
replacement stay protected.

### Same-card reaction-only shallow replacement

Treat an item replacement as the current owner only when all of the following
are true:

- old and new `tid` are equal;
- after excluding exactly `liked`, `likeCount`, and `bookmarked`, both objects
  have the same own-key set;
- every remaining field is `Object.is`/strict-reference equal.

For that transition:

- rebase only `bookmarked` from the new item;
- do not advance owner generation or either action ticket;
- do not clear Save/Share busy;
- do not close the menu or discard its frozen item/title/bounds snapshot.

F3f's immediate Like/Save patch always has exactly this shallow-replacement
shape and preserves every non-reaction field/reference. A request-response
overlay first merges the complete transport snapshot; it is continuity only if
that merged item still has the same complete non-reaction own-key set and every
non-reaction value/reference remains `Object.is` equal to the current owner.
Otherwise it is a real owner replacement. The continuity rule therefore
recognizes channel projection without guessing from tid alone.

The menu's frozen `ownerToken` stays the original opaque identity. It is never
mutated or replaced. Continuing a reaction-only transition is safe because the
post tid and all captured non-reaction action inputs remain identical;
Bookmark direction already derives from the live `bookmarked` ref.

## Save action settlement ordering

Admission remains F3e behavior:

- require a live frozen menu snapshot;
- use the captured snapshot tid and current settled `bookmarked` ref to derive
  `desiredSaved`;
- keep Save single-flight and independent from Share;
- close the menu at admission while allowing the same owner to reopen it during
  the pending request;
- publish nothing before the API response.

Only a continuation that still owns non-disposed state, matching owner
generation, and matching Save ticket may complete.

### Current success

The exact observable order is:

1. normalize `settledSaved = Boolean(response.saved)`; never reuse
   `desiredSaved`;
2. commit `bookmarked = settledSaved`;
3. retire the Save attempt by releasing `bookmarkBusy` before any re-entrant
   subscriber can start another Save;
4. deliver the existing haptic and exact success copy based on
   `settledSaved`;
5. as the final observable producer side effect, publish one Save settlement
   using the **captured snapshot tid** and `settledSaved`.

Failures from the success haptic and success toast are isolated independently at
their call sites. A haptic failure does not skip the success toast; a success-
toast failure does not trigger the API-failure toast. Neither failure rejects the
handler, suppresses the authoritative settlement, or changes the publish-last
ordering.

There is no old-attempt state write, feedback, ticket change, or unguarded
`finally` after publication. A listener may synchronously start the next Save,
replace the owner, dispose the scope, throw, or publish re-entrantly; the old
attempt must not clear or overwrite the resulting state. The real channel
isolates listener exceptions.

The own Save event shallow-replaces the Feed item. The new reaction-only watcher
branch rebases the same settled value without invalidating the menu, Save/Share
tickets, or owner.

### Current failure

- A current failure publishes nothing and preserves the newest settled
  `bookmarked` ref.
- Release `bookmarkBusy` before showing the existing `ERROR_SAVE_ACTION` toast
  once.
- A stale failure is completely silent.
- There is no shared `finally` capable of clearing a newer owner/action busy
  state.

### Replacement and disposal

- A real owner replacement retains F3e's synchronous invalidation. B can act
  immediately; old A success/error/completion/publish cannot affect B.
- A same-tid non-reaction replacement is still a real boundary; old A1 cannot
  regain authority merely because the tid matches.
- Explicit and scope disposal remain terminal/idempotent and reject future
  action admission. Already-started requests may drain without state,
  feedback, or settlement authority.

## Existing Feed consumer compatibility

F3g changes no F3f channel or Feed consumer code. A current Save publication
must inherit these existing semantics:

- shallow-replace only the matching Feed item in its stable slot;
- preserve all non-reaction fields and every nonmatching item identity;
- update `bookmarked` from the response, including when it is opposite the
  requested direction;
- do not append unknown tids;
- overlay a settlement that arrives after a physical Feed request boundary over
  that response's stale bookmark while retaining newer transport fields;
- allow a request that physically starts after the settlement to become the
  later authority;
- retain request failure/supersession/dispose/no-replay behavior.

Tests must prove both injected-port isolation and the production default. A
no-option context action and no-option `useFeedData` must communicate through
the exported `postReactionSettlements` singleton. Production Footer/Card code
cannot substitute another channel instance.

## Required invariants

- Pending, desired, optimistic, failed, stale, replaced-owner, and disposed
  Save work never publishes.
- A current success publishes exactly once with captured tid and authoritative
  response value after state/busy/feedback have settled.
- A current failure releases busy, shows one existing error, preserves settled
  state, and publishes nothing.
- Like/Save reaction-only shallow replacements keep the same menu owner and do
  not cancel in-flight Save or Share.
- Reaction-only replacement rebases Bookmark direction while preserving the
  frozen title/item/bounds action snapshot.
- Any non-reaction or key-set change remains a real replacement and immediately
  invalidates old Save/Share work, including same-tid A1→A2.
- A confirmed context Save updates the matching mounted Feed item, so later Like
  projection preserves that bookmark instead of reverting it.
- A Like settlement arriving while Save is pending cannot make the eventual
  current Save success disappear. Share remains independently owned.
- A subscriber can observe settled Bookmark state and `bookmarkBusy=false`
  during delivery, start a second opposite Save, and keep that second busy after
  the outer promise returns.
- Default singleton, injected port, active physical request overlay, later
  response authority, unknown tid, disposal, and remount/no-replay keep F3f
  semantics.
- F3a identity merge, F3b history ownership, F3c request intents/completions,
  F3d sentinel recovery, F3e pointer/menu/share/report ownership, and F3f
  Detail-origin settlement suites remain green.

## Test-first matrix

Create `tests/composables/feedContextSaveSettlement.test.ts`, importing the real
production action composable, channel factory/singleton, and Feed consumer.

1. **Authoritative response and single-flight:** open captured A, start Save,
   assert zero events and one API call during pending, reject a rapid duplicate,
   then resolve with a value opposite `desiredSaved`. State, feedback, Feed
   item, and the single event all use the response value.
2. **Captured tid:** capture tid 11, mutate the live source after admission
   without creating a reactive owner transition, and prove API/event remain 11.
   A separate real item replacement invalidates the old action.
3. **Reaction-only continuity:** with the menu open and then with Save pending,
   deliver real Like and Save settlements through the same port to cover
   reaction-key addition/update. Cover removal of `liked`, `likeCount`, and
   `bookmarked` with direct same-tid item-ref replacements whose complete
   non-reaction key/value/reference set is unchanged; this must drive the real
   production watcher rather than a copied classifier or fake Feed subscriber.
   Menu snapshot, owner generation effect, Save/Share busy, and captured action
   remain; live Bookmark direction rebases to the newest item/event.
4. **Cross-producer regression:** start context Save, deliver a Like event that
   shallow-replaces the item, then resolve Save. Save still commits, gives one
   success feedback, publishes once, and the final Feed item contains both Like
   and Save fields. Repeat with Share pending to prove Like/Save projection does
   not cancel Share. Also finish a context Save and project it into Feed, then
   deliver a later Like settlement; reopening the menu and its next Save
   direction must still use the confirmed saved value.
5. **Real replacement:** parameterize a different tid and these same-tid A1->A2
   boundaries: an existing non-reaction scalar changes; a nested object has
   deep-equal content but a new reference; a non-reaction own key is added; and
   a non-reaction own key is removed. Run each while old Save work is pending,
   and at least one same-tid case while Share is pending. Each transition closes
   the old menu and invalidates old work synchronously. Old resolve/reject/
   publish/completion are silent; the new owner can start immediately, and old
   completion cannot clear current busy.
6. **Failure/retry with a newer baseline:** start Save, then use the same real
   port and mounted Feed to deliver a reaction-only Save settlement whose
   Bookmark differs from the click-time baseline. Reject the API request. The
   error callback observes `bookmarkBusy=false`, retains that latest settlement
   value, observes no event produced by the failed action, and receives exact
   `ERROR_SAVE_ACTION`. A retry success is the positive publication control.
7. **Publish-terminal re-entry:** reopen the menu while the first Save is
   pending. The first subscriber, during delivery, observes response state and
   `bookmarkBusy=false`, immediately starts the opposite Save, and sees new busy
   remain true after the outer action returns. Settle the second request and
   verify two ordered response-valued events.
8. **Throw/replacement/dispose during delivery:** use separate success cases for
   feedback isolation. If haptic throws, exact `toast.success` still occurs once,
   `toast.error` stays at zero, state/busy are settled, the handler fulfills, and
   one authoritative event publishes. If `toast.success` throws, haptic still
   occurs once, `toast.error` stays at zero, state/busy are settled, the handler
   fulfills, and one event publishes. An earlier channel listener may throw while
   a later listener still receives the event. Parameterize an early listener that
   replaces owner or disposes during publication; settled feedback already
   occurred, and no post-publish old write changes terminal/new-owner state.
9. **Pre-settle disposal:** explicit and scope disposal make late success and
   failure silent, release busy, stop the item watcher, reject later admission,
   and emit zero events. A fresh owner on the same factory port can still
   publish as a positive control.
10. **Injected mounted Feed:** one factory port drives real actions and real
    Feed. Matching item is shallow-replaced without moving slot/erasing other
    fields; nonmatching identities remain; unknown tid is not appended. The
    production singleton receives zero events in this injected case.
11. **Physical boundary:** for replace, refresh, and append, first prove the
    transport has actually been called and is deferred; then settle context
    Save and return an older bookmark plus newer non-reaction fields. Settlement
    wins Bookmark, transport wins other fields.
12. **Later request and no replay:** publish Save, register a late subscriber on
    the same real port and immediately assert zero callback/no sequence change;
    then start a later physical request whose response may win. Dispose/remount
    does not replay the old event and first fetch controls the new instance.
13. **Production singleton:** omit `settlements` from action and Feed and omit
    action `dependencies`, subscribe to the exported named singleton, and prove
    one real Save success through the mocked default Save dependency reaches both
    observer and Feed exactly once. A direct publish on that named singleton must
    also reach the no-option Feed.
14. **Production seam:** the existing `FeedItemCard.vue` action options omit
    `settlements` and `dependencies`, and do not import channel/factory symbols;
    therefore the real card uses production defaults. Existing handler/state
    back-reference structure guards remain intact.

Tests must use the real channel factory and real production composables, not a
copied state machine or fake port. They must not make missing imports, thrown
module initialization, or failed assertions conditionally pass.

## Allowed files

Runtime:

- `src/features/feed/useFeedCardContextActions.ts`

Tests and inventory:

- `tests/composables/feedContextSaveSettlement.test.ts` (new)
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-context-save-settlement-publication.md`
- `docs/agent/handoffs/feed-context-save-settlement-publication.md`

## Forbidden files and non-goals

- No file outside the exact Allowed files list.
- No changes to `src/features/reactions/**`, `useFeedData.ts`, Footer Like,
  `FeedItemCard.vue`, `FeedItemCardShell.vue`, `FeedList.vue`, `FeedView.vue`,
  Detail runtime/FSM/surface, Profile, API clients/DTOs, auth/session, storage,
  backend, dependencies, service worker, deployment, or production.
- No Footer Like publication in this batch. It is the next producer-owner task
  and depends on F3g so its Like item replacement cannot revert/cancel Save.
- No live Detail subscription, Detail GET/request-boundary change, Profile
  collection patch, persistent entity store, replay, cache hydration, cross-tab
  message, shared auth epoch, account identity, server revision, multi-device
  ordering, or new endpoint.
- No Share behavior/outcome redesign; F3g only prevents same-card reaction
  projection from cancelling its existing independent ticket.
- No remote/backend server request, online browser journey, push, merge,
  deployment, credential use, production mutation, or production claim.

## Compatibility and migration

- No schema, API, DTO, localStorage, IndexedDB, service-worker, or backend
  migration.
- The existing Save endpoint, request, response, haptic, labels, and toast copy
  remain authoritative and unchanged.
- Menu owner invalidation remains strict for every real card replacement;
  continuity is limited to F3f's exact shallow reaction projection shape.
- The F3f channel remains ephemeral/no-replay. This task adds one producer, not
  a cache or durable store.

## Verification gates

Red phase:

- New behavior test directly imports/calls production action + Feed and
  distinguishes old runtime without copying implementation logic.
- Old runtime must fail authoritative publication, cross-producer continuity,
  production singleton, and physical overlap cases while F3a-F3f guards remain
  green.
- Inventory changes from 168 Vitest files to 169; Node remains 65.
- Selected Prettier, ESLint, inventory, structure, and diff checks pass.

Green/acceptance phase:

- New behavior suite passes.
- Existing F3e context-action suite, F3f settlement suite, F3a-F3d Feed suites,
  wrapper structure tests, Vue typecheck, selected ESLint/Prettier, and inventory
  all pass.
- Full Vitest and Node suites, production build, sanitizer, local loopback
  smoke, and full `npm run verify` pass.
- At least two independent reviewers return `ACCEPT` with no blocking finding.
- Final diff contains only Allowed files; no generated artifact or EOL/stat
  noise is staged.
- Acceptance records exact test/build counts, commit chain, remaining Footer
  Like/Detail/Profile/cross-tab/account/server-revision risks, and local-only
  status.

## Rollback

- Revert runtime, red-test/inventory, task, and later acceptance-doc commits in
  reverse order.
- Inventory returns 169 → 168 when the new behavior file is reverted.
- No browser data, account data, DB, Redis, storage, service-worker, or server
  cleanup is required.
- A Save already accepted by the existing server is ordinary user data and is
  not undone by code rollback.
- Nothing is deployed in this task, so there is no online rollback action.
