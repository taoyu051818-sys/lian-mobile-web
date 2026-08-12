# Task: Feed card context-action truthfulness

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: accepted F3d head `30f056a`, with runtime implementation
  `750973b`.
- Working branch: `codex/audit-f3e-feed-context-actions`.
- Status: accepted locally on 2026-08-10. The task contract is `855365b`, the
  red-test commit is `899bae6`, and the runtime implementation is `e917b8b`.
  None has been pushed, merged, or deployed.
- Current code, root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
  `docs/agent/README.md`, `docs/agent/00_AGENT_RULES.md`, the accepted F3a-F3d
  tasks, and the local Feed/detail/share/reaction implementations were checked.
- Recent online issues and merged pull requests are intentionally not queried
  because the user paused network/security-related activity.
- This task is local frontend code and hermetic tests only. It authorizes no
  push, merge, deployment, production mutation, server access, credential use,
  or online browser journey.

## Reproduced problems

The ordinary `FeedItemCard` exposes one context menu whose entrance and actions
currently overstate what the product actually does:

1. `useCardPointerInteraction` marks a 360 ms hold as a long press but does not
   open the custom menu. It depends on the browser later synthesizing a
   `contextmenu` event. On touch environments that do not synthesize that event,
   the hold suppresses the following click while opening nothing.
2. Control ownership is split. The shared handler rejects controls only when
   the target is an `HTMLElement`, while nested SVG nodes can be `SVGElement`.
   `FeedItemCard` then opens its menu unconditionally even when the shared
   handler rejected the target. A context action on the Like button can
   therefore be misattributed to the whole card.
3. Bookmarking toggles a local `ref(false)` and haptic feedback without calling
   the existing `togglePostSave` API. The Feed adapter also drops the backend's
   existing `bookmarked`/legacy `saved` field, so the initial label can be false
   and any local toggle disappears on replacement or reload.
4. Report is an empty handler. The menu closes, which can imply an action was
   completed even though no report form, request, navigation, or feedback
   occurred.
5. Share calls `navigator.share` directly, does nothing when Web Share is
   missing, constructs a URL that loses deployment pathname, and swallows both
   cancellation and real failure. The existing `platform/share.ts` already
   owns canonical URL, WeChat, Web Share, clipboard, cancellation, and failure
   outcomes.

These are normal UI paths: hold an ordinary card, right-click a card or nested
control, then choose Share, Bookmark, or Report. Existing gesture E2E mostly
uses desktop right-click and checks that the menu closes; it does not prove a
touch timer opens the menu or that any action reaches a truthful outcome.

## Product decision

F3e repairs the context menu for ordinary `FeedItemCard` instances only.

### Pointer and menu ownership

`useCardPointerInteraction` keeps its existing one-argument compatibility for
Club cards and accepts an optional context-menu contract for ordinary cards:

```ts
interface CardContextMenuRequest {
  x: number;
  y: number;
  // The card currentTarget used for bounds, never the nested event leaf.
  target: HTMLElement | null;
  ownerToken: unknown;
}

useCardPointerInteraction(emitOpen, {
  ownerToken?: () => unknown;
  openContextMenu?: (request: CardContextMenuRequest) => void;
})
```

- A non-control primary pointer down captures coordinates, the card element,
  pointer identity, and an opaque owner token synchronously.
- A non-primary pointer is rejected. A synchronous owner-token watcher clears
  an active timer and candidate immediately when the item changes; it also
  retains a one-click suppression latch so the old pointer sequence cannot
  open the replacement item.
- At 360 ms, an eligible unmoved/current pointer opens the custom menu exactly
  once and marks the eventual click suppressed. It does not wait for a browser
  `contextmenu` event.
- Pointer up at exactly 360 ms preserves or performs the accepted long-press
  transition; it cannot overwrite an already-opened latch through a strict
  `>` duration check.
- If the browser sends `contextmenu` after the timer already opened the same
  candidate, the handler prevents the native menu but does not open a duplicate.
- An accepted desktop `contextmenu` without a long-press candidate opens once at
  its event coordinates.
