# RC1 B2 location-to-errand frontend closure handoff

Status: GREEN locally implemented; independent review required before merge.
Date: 2026-08-24
Worktree: `work/r/fe-errand`
Branch: `codex/rc1-b2-location-errand-frontend`
Base: `8e12abf140db1c4067b0cacd4463983fbf14a2be`

## What changed

- Added `ErrandDropoffPlacePicker.vue` and mounted it as a sibling of the dropoff input label.
- `useErrandOrderDraft` now owns catalog place loading and structured dropoff selection.
- Manual dropoff edits clear stale stable place identity and coordinates.
- `completeErrandOrder(orderId)` posts to the accepted requester-complete endpoint.
- `useErrandOrderDetail` exposes requester-only complete state/actions and uses strict operation
  ownership for refresh, cancel, complete, managed identity load/reset, and polling.
- `ErrandOrderTimelineView` loads viewer identity, gates requester completion, and avoids stale
  owner commits after logout/unmount/order/viewer changes.
- Runner normalization tolerates privacy-minimal pool DTOs where private locations and notes are
  omitted.
- `scripts/check-test-inventory.mjs` was updated only for the accepted scope addendum: one new
  frozen Vitest file raises the inventory from 184 to 185. Scanning/classification behavior was not
  changed.

## Validation

- Targeted owner RED:
  - auth-before-detail admission failed before fix.
  - reset-before-first-identity and stale in-flight poll admission failed before fix.
- Targeted owner GREEN:
  `tests/errand/useErrandOrderDetail.test.ts` passed 16/16.
- Focused Vitest:
  `tests/errand` plus `tests/runner/runner-api-contract.test.ts` passed 42/42.
- Structure:
  `tests/errand/errand-order.structure.test.mjs` passed 37/37.
- Type:
  `vue-tsc --noEmit` passed.
- `npm run check` failed only at the repository format baseline: 26 existing files require Prettier;
  scoped files were already formatted and were not listed.
- `npm run lint` passed with 0 errors and 3 pre-existing warnings.
- `npm run build` remains blocked by missing local `workbox-window` resolution in the installed
  dependency tree.
- Local Playwright journey remains blocked before execution because neither the configured local
  Chrome channel nor bundled Chromium is installed in this environment.

## Generated artifacts

Generated output from check/build/e2e was moved recoverably under
`work/verification/generated-artifacts/rc1-b2-errand-green/`, including:

- `fe-generated-20260824-224914/`
- `fe-generated-20260824-230159/`

## Review asks

- Confirm the accepted inventory addendum changes only the Vitest count/comment.
- Confirm picker placement is not nested in a label and no view imports `src/api/*` directly.
- Confirm completion CTA is requester-only, delivered-only, in-flight guarded, and late
  success/error/finally cannot commit after logout/reset/unmount/order/viewer/poll owner changes.
- Confirm runner minimal DTO decoding/UI remains omission-tolerant without leaking private fields.
- Confirm local E2E fixture preserves the four distinct accounts and recursive sentinel checks once
  a browser is available.
