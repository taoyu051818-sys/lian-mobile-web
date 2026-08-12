# Task: Detail-settled reactions projected into the mounted Feed

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3e head `f031b22`, with runtime implementation
  `e917b8b`.
- Working branch: `codex/audit-f3f-feed-detail-like-reconciliation`.
- Status: locally accepted on 2026-08-10.
- Local commit chain: task `bb33ef1`; red tests `6fc4bdd`; required feature
  public-surface clarification `d10090f`; external-owner predicate test
  strengthening `e2fd712`; runtime implementation `e804e46`.
- Current code, root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
  `docs/agent/README.md`, `docs/agent/00_AGENT_RULES.md`, the accepted F3a-F3e
  tasks, and the local Feed/detail/reaction implementations were checked.
- Recent online issues and merged pull requests are intentionally not queried
  because the user paused network/security-related activity.
- This task is local frontend code and hermetic tests only. It authorizes no
  push, merge, deployment, production mutation, remote/backend server access,
  credential use, or online browser journey.

## Reproduced problem

The App-level Detail surface opens over the still-mounted Feed. Detail reaction
actions are locally authoritative only inside `usePostReactions`:

1. Feed item A starts with `liked: false`, `likeCount: 4`, and
   `bookmarked: false`.
2. The user opens A in Detail and the existing Like or Save API returns a
   successful authoritative response.
3. Detail updates its own refs, but `useFeedData.items` receives no result.
4. Closing Detail exposes the still-mounted Feed card with the old reaction
   state. F3e's truthful Bookmark menu also resets from that stale item object.

A naive module event or direct list patch is insufficient. A Feed refresh or
append request that physically started before the Detail action can return
after the settlement and replace the list with an older reaction snapshot.
The current Feed merge correctly treats transport items as complete snapshots,
so an unowned patch would be overwritten.

The existing Detail owner check is also only `postId.value === capturedId`.
`resetReactions` runs for every new `PostDetail` snapshot, including a reload of
the same tid, and clears busy state. An old A1 request can therefore settle
after A2 has started, pass the tid-only predicate, overwrite A2, and publish an
obsolete result unless this task adds a real reaction generation.

`FeedItemCardFooter` emits a local `liked` component event, but the Shell/Card/
List chain does not consume or forward it. This task does not treat that event
as an existing reconciliation path and does not broaden into Feed-originated
reaction ownership.

## Product decision

F3f adds a small, ephemeral settlement channel for **Detail-originated Like and
Save API successes** and projects those settlements into the currently mounted
Feed instance.

This is deliberately not a durable canonical reaction store. It has no replay,
no persistence, no cross-tab transport, and no account identity. A later Feed
request that physically starts after a settlement is allowed to become the new
authority. The lane must be described as "Detail settlement projection into
the mounted Feed", not "all reactions are globally synchronized".

Like and Save belong in the same batch because they are exposed by the same
Detail composable, displayed by the same Feed item, have the same owner and
request-overlap hazards, and require the same three runtime files. F3e already
normalizes `FeedItem.bookmarked`; this task adds no API or DTO field.

### Ephemeral channel contract

Create `src/features/reactions/postReactionSettlements.ts` with one production
singleton and one factory for hermetic instances:

```ts
export type PostReactionSettlementInput =
  | Readonly<{
      kind: "like";
      tid: FeedItemId;
      liked: boolean;
      likeCount: number;
    }>
  | Readonly<{
      kind: "save";
      tid: FeedItemId;
      bookmarked: boolean;
    }>;

export type PostReactionSettlement =
  | Readonly<{
      sequence: number;
      kind: "like";
      tid: FeedItemId;
      liked: boolean;
      likeCount: number;
    }>
  | Readonly<{
      sequence: number;
      kind: "save";
      tid: FeedItemId;
      bookmarked: boolean;
    }>;

export interface PostReactionSettlementPort {
  currentSequence(): number;
  publish(input: PostReactionSettlementInput): PostReactionSettlement | null;
  subscribe(listener: (event: PostReactionSettlement) => void): () => void;
}

export function createPostReactionSettlementChannel(): PostReactionSettlementPort;
export const postReactionSettlements: PostReactionSettlementPort;
```