- Control detection uses `Element.closest(...)`, covering nested HTML and SVG
  descendants of `button`, `a`, `input`, `textarea`, `select`, and
  `[data-card-control]`. Rejected controls are neither prevented nor opened.
- Move beyond 8 px, pointer cancel, short pointer up, owner invalidation, or
  unmount clears the timer/candidate. Old timer callbacks cannot open a later
  item.
- A movement-cancelled sequence suppresses its following click. A standalone
  desktop right-click does not contaminate the next ordinary primary click.
- Both real browser orders `timer -> contextmenu -> pointerup -> click` and
  `timer -> pointerup -> contextmenu -> click` open once and suppress the
  trailing click.
- In the legacy one-argument form used by `FeedItemClubCard`, short click and
  keyboard open remain unchanged. A long hold only suppresses the click because
  no menu callback was supplied, and a standalone accepted `contextmenu` keeps
  the existing native-menu prevention without inventing a Club menu.

The menu action owner is a frozen snapshot shell captured when the menu opens:
owner token, `tid`, display title, item value used by the transition payload,
and card bounds. The item value is detached, deeply cloned, and deeply frozen;
the bounds are copied and frozen. The opaque `ownerToken` is the original
identity reference: it is never cloned, traversed, or frozen. Bookmark state is
deliberately **not** part of this snapshot: each bookmark admission derives its
desired value from the current server-settled bookmark ref for that same owner.
The captured pointer owner token must still equal the current item token before
opening. Replacing the item object closes the menu, invalidates pending actions,
releases local busy state, and makes all old action continuations silent.

### Context-action composable contract

`FeedItemCard` passes `toRef(props, "item")`, its computed display-title getter,
and the existing `emitOpen` transition callback into one owner of menu/action
state:

```ts
type FeedCardBounds = Readonly<{
  top: number;
  left: number;
  width: number;
  height: number;
}>;

interface FeedCardMenuSnapshot {
  readonly ownerToken: unknown;
  readonly tid: FeedItemId;
  readonly title: string;
  readonly item: Readonly<FeedItem>;
  readonly rect: FeedCardBounds | null;
}

interface FeedCardContextActionDependencies {
  savePost?: typeof togglePostSave;
  share?: typeof sharePost;
  toast?: Pick<ReturnType<typeof useToast>, "success" | "info" | "error">;
  haptic?: typeof hapticMedium;
}

useFeedCardContextActions({
  item: Readonly<Ref<FeedItem>>;
  title: () => string;
  emitOpen: (
    id: FeedItemId,
    payload?: { item: FeedItem; rect: FeedCardBounds },
  ) => void;
  dependencies?: FeedCardContextActionDependencies;
}) -> {
  visible;
  x;
  y;
  bookmarked;
  bookmarkBusy;
  shareBusy;
  requestPending;
  openMenu(request: CardContextMenuRequest): boolean;
  closeMenu(): void;
  handleBookmark(): Promise<void>;
  handleShare(): Promise<void>;
  handleReport(): void;
  dispose(): void;
}
```

- `openMenu` accepts only when `request.ownerToken === item.value`, creates the
  detached item/bounds snapshot and coordinates while preserving the token's
  original identity, and may reopen the same owner while an action is pending.
  `closeMenu` clears the visible menu snapshot but does not invalidate an
  already captured action run.
- A synchronous item-identity watcher owns replacement. It advances the shared
  owner generation, closes the menu, invalidates both action tickets, clears
  both busy refs, and resets `bookmarked` from the new authoritative item.
  Scope disposal performs the same invalidation and stops the watcher.
- Save and share have independent monotonic tickets and busy refs under the
  shared owner generation. Starting or settling share cannot stale, commit, or
  clear save, and vice versa. Only the owning generation plus matching
  per-action ticket may commit or clear that action's busy state.
- Action handlers capture the current frozen menu snapshot before closing the
  menu. Reopening the same owner does not invalidate an in-flight run. After a
  pending save settles, the live `bookmarked` ref updates even if the menu was
  reopened; the next bookmark action therefore sends the opposite value.
