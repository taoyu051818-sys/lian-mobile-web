# Handoff: audit-f1-profile-session-state

## Status

Locally accepted on 2026-08-10. The implementation is commit `35768e7` on
`codex/audit-f1-profile-session-state`. It has not been pushed, merged, or
deployed. Control issue: [#1085](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1085).

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: B0 accepted commit `0ea4cc1`
- Runtime used for validation: Node 22.23.2

## What changed

- Profile now has one account-boundary reset for ServerChan binding,
  preferences, and opt-in dialog state.
- Entering confirmed guest state or accepting a newly authenticated user clears
  values, form input, errors, busy flags, and per-session dismissals from the
  preceding account.
- Each shared composable advances an in-memory generation. Async work started
  before an account transition may finish its network round trip, but it can no
  longer write data, errors, dialogs, or busy flags into the current session.
- Test inventory and current-status guards now accept exactly one active or
  inactive execution-queue marker.

No API, DTO, route, dependency, style, browser-storage key, backend file, or
persisted data format changed. `lian.clientId` and `lian.readHistory` retain
their existing browser-local lifecycle.

## Validation

- Focused Profile lifecycle tests: 4 files / 38 tests passed.
- `npm run test:unit`: 155 files / 3,955 tests passed.
- `npm run test:structure`: 65 files / 817 tests passed.
- `npm run check`: passed.
- `npm run build`: passed (642 modules; 71 PWA precache entries).
- `npm run verify:smoke`: 3 checks passed; port 4301 was free afterward.
- `npm run verify`: exit 0.
- `git diff --check`: passed.
- Independent read-only review: accepted with no P0-P3 findings.

The existing non-blocking warning inventory remains unchanged: three lint
warnings, fifteen allowlisted view/API imports, nine unlisted assets,
thirty-three stale-document markers, and twenty-nine Vue files over 300 lines.

## Deferred follow-ups

- Profile still needs a separate review-first lane for an explicit
  session-unavailable state and for invalidating an in-flight profile list at
  logout. Those behaviors were not mixed into issue #1085.
- Browser-local history explanation and any data-clearing control remain a
  separate product-copy and storage-contract decision.

## Rollback

Revert implementation commit `35768e7` and its acceptance-document commit. No
server, database, API, or browser-storage migration needs reversal.