- Only a positive integer `tid` is accepted. Invalid input returns `null`, does
  not increment the sequence, and notifies nobody.
- Every accepted event receives the next monotonically increasing sequence and
  is normalized and frozen. Like counts are finite, truncated, and clamped to
  zero; `NaN` and either infinity normalize to zero. Boolean fields are
  explicit booleans.
- `subscribe` returns an idempotent unsubscribe function. Publish iterates a
  snapshot of current listeners and isolates each listener with `try/catch`.
  One throwing or re-entrant listener cannot stop later listeners or throw back
  into a successful API action.
- The channel stores only its scalar sequence and listener set. It stores no
  event history and never invokes a new subscriber with an old settlement.
- The factory is the only test isolation seam. `usePostReactions` and
  `useFeedData` each accept one optional `settlements` port and otherwise use
  the production singleton. There is no test-only reset export and no second
  production path.

### Detail publisher ownership

`usePostReactions` gains a shared lifecycle/post-snapshot generation plus
independent Like and Save tickets:

- Every `resetReactions(nextPost)` advances the generation, even when the tid is
  unchanged. It invalidates both old tickets, rebases both reaction states from
  the new snapshot, and releases their old busy refs.
- Like and Save remain independently single-flight and may run concurrently for
  one current snapshot. Starting one cannot stale or clear the other.
- Each admitted action captures generation, its own ticket, post id, previous
  state, and the existing external `isStillCurrent` predicate.
- Scope disposal is terminal for the composable: advance generation/tickets,
  clear busy state, and make every old success, failure, feedback, publish, and
  `finally` continuation silent. Tests use a real Vue effect scope; production
  needs no new component wiring.
- Only an authoritative API success that still owns all of the following may
  commit or publish: non-disposed scope, matching generation, matching action
  ticket, and a true external current-post predicate.
- Like publishes the response's exact `liked` and normalized `likeCount`.
  Save publishes the response's exact `saved` as `bookmarked`.
- Optimistic state, request admission, failures, rollback, stale success, and
  stale `finally` never publish.
- Listener exceptions are already isolated by the port and therefore cannot
  turn API success into the composable's catch/rollback/error path.

This task does not publish Feed-card Footer likes or F3e context-menu saves.
Those producers retain their existing local behavior and remain a documented
follow-up.

### Mounted Feed projection and transport boundary

`useFeedData` subscribes synchronously when its instance is created and
unsubscribes on `dispose()`.

- Maintain only the latest delivered sequence number per tid/kind for this Feed
  instance, solely to reject out-of-order or nested/re-entrant callbacks. Do not
  retain a replayable event value after it is no longer owned by a physical
  request.
- A current settlement immediately replaces only the matching item's reaction
  fields in `items.value` by shallow-replacing that matching `FeedItem` object.
  Never mutate it in place: F3e's card action owner watches item identity to
  rebase its independent Bookmark ref. Preserve slot order, every non-reaction
  field, and the object identities of all nonmatching items. Unknown tids are
  not appended.
- Every physical Feed request captures `reactionBoundary` only after history
  ownership has resolved, after the existing generation/lifecycle guard, and
  immediately before `fetchFeed(...)` is called. Logical admission time is not
  the boundary.
- Once that boundary exists, the active request records its own latest Like and
  Save settlement per tid when `event.sequence > reactionBoundary`. Events that
  arrived before the boundary are never copied into that request projection.
- On a current response, first perform the existing F3a complete-snapshot merge
  exactly as today. Then apply only that request's recorded post-boundary
  settlements, shallow-replacing any item whose reaction projection changes.
