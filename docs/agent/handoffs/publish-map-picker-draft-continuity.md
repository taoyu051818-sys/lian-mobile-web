# Handoff: publish-map-picker-draft-continuity

## Status

Locally accepted on 2026-08-10. The implementation is commits `ccfc236` and
`165233f` on `codex/audit-f2c-publish-map-picker-continuity`. It has not been
pushed, merged, or deployed. Control issue:
[#1088](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1088).

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2b acceptance `88f9d43`
- Runtime used for validation: Node 22.23.2

## What changed

- Map and Publish now use independent static `KeepAlive` containers.
- Publish owns a narrow lease only for `Publish -> map picker -> Publish`.
- Opening the picker establishes the lease before navigation. Returning to
  Publish reuses the same component; leaving for another page destroys it.
- Direct picker entry never creates a hidden Publish instance.
- Same-view picker exit through the already-active Map tab is handled through
  the existing before-navigate hook because `history.pushState` does not emit
  browser navigation events.
- A deactivated Publish view cannot emit shell chrome or consume a pending
  location handoff. Activation restores chrome and then consumes the handoff.

Persisted draft/session formats, location handoff payloads, APIs, uploads, AI,
Event/Merchant/Trade behavior, backend behavior, dependencies, and user-facing
copy did not change.

## Validation

- Initial red run: 7 focused tests; 3 failed on the old implementation for the
  intended double-cache, lease, and lifecycle reasons.
- Review red run: 1 focused test failed before the same-Map-tab navigation fix.
- Final focused test: 7/7 passed.
- Deterministic local Edge journeys with fixed local API data passed:
  - picker cancel preserves title, body, and a live `File` preview;
  - picker -> Feed -> Publish releases the live preview;
  - direct picker creates no hidden Publish;
  - picker -> active Map tab -> Publish releases the live preview.
- The registered-role Playwright file reported two documented skips because
  the optional account fixture was not configured; no online account was used.
- `npm run test:unit`: 156 files / 3,981 tests passed.
- `npm run test:structure`: 65 files / 817 tests passed.
- `npm run check`: passed with the existing three lint warnings and no error.
- `npm run build`: passed (642 modules; 71 PWA precache entries).
- HTML sanitizer and `npm run verify:smoke`: passed; smoke 3/3.
- Full `npm run verify` completed through the final smoke gate with the same
  passing totals.
- `git diff --check`: passed.
- Independent read-only review first found the same-view `pushState` gap, then
  accepted `165233f` with no remaining blocking finding.

## Rollback

Revert implementation commits `165233f` and `ccfc236`, followed by this
acceptance-document commit. No server, API, database, browser-storage, upload,
or persisted-draft migration needs reversal.
