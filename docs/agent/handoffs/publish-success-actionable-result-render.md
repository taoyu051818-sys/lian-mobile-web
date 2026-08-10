# Handoff: publish-success-actionable-result-render

## Status

Locally accepted on 2026-08-10. The implementation is commit `e5e2c65` on
`codex/audit-f2h-publish-success-preview`. It has not been pushed, merged, or
deployed. No server, credential, production, browser automation, or external
network access was used.

## Baseline

- Repository: `lian-mobile-web`
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Local prerequisite: F2g acceptance `e76418d`
- Runtime used for validation: Node 22.23.2

## Problem and reachability

F2g preserves a frozen `actionablePost` result after a normal successful
publish. It resets the live form and then restores that stored result. The old
preview component rendered its outer container only when the live draft still
contained text or structure, so reset live props plus a valid stored result
produced only a Vue comment node.

The internal published-result list existed and F2g composable tests proved the
result ref was populated, but no test rendered the real component predicate.
Regular and Event success therefore showed their success message and link while
hiding the structured published result.

A naive outer-predicate change would expose reset defaults and produce
contradictory output such as “普通帖子 / 文字 / 无结构” beside a stored Event or
Merchant result.

## What changed

- Split the component state into `hasLiveDraftPreview` and the outer
  `shouldRender` predicate.
- Kept live kind, body, wire kind, free-text hint, live sections, and suggested
  components inside a live-only template boundary.
- Rendered the stored published-result list as an independent sibling, so a
  normal reset still exposes the submitted result without fake live defaults.
- Preserved F2g's intentional A/B dual-state behavior: an editable live B may
  coexist with a stored published A, and each region reads only its owner.
- Changed the stored-result label from “将发布为” to “已发布为”.
- Added an exhaustive `Readonly<Record<InferredKind, string>>` for all seven
  current stored kinds. Future union expansion now fails type checking until a
  user-facing label is added.
- Added real in-process Vue SSR coverage and raised the Vitest file inventory
  from 160 to 161.

## Files changed

- `src/features/publish/PublishActionablePreview.vue`
- `src/config/brand/publish.ts`
- `tests/publish/publishActionablePreview.render.test.ts`
- `tests/publish/publishActionablePreview.structure.test.mjs`
- `scripts/check-test-inventory.mjs`
- `docs/agent/tasks/publish-success-actionable-result-render.md`
- `docs/CURRENT_STATUS.md`
- `docs/agent/handoffs/publish-success-actionable-result-render.md`

## API, storage, and migration

None. The same in-memory `PublishActionablePostPreview` is displayed under a
corrected render boundary. No endpoint, DTO, request, response, backend,
database, Redis, cookie, sessionStorage, dependency, or deployment contract
changed. No migration is required.

## Test evidence

- Against the old component, the new SSR suite produced eight intended
  failures: the dedicated published-only case plus all seven stored-kind cases
  rendered only `<!---->`. Three existing-state cases remained green.
- The initial structure additions also failed for the missing live/result
  boundaries and old future-tense brand value.
- Final focused matrix: 4 Vitest files / 39 tests and 18/18 focused Node
  structure tests passed.
- The SSR test imports and renders the real Vue SFC with
  `createSSRApp`/`@vue/server-renderer`; it covers published-only, empty,
  live-only, live B plus stored A, and all seven stored kinds.
- Full `npm run verify` passed in 101.8 seconds:
  - 161 Vitest files / 4,078 tests;
  - 65 Node structure files / 820 tests;
  - typecheck and production build (643 modules, 72 PWA precache entries);
  - HTML sanitizer and runtime guards;
  - loopback smoke 3/3;
  - lint with zero errors and three pre-existing warnings.
- Three independent reviewers recorded `ACCEPT` and no blocking finding.
  Review identified and then verified fixes for two test-contract defects:
  narrow null/`never[]` inference and a structure assertion that initially did
  not prove the stored block sat outside the live wrapper.

## Known risks and follow-up

- Event creation still lacks a server-backed idempotency contract. A server
  commit followed by a lost response may create a duplicate on retry. That is
  a coordinated frontend/backend follow-up and was not changed here.
- The stored result is mounted-page state rather than cross-reload persistence;
  F2h intentionally does not alter that product contract.
- F2h does not claim global localization, mounted cross-tab auth refresh,
  request cancellation, or server-side side-effect reversal.
- The next bounded page-level audit is Feed.

## Rollback

Revert implementation commit `e5e2c65` and the following documentation
acceptance commit. Restore the Vitest inventory from 161 to 160. No API,
server, database, Redis, browser-storage, or deployed-state cleanup is needed.

## Not done

- No push, pull request, merge, deployment, production access, server access,
  credential use, or network probing.
- No F2g submit/reset code, PublishView, API client, type, backend, auth,
  upload, location, Event input, or editor behavior changed.