- Like and Save are projected field-wise and independently. The newest Like
  sequence determines `liked/likeCount`; the newest Save sequence determines
  `bookmarked`. Transport remains authoritative for title/body/actor and every
  other field.
- A settlement delivered while the request is physically pending therefore
  survives that response. A settlement delivered before physical request start
  does not stick over the later response, even if the logical request was
  waiting for auth/history ownership when the settlement occurred.
- Request failure performs no merge, so an immediate settlement patch remains.
  A subsequent retry captures a new physical boundary and its response may win.
- Existing request supersession, logical completion, intent failure policy,
  generation guards, and F3a merge semantics remain unchanged.
- A request's pending settlement projection is discarded on settle,
  supersession, or disposal. It cannot become a long-lived per-tid cache.
- `dispose()` first makes the Feed terminal and unsubscribes, then keeps the
  existing request invalidation. It clears the instance-local settlement maps.
  A new Feed instance receives no old events and trusts its own fetch.

## Required invariants

- A confirmed, current Detail Like immediately updates the matching mounted
  Feed item's `liked` and `likeCount`; confirmed Save updates `bookmarked`.
- Neither optimistic UI nor failed/stale action work is broadcast.
- A same-tid snapshot reset and A-to-B-to-A sequence invalidate old work; old
  result/error/finally cannot publish, show feedback, or clear new busy state.
- Like and Save tickets are independent under one snapshot generation.
- A listener exception cannot roll back a successful Detail action or block
  another subscriber.
- An after-physical-start settlement cannot be overwritten by that request's
  late response; a before-physical-start settlement is not a sticky cache and
  the later response may win.
- Multiple and re-entrant settlements use sequence order per kind. Like cannot
  overwrite Save and Save cannot overwrite Like.
- A matching event never moves a card or erases transport fields; an unknown
  tid never creates a card.
- Disposal and remount provide no replay or persistent state.
- F3a identity merge, F3b history ownership, F3c request intents/completions,
  F3d sentinel recovery, and F3e context-action ownership remain green.

## Allowed files

Runtime:

- `src/features/reactions/index.ts` (new public surface required by the
  repository feature-boundary guard; re-export only)
- `src/features/reactions/postReactionSettlements.ts` (new)
- `src/features/detail/usePostReactions.ts`
- `src/features/feed/useFeedData.ts`

Tests and inventory:

