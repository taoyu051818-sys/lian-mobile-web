# Task: publish-map-picker-draft-continuity

## Current source check

- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisites: F2a acceptance `ee8ff1a` and F2b acceptance
  `88f9d43`.
- Working branch: `codex/audit-f2c-publish-map-picker-continuity`.
- Control issue: [#1088](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1088).
- Open issues and recent pull requests were searched before opening #1088. No
  active task already owns this lifecycle boundary.

## Problem

`AppViewHost` caches the map but not Publish. Entering the map picker therefore
unmounts `PublishView`. The persisted Publish snapshot intentionally contains
only serializable basic fields; it does not and should not own `File` objects,
object URLs, uploaded URLs, AI candidates, publish kind, or the Event, Merchant,
and Trade subdrafts. Cancelling or confirming the picker can consequently
discard valid in-memory work.

## Goal

Keep exactly one Publish component instance alive only for the
`Publish -> map picker -> Publish` round trip. Normal navigation, direct picker
entry, and account/session restoration must retain their existing lifecycle.

## Product scope

This task corrects Vue component ownership. It does not change the persisted
draft schema, location handoff payload, coordinate semantics, API requests,
upload behavior, user-facing copy, dependencies, or backend behavior.

## Allowed files

- `src/app/AppViewHost.vue`
- `src/features/publish/PublishView.vue`
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `tests/e2e/publish-location-picker.spec.ts`
- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-map-picker-draft-continuity.md`
- `docs/agent/handoffs/publish-map-picker-draft-continuity.md`

## Forbidden files

- `src/features/publish/usePublishDraft.ts`
- `src/features/publish/usePublishDraftSession.ts`
- `src/features/publish/publishDraftSession.ts`
- All F2b AI files and tests.
- Location handoff, map picker, API, backend, dependency, deployment, and
  persisted-data files.
- Any file outside the allowed list.

## Design

- `PublishView` has an explicit stable component name and emits
  `map-picker-open` immediately before changing the hash.
- `AppViewHost` owns a narrow in-memory lease and two independent cache
  containers. The existing Map cache is always mounted and can contain only
  the active map view. A separate Publish cache exists only while Publish is
  active or the picker lease is active, and its slot contains Publish only
  while that view is active.
- Do not dynamically mutate one `KeepAlive include` list. Vue's cache-pruning
  path can inspect the unresolved async-wrapper name and evict the existing Map
  entry when the include list changes.
- Direct map/picker entry does not create a Publish lease. Leaving the picker
  for any non-Publish page clears the lease and evicts the cached Publish
  instance.
- Same-view in-app navigation from `#/map?picker=1` to plain `#/map` uses the
  shared before-navigate hook because `history.pushState` emits neither
  `hashchange` nor `popstate`. The hook is registered and removed with the
  host lifecycle.
- Returning to Publish clears the lease without evicting the active Publish
  instance. A later normal navigation then follows the existing unmount path.
- `PublishView` consumes the one-shot handoff from `onActivated`, because a
  cached component does not remount on return.
- While deactivated, Publish must not emit shell chrome. Activation restores
  its current chrome before consuming the handoff.
- Existing mount/pageshow consumption stays idempotent because the handoff is
  destructive and applied at most once.

## Acceptance criteria

- [x] Title, body, upload preview/state, publish kind, and Event/Merchant/Trade
      subdraft refs survive picker cancel and confirm round trips.
- [x] The location handoff is consumed once when the cached Publish view is
      activated.
- [x] Delayed Publish identity/chrome changes cannot overwrite the map shell
      while Publish is deactivated.
- [x] Navigating from the picker to Feed/Profile releases the lease; a later
      Publish visit uses the existing account-scoped restore path.
- [x] Direct `#/map?picker=1` entry does not create a hidden Publish instance.
- [x] Existing map KeepAlive behavior remains unchanged.
- [x] Persisted draft/session and location handoff contracts remain unchanged.
- [x] Focused tests, build, and full `npm run verify` pass.
- [x] Only allowed files are changed.

## Validation commands

```bash
npx vitest run tests/publish/publishLocationHandoff.structure.test.ts
npx playwright test tests/e2e/publish-location-picker.spec.ts
npm run build
npm run verify
```

The registered-role Playwright cases may report a documented skip when the
role fixture is unavailable. Structural and full local validation must still
pass; a configured environment is required before deployment acceptance.

## Rollback

Revert this task's implementation and acceptance-document commits. There is no
API, storage, database, upload, or persisted-draft migration to reverse.
