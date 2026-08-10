# Handoff: publish-ai-attempt-boundary

## Status

Locally accepted on 2026-08-10. The implementation is commit `391d17a` on
`codex/audit-f2b-publish-ai-attempt-boundary`. It has not been pushed, merged,
or deployed. Control issue:
[#1087](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1087).

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2a acceptance `ee8ff1a`
- Runtime used for validation: Node 22.23.2

## What changed

- Publish now owns one monotonically increasing AI attempt generation shared
  by the image-preview and editor-LLM paths.
- Resetting the form clears candidates, component suggestions, inferred kind,
  preview loading/error/suggestions/risk state, and re-arms the next draft's
  first-image preview.
- Both paths accept a response only when its request ticket, attempt generation,
  title, body, ordered image URLs, and location still match.
- Attempt change cancels pending editor debounce work. Disposing either
  composable invalidates unfinished results.
- The editor watcher remains title/body-only; image and location changes do not
  create new automatic requests.
- Behavior tests now cover reset with identical replacement content, every
  input snapshot dimension, explicit refresh, latest-request-wins, re-arming,
  and scope disposal.

Publish payloads, API contracts, user-facing copy, model prompts, persisted
draft formats, `PublishView`, submit behavior, backend behavior, and the
existing image/location trigger fixmes did not change.

## Validation

- Initial red run: 3 files / 47 tests; 36 passed and 11 failed on the old
  implementation for the intended reasons.
- Final focused tests: 3 files / 51 tests passed.
- `npm run test:unit`: 156 files / 3,978 tests passed.
- `npm run test:structure`: 65 files / 817 tests passed.
- `npm run check`: passed with the existing three lint warnings and no error.
- `npm run build`: passed (642 modules; 71 PWA precache entries).
- HTML sanitizer and `npm run verify:smoke`: passed; smoke 3/3.
- Full `npm run verify`: exit 0; port 4301 was free afterward.
- `git diff --check`: passed.
- Independent read-only review: accepted with no blocking finding.

## Rollback

Revert implementation commit `391d17a` and its acceptance-document commit. No
server, API, database, browser-storage, or persisted-draft migration needs
reversal.