- `tests/composables/feedDetailReactionSettlement.test.ts` (new)
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-detail-reaction-settlement-projection.md`
- `docs/agent/handoffs/feed-detail-reaction-settlement-projection.md`

## Forbidden files and non-goals

- No file outside the exact Allowed files list.
- No changes to API clients or response DTOs, `FeedView.vue`, `FeedList.vue`,
  `FeedItemCard.vue`, `FeedItemCardShell.vue`, `FeedItemCardFooter.vue`, F3e
  context-action runtime, `PostDetailPanel.vue`, Detail FSM/surface, Profile,
  auth/session, storage, backend, dependencies, service worker, deployment, or
  production.
- No Feed-originated Like/Save publication, optimistic event, durable entity
  store, replay, persistence, cache hydration, cross-tab messaging, or server
  revision invention.
- No claim that Profile liked/saved collections or context-menu/Footer local
  state across unmounts are now canonical.
- No account token is guessed from a viewer-specific reaction. Same-mounted-
  instance external/cross-tab session change remains a known auth-epoch gap.
- No cursor pagination, page restoration, request cancellation, or Feed visual
  redesign.
- No online E2E, server fixture, credential, remote seed, or production check.

## Test-first matrix

The new Vitest file must import and execute the production channel,
`usePostReactions`, and `useFeedData`. It may inject a factory-created channel,
mock the existing API transports, and use real Vue refs/effect scopes, but it
must not copy the production state machines.

During the red phase the not-yet-existing channel must be loaded through a
controlled dynamic import so the suite still collects and reports independent
failures; one missing module must not collapse the whole matrix into a single
collection error. Once runtime exists, every channel assertion executes the
real production factory. At least one integration case must omit injection and
prove that the two composables share the real production singleton.

1. Channel valid Like/Save publications get frozen monotonic events; invalid
   tids do not increment or notify; fractional/negative counts normalize and
   `NaN`/positive or negative infinity become zero.
2. Unsubscribe is idempotent. A throwing listener does not block a later
   listener or escape `publish`. Re-entrant publication preserves increasing
   sequence and lets consumers reject the older outer event.
3. Current Like success publishes nothing while optimistic/pending, then one
   exact authoritative event for both Like and Unlike/count-zero responses.
   At least one response must be the opposite of the optimistic desired value,
   proving the publisher did not reuse request direction.
4. Current Save success publishes one exact authoritative Bookmark event.
   Save admission and optimistic state do not publish; at least one response is
   the opposite of the desired Save value.
5. Like/Save rejection rolls back and publishes zero events. A false external
   current predicate makes success, failure, feedback, publish, and finally
   stale without disturbing the rebased owner.
6. Same-tid reset and A-to-B-to-A sequences invalidate old Like/Save work. A
   newer action may start after reset; old settle order cannot write state,
   feedback, events, or the newer action's busy flag. Like and Save can settle
   in either order without invalidating each other.
7. Scope disposal while Like/Save are pending immediately releases busy; late
   resolve/reject is silent and publishes nothing.
8. With matching items already mounted, Like and Save events immediately patch
   only their own fields. The matching item is a new object, card slot/order and
   unrelated fields stay intact, nonmatching item object identities remain
   exact, and unknown tid is not appended. Wire the accepted F3e
   `useFeedCardContextActions` to that live item ref and prove a Save settlement
   rebases its Bookmark state before the menu is reopened; an in-place mutation
   must fail this test.
9. For each `replace`, `refresh`, and `append`, start a deferred physical Feed
   request, publish a settlement, then return stale reaction fields plus newer
   title/body data. The response keeps transport non-reaction fields while the
   post-start settlement wins only its reaction fields.
10. Admit initialize while auth/history ownership is unresolved, publish a
    settlement, then resolve ownership so `fetchFeed` starts. The response must
    win because the settlement preceded physical start. A settlement followed
    by an ordinary already-owner-ready request has the same response-wins rule.
11. Make the `fetchFeed` mock synchronously publish from inside its function
    body before returning its response promise. That settlement must be newer
    than the pre-call boundary and overlay the response. This rejects an
    implementation that invokes transport first and reads `currentSequence()`
    only afterward.
12. Publish Like true, nested/re-entrant Like false, and Save true while one
    request is pending. Final response projection uses the newest Like sequence
    and independent Save sequence, never delivery-stack order.
13. A settlement during a failed request remains immediately visible. Exact
    retry starts after that event and its response may become authority.
14. Supersede an old physical request around settlements. The stale response
    cannot commit; the current request uses only its own physical boundary.
15. Dispose during pending transport, then publish and settle late work: no
    state/error/busy write. A new Feed instance receives no old event; its first
    response alone determines reactions.
16. Put a throwing subscriber before the mounted Feed subscriber, then complete
    a Detail Like/Save. Detail remains successful and Feed still receives each
    exact event once.
17. Register a listener before constructing Feed that calls `feed.dispose()`
    during the same publish delivery. The channel's listener snapshot may still
    invoke the now-unsubscribed Feed callback. Snapshot state immediately after
    `dispose()` returns; the late callback must leave items/error unchanged and
    all three busy flags at that terminal false baseline.
18. Without an injected port, create real Detail and Feed composables, complete
    a current reaction, and prove the production singleton links them. This
    prevents an implementation whose injected test path works while the two
    production defaults are different instances.
19. Existing F3a item identity, F3b history owner, F3c request intent/dispose,
    F3d sentinel, F3e action, Detail feedback, adapter, and inventory guards all
    remain green.

The old implementation must fail because the production channel does not
exist, Detail publishes no settlement, and Feed has no request-boundary
projection. Existing unrelated guards must remain green.

## Validation commands

Focused red/green validation:

```bash
npx vitest run \
  tests/composables/feedDetailReactionSettlement.test.ts \
  tests/composables/useFeedData.item-identity.test.ts \
  tests/composables/useFeedData.request-race.test.ts \
  tests/composables/useFeedData.read-history-scope.test.ts \
  tests/composables/useFeedData.request-intent.test.ts \
  tests/feed/feedCardContextActions.test.ts
