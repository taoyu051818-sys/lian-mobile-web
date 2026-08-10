# Handoff: Feed card context-action truthfulness

## Status

Locally accepted on 2026-08-10. The implementation is commit `e917b8b` on
`codex/audit-f3e-feed-context-actions`. The task contract is `855365b` and the
red-test commit is `899bae6`. None has been pushed, merged, or deployed. No
server, credential, production, online browser, or external network access was
used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F3d acceptance `30f056a`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

The ordinary Feed card advertised a context menu whose entrance and actions
were not reliable. A touch hold only set a flag and depended on a browser-made
`contextmenu` event; nested SVG controls could be attributed to the card;
Bookmark changed only a local false-initialized flag; Report did nothing; and
Share bypassed the repository's fallback/outcome helper. Late action results
also had no explicit card-owner boundary.

These are normal UI paths: hold a card on a touch browser, right-click a Like
icon, save and then refresh, choose Report, or share where Web Share is absent.

## What changed

- A primary touch or pen hold opens the current card's custom menu at 360 ms
  without waiting for a synthetic browser event. Movement, cancellation,
  controls, stale owners, duplicate event orderings, and queued callbacks are
  explicitly isolated.
- Control detection uses `Element.closest`, including nested SVG descendants.
  The original one-argument Club-card pointer contract remains compatible and
  does not invent a Club menu.
- A fresh physical pointer intent releases suppression left by a completed
  move, cancel, or long press, while an unresolved A-to-B sequence remains
  unable to open B.
- Feed normalization exposes server `bookmarked`, with legacy `saved` fallback
  and explicit `bookmarked` precedence.
- A dedicated action owner preserves the raw item identity token, captures a
  detached deep-frozen item/bounds snapshot, watches owner replacement
  synchronously, and uses an owner generation plus independent Save/Share
  tickets.
- Bookmark calls the existing save API once, accepts only the authoritative
  response value, and maps success/error haptics and copy to that result.
- Share calls the existing canonical helper and maps copied, WeChat-menu,
  failed, shared, and cancelled outcomes without rebuilding a URL.
- Report is labelled `前往详情举报` and opens the captured card in the existing
  Detail flow. It does not pretend that a report was submitted.
- Menu state exposes truthful add/remove labels, per-action disabled state,
  bookmark pressed state, and aggregate busy semantics.

## Test evidence

- The accepted red phase produced 32 intended failures and 1 compatibility
  pass in the initial action/pointer behavior suite, 2 intended adapter
  failures with 20 guards passing, and 4 intended structure failures with 14
  guards passing.
- Review expanded the behavior matrix for detached event data, exact 360 ms
  pointer-up, queued context events, owner replacement, terminal admission,
  independent Save/Share settlement, and fresh-intent recovery.
- Final focused behavior suite: 39/39; adapter suite: 22/22; two focused Node
  structure files: 18/18; broader Feed regression set: 120/120.
- Full `npm run verify` passed in 96.3 seconds:
  - 167 Vitest files / 4,185 tests;
  - 65 Node structure files / 824 tests;
  - typecheck, lint, production build (644 modules / PWA 71 entries), HTML
    sanitizer, runtime guards, and 3 loopback smoke checks all passed;
  - lint retained only three pre-existing warnings.
- Two independent reviewers recorded `ACCEPT` with no remaining blocker after
  the no-trailing-click suppression finding was fixed and reverified.

## Files changed

Runtime:

- `src/features/feed/useCardPointerInteraction.ts`
- `src/features/feed/useFeedCardContextActions.ts`
- `src/features/feed/FeedItemCard.vue`
- `src/features/feed/FeedContextMenu.vue`
- `src/api/feed.ts`
- `src/types/feed.ts`
- `src/config/brand/feed.ts`

Tests/gates:

- `tests/feed/feedCardContextActions.test.ts`
- `tests/api/feed.adapter.test.ts`
- `tests/feed/FeedContextMenu.structure.test.mjs`
- `tests/feed/feed-item-card-shell.structure.test.mjs`
- `scripts/check-test-inventory.mjs`

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/feed-card-context-action-truthfulness.md`
- `docs/agent/handoffs/feed-card-context-action-truthfulness.md`

## Data, migration, and compatibility

There is no endpoint, request-envelope, database, Redis, browser-storage,
service-worker, or schema migration. The adapter projects a boolean already
returned by the server. Save and Share reuse existing frontend contracts;
Report sends no request. No client or server cleanup is required.

## Known risks and follow-up

- Confirmed bookmark state is local to the mounted card projection. Feed,
  Detail, Profile collections, reload/cross-tab replay, and canonical reaction
  reconciliation remain a separate batch.
- Report only navigates to Detail. It does not automatically open the report
  sheet, choose a reason, or submit a report.
- Club cards still have no context-menu parity.
- Offset pagination and Feed page restoration remain separate work.
- Physical browser events and network requests cannot be canceled once queued,
  but stale owner generations have no state, feedback, or busy authority.
- No online or physical-device browser journey was run. The hermetic pointer
  matrix covers event ordering, but device-specific touch behavior still merits
  a later authorized local-device regression.

## Rollback

Revert implementation commit `e917b8b`, red-test commit `899bae6`, task commit
`855365b`, plus the following acceptance commit. Restore Vitest inventory from
167 to 166. No browser, server, database, Redis, service-worker, or deployed
state cleanup is required. Successfully saved posts are ordinary user data and
must not be undone as part of a code rollback.

## Not done

- No Feed/Detail/Profile canonical reaction store, Club menu, inline Feed report
  sheet, report submission, page restoration, cursor, backend, auth, storage,
  dependency, service-worker, deployment, or production change.
- No push, pull request, merge, deployment, production access, server access,
  credential use, network probing, or online browser journey.
