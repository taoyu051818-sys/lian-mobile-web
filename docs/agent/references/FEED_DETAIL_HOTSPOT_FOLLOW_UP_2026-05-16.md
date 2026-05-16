# Feed / Detail Remaining Hotspot Follow-Up - 2026-05-16

This note closes the planning questions from `#524` by checking current `main` after merged PRs `#513`, `#514`, and `#515`.

## Source of truth used

1. Current code on `main`
2. Merged PR `#513` - `FeedItemCard` footer + pointer interaction split
3. Merged PR `#514` - `FeedView` composable split
4. Open follow-up issues `#519` and `#520`

## Hotspot scan

### `src/features/feed/FeedView.vue`

Current shape on `main`:

- already slimmed by `#514`
- now acts mainly as a page-level composition shell
- current responsibilities are limited to:
  - page chrome wiring
  - viewport tracking
  - detail/card transition overlay timing
  - wiring `useFeedData`, `useFeedDetail`, and `useDetailDragGesture`
- no feed API loading logic remains inline
- no detail drag state machine remains inline

Conclusion:

- `FeedView.vue` no longer needs a fresh decomposition issue right now
- the risky stateful logic already moved into feature-local composables
- any further split here would be cosmetic rather than a meaningful boundary reduction

### `src/features/detail/PostDetailPanel.vue`

Current shape on `main`:

- still owns the densest detail-side state and side effects
- still imports and directly coordinates:
  - place sheet loading via `fetchPlaceSheet`
  - reaction/save optimistic updates via `togglePostLike` and `togglePostSave`
  - report submission via `reportPost`
  - reply submission via `sendPostReply`
  - web share / WeChat share setup via `sharePost`, `configureWeChatShare`, and `buildCanonicalPostUrl`
- still keeps local state for reaction/save busy flags, report flow, reply composer, gallery/lightbox, and place sheet open/load/error/cache state

Conclusion:

- `PostDetailPanel.vue` should be the main remaining detail hotspot
- it should be handled by the already-created detail action-flow issues, not by reopening `#505`
- recommended ownership split is:
  - `#519` for reactions + place sheet
  - `#520` for report / reply / share / gallery

### `src/features/detail/PostDetailContent.vue`

Current shape on `main`:

- still visually large, but it is mostly presentational
- it does not call API clients directly
- it does not own detail workflow side effects
- it mainly receives props and emits UI events for:
  - gallery interactions
  - place sheet open/close intent
  - report form inputs
  - report submit / hide actions
- this file is also under a current non-goal guard from `#519`: do not change `PostDetailContent` DOM structure in that lane

Conclusion:

- `PostDetailContent.vue` is not the next high-value split target today
- it can stay as the presentation surface while `PostDetailPanel.vue` sheds state into composables first
- revisit only after `#519` and `#520` land if the template still feels too dense for maintenance

## Closure decision for `#505`

`#505` is already sufficient to stay closed as completed.

Why:

- the issue acceptance only required at least one hotspot file to complete a responsibility split without behavior change
- `#513` already completed the `FeedItemCard.vue` split
- `#514` pushed the feed/detail lane further by moving `FeedView.vue` state into composables
- the remaining work is now better represented by smaller child issues under `#516`, not by keeping `#505` open as a catch-all hotspot bucket

## Recommended next issue map

1. Keep `#505` closed.
2. Treat `#519` as the first live detail follow-up for `PostDetailPanel.vue`.
3. Treat `#520` as the second live detail follow-up after `#519`.
4. Do not open a new `FeedView.vue` issue unless new state is added back into the page shell.
5. Do not open a new `PostDetailContent.vue` issue until the panel-state splits are done and a real UI-only hotspot still remains.

## Notes for future reviewers

- If `#519` and `#520` land cleanly, `PostDetailPanel.vue` should become a layout-and-wiring shell similar to what `FeedView.vue` already became after `#514`.
- If a later scan still finds `PostDetailContent.vue` too broad, that follow-up should be framed as a presentational block split only, not as an action-flow or API-state refactor.