node --test tests/detail/reaction-feedback.structure.test.mjs
npm run check:test-inventory
npm run build
npm run verify
```

Also run changed-file Prettier and ESLint, `vue-tsc --noEmit`,
`git diff --check`, the existing Feed/detail structure guards, and the full
local verification bundle. The new Vitest file raises inventory from 167 to
168; Node inventory remains 65.

## Acceptance evidence

- The original red phase collected the complete suite: 23 intended F3f
  failures while 76 existing F3a-F3e guards remained green. Independent review
  then found and closed an external-owner-predicate false-green seam before
  acceptance.
- Final F3f behavior: 24/24; combined focused Feed/Detail/F3e regression: 6
  files and 100/100 tests.
- Full `npm run verify` passed in 94.8 seconds: 168 Vitest files / 4,209 tests,
  65 Node structure files / 824 tests, production build with 646 transformed
  modules and 71 PWA precache entries, HTML sanitizer, repository guards, and
  3/3 loopback smoke checks all passed. Lint retained only the existing
  warnings.
- Two independent reviewers inspected the channel, Detail generation/tickets,
  physical-request boundary, per-kind projection, disposal/no-replay, test
  discrimination, public feature surface, and exact file scope. Both recorded
  `ACCEPT` with no remaining blocker.
- All work stayed local. No push, merge, deployment, production mutation,
  remote/backend server access, credential use, online browser journey, or
  external network access occurred.

## Risks and mitigations

- Risk: a late Feed response reverses a confirmed Detail action. Mitigation:
  capture a sequence at physical request start and overlay only newer events.
- Risk: a sticky local event hides a later server correction. Mitigation:
  events at or before the physical boundary do not overlay that response.
- Risk: same-tid detail refresh publishes old work. Mitigation: snapshot
  generation plus independent action tickets and scope disposal.
- Risk: one bad listener turns success into rollback. Mitigation: listener
  snapshot iteration and per-listener exception isolation inside the channel.
- Risk: viewer-specific state crosses an account boundary. Mitigation in this
  lane is limited to no replay and ordinary Feed/Detail unmount disposal. A
  same-mounted-instance external auth change still requires a future shared
  auth epoch and is not claimed solved.
- Risk: task name overstates canonical state. Mitigation: all docs use
  "Detail-origin settlement projection into the mounted Feed" and enumerate
  excluded producers/consumers.

## Data, migration, compatibility, and rollback

- No database, Redis, browser-storage, service-worker, API, DTO, or schema
  migration.
- Existing Like/Save requests and responses are unchanged. The new channel is
  process-local, memory-only, and empty on application reload.
- Optional injected settlement ports are backward compatible internal test
  seams; production callers default to the singleton.
- Rollback reverts the bounded task/test/runtime/docs commits and changes the
  inventory from 168 back to 167. No client or server data cleanup is required;
  successful reaction writes remain ordinary server user data.

## Acceptance authority

- The implementation thread may report completion but cannot accept the lane.
- At least two independent reviewers must inspect Detail generation/tickets,
  listener isolation, physical-request boundary semantics, per-kind sequence
  projection, disposal/no-replay, test discrimination, and exact allowed-file
  scope.
- Only the primary review thread may record F3f as locally accepted.
- No push, merge, deployment, production mutation, remote/backend server
  access, or online validation is authorized by this task.