- Omitted dependencies resolve to the existing production `togglePostSave`,
  `sharePost`, `useToast`, and `hapticMedium` implementations. Injection exists
  only for hermetic behavior tests and does not create a second production path.

### Bookmark

- `FeedItem.bookmarked` is an optional compatibility field. The production Feed
  adapter always emits a boolean, preferring `bookmarked` and falling back to
  legacy `saved`; missing values normalize to `false`.
- The menu initially renders the adapter/current settled value. Its label is
  `收藏` when false and `取消收藏` when true, with matching `aria-pressed`.
- One action sends `togglePostSave(snapshot.tid, !currentSettledValue)`. The
  desired value is computed at action admission, never read from the frozen
  menu snapshot. No second request is admitted while that owner has an active
  save.
- The local value, haptic, and success feedback commit only from the server's
  authoritative `response.saved`. The task does not pretend an optimistic
  state is persisted before confirmation.
- A current failure leaves the previous value unchanged and shows an error
  toast. A stale success, failure, or `finally` after item replacement/unmount
  cannot update state, haptic, feedback, or the new owner's busy flag.
- Brand copy is fixed: `FEED_BOOKMARK_SAVED` is `已加入收藏。`,
  `FEED_BOOKMARK_REMOVED` is `已取消收藏。`, and failure uses the existing
  `ERROR_SAVE_ACTION`. The false/true action labels are
  `GESTURE_CONTEXT_BOOKMARK` / `GESTURE_CONTEXT_UNBOOKMARK`.

### Share

- Share calls the existing `sharePost({ tid, title })` exactly once for the menu
  snapshot. It does not reconstruct URLs or call browser APIs directly.
- `shared` and `cancelled` are silent; `copied` shows the existing link-copied
  success copy; `use-wechat-menu` shows its returned message as info; `failed`
  shows its returned message as error.
- Share is single-flight for the owner. Late results after replacement/unmount
  are silent and cannot clear a newer owner's busy state.

### Report

`GESTURE_CONTEXT_REPORT` is changed to the explicit label `前往详情举报`.
Choosing it opens the captured
post in the existing Detail flow exactly once. It does not call `reportPost`,
does not invent a report category/reason, and does not show report-success
feedback. The user completes the existing report form in Detail.

The menu closes after an admitted action. Async completion is communicated by
toast and by the next authoritative menu state, not by keeping the sheet open.
If the menu is reopened before completion, the matching Bookmark or Share
action is disabled by its own busy ref; the other action remains independently
admissible. `requestPending` is their aggregate presentation state.

## Required invariants

- A 360 ms non-control hold opens one custom menu without a synthetic
  `contextmenu`; the following click does not open Detail.
- A short click still opens the card exactly once.
- Movement, cancel, early up, item replacement, and unmount cancel long-press
  ownership and timers.
- Pointer-owner replacement clears the active timer synchronously rather than
  relying only on a stale callback comparison.
- Nested SVG/control context events neither prevent the native event nor open
  the card menu.
- A synthetic context event following the accepted long press is deduplicated.
- Menu actions always operate on the captured owner, never whatever item props
  happen to contain when an async result settles.
- Bookmark and share are independently single-flight, server/outcome
  authoritative, and guarded by a shared owner generation plus separate
  action tickets across replacement and disposal.
- Report navigation is truthful and does not masquerade as a submitted report.
- Existing short-click, keyboard-open, delayed menu close, reduced-motion,
  backdrop/Escape, Feed request ownership, F3a identity merge, F3b history,
  F3c intents, and F3d sentinel behavior remain unchanged.

## Allowed files

Runtime:

- `src/features/feed/useCardPointerInteraction.ts`
- `src/features/feed/useFeedCardContextActions.ts` (new)
- `src/features/feed/FeedItemCard.vue`
- `src/features/feed/FeedContextMenu.vue`
- `src/api/feed.ts`
- `src/types/feed.ts`
- `src/config/brand/feed.ts`

Tests and inventory:

- `tests/feed/feedCardContextActions.test.ts` (new)
- `tests/api/feed.adapter.test.ts`
- `tests/feed/FeedContextMenu.structure.test.mjs`
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-card-context-action-truthfulness.md`
- `docs/agent/handoffs/feed-card-context-action-truthfulness.md`

## Forbidden files and non-goals

- No file outside the exact Allowed files list.
- No change to `src/api/posts.ts`, `src/platform/share.ts`, toast internals,
  `FeedView.vue`, `FeedList.vue`, `FeedItemCardFooter.vue`, `useFeedData.ts`,
  Detail runtime/FSM, Profile runtime, backend, auth, storage, routes,
  dependencies, service worker, deployment, or production.
- No new API route, DTO request, backend save/report contract, credential,
  remote seed, or online E2E.
- No Club-card context menu parity.
- No inline Feed report sheet or automatic opening of Detail's report form.
- No Feed/Detail like or save reconciliation, Profile saved-list refresh,
  module-global reaction cache, cross-tab state, or account-generation work.
- No change to footer Like feedback/error ownership.
- No visual redesign beyond truthful labels and busy/ARIA state.

## Test-first matrix

The new Vitest file must import and execute the production pointer and action
composables. It may capture Vue lifecycle cleanup and use fake timers and
injected save/share/toast dependencies, but must not copy their state machines.

1. A primary touch/pen non-control pointer down emits no menu at 359 ms and
   exactly one menu at 360 ms using captured coordinates, card target, and owner
   token; the later click is suppressed without opening Detail. A non-primary
   pointer never arms a timer or opens either surface.
2. A short tap opens the card once. Move beyond tolerance and pointer cancel
   clear the timer and suppress any trailing click; early pointer up permits the
   short click. Unmount clears the timer, and stale callbacks never open a menu.
3. Both `timer -> contextmenu -> pointerup -> click` and
   `timer -> pointerup -> contextmenu -> click` open one menu, prevent the
   synthetic native menu, and suppress the click. Pointer up at exactly 360 ms
   cannot revert or duplicate the accepted long press.
4. A standalone desktop right-click opens once and does not affect the next
   normal left click. `button`, link, form controls, `[data-card-control]`, and
   nested SVG targets are rejected for pointer/context ownership and are not
   prevented.
5. Pointer down on item A followed by synchronous owner replacement clears the
   pending timer immediately (`1 -> 0`) and cannot open or click B. An open A
   menu closes on replacement; A actions/results cannot mutate B, and B can
   start new actions immediately.
6. The unchanged one-argument Club call remains compatible: short click and
   keyboard open once, a 360 ms hold only suppresses the click without a menu,
   and standalone non-control `contextmenu` keeps its existing prevention with
   no custom-menu callback.
7. Feed normalization covers `bookmarked`, legacy `saved`, false/missing, and
   precedence when both are present.
8. Bookmark begins from current settled state, calls one exact save request,
   stays single-flight, and commits only authoritative response state plus the
   exact add/remove success copy and haptic. Current failure preserves prior
   state and uses `ERROR_SAVE_ACTION`.
9. Reopen the same owner's menu while save is pending; after the authoritative
   `saved: true` response updates the visible settled state and clears busy, the
   next bookmark admission from that same reopened menu must request
   `saved: false`. A frozen snapshot can never dictate this toggle direction.
10. A pending save/share invalidated by B or disposal cannot write B state,
    feedback, haptic, or busy. Save and share may run concurrently for the same
    owner and settle in either order without staling or clearing one another.
11. The captured owner token remains the exact original identity and the source
    item is not frozen. After opening, successfully mutate the original live
    item's `tid`/title/nested fields and change the target's returned bounds
    without replacing its identity. Save, Share, and Report still use only the
    detached captured `tid`, display title, item value, and bounds; the captured
    item stays unchanged, and later async completion uses tickets rather than
    live props.
12. Share forwards only captured `tid/title`. `shared`/`cancelled` are silent;
    copied/WeChat/failed map to the required toast tone/copy. A stale outcome is
    silent and cannot clear a current share or save.
13. Report invokes the captured production `emitOpen` transition once with the
    detached item/bounds and cannot call report submission or claim report
    success. Structure coverage must prove `FeedItemCard` passes its real
    `emitOpen` into the action owner rather than only testing an injected fake.
14. Structure tests lock `toRef(props, "item")`, owner-token and `openMenu`
    pointer wiring, truthful report/add/remove bookmark labels, per-action
    disabled state, aggregate `aria-busy`, and `aria-pressed`, while preserving
    delayed close, reduced motion, and wrapper ownership.
15. Existing Feed pointer/keyboard, overlay/backdrop/Escape, adapter, F3a-F3d,
    and local gesture guards remain green; no online journey is required.

The old implementation must fail on direct long-press opening, control
ownership, adapter bookmark state, real save/share/report behavior, and stale
owner guards while unrelated existing tests remain green.

## Validation commands

Focused red/green validation:

```bash
npx vitest run \
  tests/feed/feedCardContextActions.test.ts \
  tests/api/feed.adapter.test.ts
