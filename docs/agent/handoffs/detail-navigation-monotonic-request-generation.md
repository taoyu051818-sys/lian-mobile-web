# Handoff: detail-navigation-monotonic-request-generation

## Status

Locally accepted on 2026-08-10. The implementation is commit `1653237` on
`codex/audit-f2a-detail-request-generation`. It has not been pushed, merged, or
deployed. Control issue: [#1086](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1086).

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F1 acceptance `b5d1588`
- Runtime used for validation: Node 22.23.2

## What changed

- `closed`, `loading`, `ready`, and `error` now all retain the latest request
  token. The token remains the existing request-generation field; no parallel
  counter or renamed wire shape was introduced.
- Open, retry, and URL synchronization to a new post increment the retained
  token. Close and settled results preserve it.
- A delayed response is accepted only when the detail is still loading and the
  response token equals the current token.
- Regression coverage now includes close/reopen, ready/new-post, retry, and
  multi-post delayed-result sequences.

URL hashes, history effects, selectors, API requests, DTOs, DOM, shell chrome,
dependencies, backend behavior, and persisted data did not change.

## Validation

- Reducer/store focused tests: 43/43 passed.
- Detail-navigation tests: 54/54 passed.
- Detail plus dependent token/deep-link contracts: 6 files / 99 tests passed.
- `npm run test:unit`: 155 files / 3,961 tests passed.
- `npm run test:structure`: 65 files / 817 tests passed.
- `npm run check`: passed.
- `npm run build`: passed (642 modules; 71 PWA precache entries).
- `npm run verify:smoke`: 3 checks passed; port 4301 was free afterward.
- `npm run verify`: exit 0.
- `git diff --check`: passed.
- Independent read-only review: accepted with no blocking finding.

The existing non-blocking warning inventory remains unchanged: three lint
warnings, fifteen allowlisted view/API imports, nine unlisted assets,
thirty-three stale-document markers, and twenty-nine Vue files over 300 lines.

## Rollback

Revert implementation commit `1653237` and its acceptance-document commit. No
server, API, database, URL, history, or browser-storage migration needs
reversal.
