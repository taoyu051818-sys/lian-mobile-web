# Task: audit-f1-profile-session-state

## Current source check

- Current code on `main`: `d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: B0 quality gate `0ea4cc1`.
- Working branch: `codex/audit-f1-profile-session-state`.
- Control issue: [#1085](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1085).
- Recent merged PRs through #1084 were checked; #1075 is the most relevant
  notification-state contract change.
- Root `README.md`, `package.json`, `docs/CURRENT_STATUS.md`, repository agent
  rules, system overview, development principles, and the Profile privacy
  explanation brief were checked.
- The override files named by the historical task template are absent. Current
  code, active repository rules, and issue #1085 are authoritative.

## Goal

Bind the shared ServerChan UI state to the current login lifecycle so a guest
transition or account change cannot retain values or late async completions
from the preceding session.

## Product scope

This task affects Profile notification settings and the shared event/errand
notification opt-in state. Normal signed-in behavior and layout remain the
same; after a session transition these surfaces return to unloaded state until
the current session loads them.

## Repository and ownership scope

- Repository: `lian-mobile-web`.
- Owned area: Profile account lifecycle and shared ServerChan composables.
- Backend/API/runtime changes required: none.

## Allowed files

- `src/features/profile/ProfileView.vue`
- `src/features/profile/useServerChanBinding.ts`
- `src/features/profile/useServerChanPreferences.ts`
- `src/features/profile/useServerChanOptIn.ts`
- `tests/profile/useServerChanBinding.test.ts`
- `tests/profile/useServerChanPreferences.test.ts`
- `tests/profile/useServerChanOptIn.test.ts`
- `tests/profile/profile-view-structure.test.ts`
- `tests/structure/core-product-model-queue-snapshot.test.mjs`
- `scripts/check-test-inventory.mjs`
- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/audit-f1-profile-session-state.md`
- `docs/agent/handoffs/audit-f1-profile-session-state.md`

## Forbidden files

- Backend/API contract files.
- Browser storage and client identity files.
- ServerChan page layout, copy, or styles.
- Dependencies, build configuration, and deployment files.
- Any file outside the allowed list.

## Data or state changes

No persisted data changes. `lian.clientId` and `lian.readHistory` keep their
documented browser-local lifecycle and are not cleared by logout.

Module-level ServerChan binding, preference, dialog, dismissal, error, and busy
state is cleared when Profile enters guest state. Each module advances a small
in-memory generation so work started before the transition cannot write into
the next session.

## API or contract changes

None. Existing API payloads and endpoints remain unchanged.

## Acceptance criteria

- [ ] Binding reset clears loaded, form, error, and busy state.
- [ ] Preferences reset clears loaded values, errors, and busy state.
- [ ] Opt-in reset closes the dialog and clears in-session dismissals.
- [ ] A result from an earlier generation cannot overwrite current state or
      current busy flags.
- [ ] `ProfileView.enterGuestState()` invokes all three reset boundaries.
- [ ] The canonical status contract accepts exactly one of active or inactive
      execution queue markers.
- [ ] Normal load, bind, unbind, toggle, and opt-in flows remain green.
- [ ] Focused tests, `npm run check`, build, and full `npm run verify` pass.
- [ ] Only allowed files are changed.

## Validation commands

```bash
npx vitest run tests/profile/useServerChanBinding.test.ts tests/profile/useServerChanPreferences.test.ts tests/profile/useServerChanOptIn.test.ts tests/profile/profile-view-structure.test.ts
npm run check
npm run build
npm run verify
```

## Risks

- A late promise could still change a busy flag after a new request starts.
  Every async state write, including `finally`, must check its captured
  generation.
- Resetting browser-local history would contradict the approved Profile copy.
  Those keys are explicitly out of scope.
- A broad global auth-store rewrite would enlarge the change unnecessarily.
  This task stays at the three known session-scoped modules and Profile's
  existing guest boundary.

## Rollback plan

Revert this task's implementation commit. No backend or persisted browser data
needs rollback.
