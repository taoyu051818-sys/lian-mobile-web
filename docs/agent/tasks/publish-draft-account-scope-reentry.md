# Task: publish-draft-account-scope-reentry

## Current source check

- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F2d acceptance `3afb386` with implementation `1418bf6`.
- Working branch: `codex/audit-f2e-publish-draft-scope-reentry`.
- Control issue: [#1090](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1090).
- Existing account-scope history revalidated: issue #692 and merged PR #694
  (`af35b2d`).
- Open issues were searched for Publish draft scope, account re-entry,
  `restoredScopes`, and A → B → A duplicates before #1090 was opened. None
  owns this contract.
- Root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`,
  `docs/agent/README.md`, `docs/agent/00_AGENT_RULES.md`, F2d task/handoff,
  and `docs/agent/references/DEVELOPMENT_PRINCIPLES.md` were checked.
- The override files named by the historical task template do not exist in
  this checkout; current code, merged PR #694, `docs/CURRENT_STATUS.md`, and
  the current agent rules are authoritative.

## Reachability finding

The normal in-app account-switch path currently unmounts Publish before the
user can log out or sign in as another account. Publish is kept alive only for
the narrow Map picker round trip, and Map has no account-switch surface.
Therefore A → B → A is not a currently reachable normal-UI production
incident.

It is still a real synchronous composable-contract defect.
`usePublishDraftSession` documents that every `userId` change recomputes the
account scope, but `restoredScopes` makes the second A entry skip storage
restore. The form keeps B's values while `persistedScope` points at A; the
next edit can write B's draft into A's slot.

This batch is a prerequisite for, not a complete implementation of, mounted
auth refresh. Upload, publish, capability, audience, and verification requests
need a separate account-generation contract before a production path may
change identity inside a mounted Publish instance.

The same transition currently exposes only a boolean `restoreSettled` edge.
Vue may batch a scope transition so a pending location handoff does not observe
a distinct false → true notification.

## Goal

Make an explicit, idle Publish account-scope change a bounded, ordered
synchronous transaction: persist the outgoing scope, discard unowned transient
handoffs, reset page-owned synchronous state, restore the target scope on every
entry, publish a monotonic restore generation, and only then allow autosave to
target the new scope.

## Product scope

This is defensive state-integrity work with no intended visual or API change.
It repairs the existing scoped-draft composable contract. It does not authorize
or complete a future mounted auth-refresh path; that path must first add
account-generation guards to every asynchronous Publish capability.

## State transition contract

For `A -> B`:

```text
persist A synchronously
  -> mark the form temporarily unowned
  -> discard any unscoped pending location handoff
  -> reset Publish-owned synchronous transient state
  -> read and restore B every time
  -> set persistedScope = B
  -> increment restoreGeneration
  -> later edits autosave only to B
```

Required invariants:

- Do not cache “already restored” scopes. Every re-entry reads storage again.
- Persist the outgoing scope before reset or target restore mutates refs.
- During a transition, no intermediate state may be written to the outgoing
  scope.
- Scope adoption runs synchronously when the identity ref changes. An edit
  made after that assignment in the same tick belongs only to the target.
- A target with no snapshot must remain empty; it may not retain the previous
  account's fields.
- Anonymous is a first-class scope and follows the same transition rules.
- Before the initial identity resolution establishes a persisted scope,
  `identityLoaded=false` must not read anonymous state or autosave any scope.
- The page reset callback is synchronous. It clears File objects, uploaded URLs
  and previews, AI candidates/attempt state, Event/Merchant/Trade draft input,
  result/preview copy, reset UI, and a pending geolocation attempt before the
  target restore.
- A pending Map/geolocation handoff has no account owner. Initial adoption may
  consume it through the existing mount/activation path; a real owned-scope
  transition must discard it instead of assigning A's handoff to B.
- A monotonic `restoreGeneration` signals every completed target restore.
  Publish may keep `restoreSettled` as a synchronous gate. The generation is a
  latest-state notification, not an event queue for every intermediate
  identity value in one Vue flush.
- Profile logout keeps its existing `clearAllPublishDrafts` behavior. Ordinary
  scope transitions do not erase every account's saved slot.
- This contract assumes no upload, publish, audience, merchant/trade
  verification, or other account-bound request is in flight. A later lane must
  add account generations and transition reasons before mounted auth refresh
  is enabled.

## Repository and ownership scope

- Repository: `lian-mobile-web`.
- Owned area: Vue/Vite Publish state and frontend tests/docs.
- Backend/API/runtime changes required: none.

## Allowed files

Runtime:

- `src/features/publish/usePublishDraftSession.ts`
- `src/features/publish/PublishView.vue`

Tests and quality gate:

- `tests/publish/usePublishDraftSession.test.ts` (new)
- `tests/publish/publishLocationHandoff.structure.test.ts`
- `scripts/check-test-inventory.mjs` (Vitest inventory 157 → 158 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-draft-account-scope-reentry.md`
- `docs/agent/handoffs/publish-draft-account-scope-reentry.md`

## Forbidden files and non-goals

- No backend, API, cookie, auth route, server, deployment, or production
  changes.
- No storage-key or snapshot-schema change in `publishDraftSession.ts`.
- No `AppViewHost` or F2c KeepAlive/lease change.
- No Map coordinate, handoff envelope, or F2d validator change.
- No Profile logout-policy change.
- No global/cross-tab auth epoch, focus refresh, or submit-time identity probe;
  that is a separate account-consistency lane and this batch must not be cited
  as completing it.
- No redesign of upload or publish HTTP cancellation. Results already in
  flight during a hypothetical scope transition remain a separate generation
  contract and must not be silently widened into this batch.
- No file outside the allowed list.

## Data or state changes

No migration. Existing account-scoped sessionStorage keys, legacy readable
snapshots, and the optional F2d `mapPickerBinding` remain compatible.

Only transition ordering changes: a target scope is re-read on every explicit
identity change, and page-owned transient state is discarded instead of being
carried across accounts.

## API or contract changes

No HTTP or backend contract changes.

The internal composable return gains a monotonic `restoreGeneration`. The
existing `restoreSettled` remains available as the immediate readiness gate.
No handoff or HTTP contract gains an account owner in this batch.

## Acceptance criteria

- [x] A focused test on `3afb386` proves A → B → A leaves B in A's form and
      can contaminate A's storage.
- [x] After the fix, every scope entry restores the latest target snapshot.
- [x] The outgoing scope's latest edit is persisted before switching.
- [x] Identity change followed by an edit in the same tick writes only the
      target scope.
- [x] A scope with no snapshot is empty on every entry.
- [x] Guest → A → guest → A keeps anonymous and authenticated drafts isolated.
- [x] `identityLoaded=false` prevents premature anonymous restore/write.
- [x] Scope reset clears File objects and invokes the page transient-reset
      callback before target restore.
- [x] `restoreGeneration` advances once per completed adoption; initial mount
      can consume its existing pending handoff, while an owned A -> B
      transition discards an unscoped handoff before B is restored.
- [x] F2d binding/catalog behavior and Profile logout clearing do not regress.
- [x] Focused tests, build, and full `npm run verify` pass with 158 Vitest
      files; an independent reviewer records acceptance.
- [x] Only allowed files change; no push, deployment, or online environment
      access occurs.

## Acceptance result

- Red baseline: 4 focused files / 48 tests produced 8 intentional failures
  against the old implementation. A separately added identity-first same-tick
  test also failed before synchronous scope adoption was enabled.
- Final focused suite: 4 files / 50 tests passed.
- Build and typecheck passed; Vite transformed 642 modules.
- Full `npm run verify` passed:
  - 158 Vitest files / 4,031 tests;
  - 65 Node structure files / 817 tests;
  - HTML sanitizer;
  - loopback smoke 3/3.
- Two independent reviewers recorded `ACCEPT` after the contract was narrowed
  and the same-tick, operation-payload, and initial-adoption gaps were fixed.
- No push, PR, merge, deployment, production access, or server mutation was
  performed.

## Validation commands

```bash
npx vitest run \
  tests/publish/usePublishDraftSession.test.ts \
  tests/publish/publishDraft.test.ts \
  tests/publish/usePublishLocationOptions.test.ts \
  tests/publish/publishLocationHandoff.structure.test.ts
npm run build
npm run verify
```

## Risks

- Reset-before-persist could erase the outgoing draft. Mitigation: the
  transition synchronously snapshots the outgoing scope before invoking the
  page reset callback, and tests assert the stored A/B payloads separately.
- Restore mutations could trigger autosave against the wrong scope.
  Mitigation: temporarily remove form ownership during the synchronous
  transition, set the target only after restore, and test same-tick edits plus
  identity changes.
- An unscoped location handoff could be misassigned to the target account.
  Mitigation: discard it during an owned-scope reset; keep the existing
  mount/activation consume path only for initial adoption.
- The current UI does not normally change identity in a mounted Publish
  instance. Tests must describe this as defensive contract hardening, not
  evidence of a currently reachable account-switch incident.
- Late upload/publish/capability results could repopulate cleared refs. This
  batch explicitly does not enable mounted auth switching; a follow-up must
  add account-generation invalidation before such a path is introduced.

## Rollback plan

Revert the bounded F2e runtime, tests, inventory-gate, and documentation
commits. No server, database, Redis, API, or deployed-state cleanup is
required. If local manual testing creates an unwanted draft, clear only the
affected browser sessionStorage scope.