node --test \
  tests/feed/FeedContextMenu.structure.test.mjs \
  tests/feed/feed-item-card-shell.structure.test.mjs
npm run check:test-inventory
npm run build
npm run verify
```

Also run Prettier, ESLint, TypeScript, `git diff --check`, and the existing
gesture/overlay/ARIA tests that do not require online access. The new Vitest
file raises inventory from 166 to 167; Node inventory remains 65.

## Acceptance evidence

- The final behavior suite passed 39/39 and the two focused structure files
  passed 18/18. The broader local Feed regression set passed 120/120.
- Full `npm run verify` passed in 96.3 seconds: 167 Vitest files / 4,185 tests,
  65 Node structure files / 824 tests, typecheck, lint, production build (644
  modules / PWA 71 entries), HTML sanitizer, runtime guards, and 3 loopback
  smoke checks all passed. Lint retained only three pre-existing warnings.
- Adversarial review found one no-trailing-click suppression leak after move,
  cancel, or long press. A fresh primary intent now releases that old latch
  while the pre-intent A-to-B guard remains intact; the added recovery matrix
  and both reviewers accepted the corrected implementation.
- All validation remained local. No server, credential, production, external
  network, online browser, push, merge, or deployment operation was performed.

## Risks and mitigations

- Risk: fixing long press introduces duplicate native/custom menus. Mitigation:
  one pointer-candidate ownership flag and explicit synthetic-context dedupe.
- Risk: A async action writes B state. Mitigation: frozen menu snapshot,
  generation/ticket guard, item-object watch, and disposal tests in both settle
  orders.
- Risk: local bookmark diverges from a later Feed response. Mitigation: every
  item object replacement is authoritative and resets the local projection.
- Risk: report wording still implies submission. Mitigation: explicit
  `前往详情举报` label and Detail navigation only.
- Risk: task grows into cross-surface state architecture. Mitigation: explicitly
  defer reaction reconciliation and Profile collection refresh.

## Data, migration, compatibility, and rollback

- No database, Redis, browser-storage, service-worker, or schema migration.
- Feed response normalization gains one optional frontend field using an
  already returned backend value. Existing response and request envelopes are
  unchanged.
- Save and share reuse existing frontend API/platform contracts. Report sends
  no request in this lane.
- Rollback reverts the bounded task/test/runtime/docs commits and changes the
  inventory from 167 back to 166. No client or server data cleanup is required;
  successfully saved server state remains ordinary user data.

## Acceptance authority

- The implementation thread may report completion but cannot accept the lane.
- At least two independent reviewers must inspect pointer reachability,
  control/owner isolation, async action generations, adapter compatibility,
  test discrimination, and exact allowed-file scope.
- Only the primary review thread may record F3e as locally accepted.
- Those requirements were satisfied after both independent reviewers recorded
  `ACCEPT` on the final implementation and focused evidence.
- No push, merge, deployment, production mutation, server access, or online
  validation is authorized by this task.
