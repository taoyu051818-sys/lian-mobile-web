# Task: audit-b0-quality-gate

## Current source check

- Current code: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Working branch: `codex/audit-b0-quality-gate`.
- Root `README.md`, `package.json`, `vitest.config.ts`, `docs/agent/00_AGENT_RULES.md`,
  `docs/CURRENT_STATUS.md`, and the current task template were checked.
- The repository references several May 2026 override documents that are no
  longer present. Current code, package scripts, and active repository rules
  are authoritative for this task.

## Goal

Make the frontend quality gate discover and execute every current unit and
Node structure test, and repair the sanitizer smoke test so a green `verify`
result reflects the repository's real test surface.

## Product scope

No product behavior changes. This task restores trustworthy engineering
feedback before the code-level refactor begins.

## Repository and ownership scope

- Repository: `lian-mobile-web`.
- Owned area: frontend test discovery, test-only contract maintenance,
  sanitizer utility smoke coverage, and task documentation.
- Backend/API/runtime changes required: none.

## Allowed files

- `package.json`
- `vitest.config.ts`
- `scripts/check-test-inventory.mjs`
- `scripts/run-node-tests.mjs`
- `scripts/run-smoke-with-server.js`
- `scripts/test-html-sanitizer.js`
- `src/utils/html.ts`
- `tests/**/*.test.mjs` only where a previously undiscovered structural test
  is stale or format-dependent
- the four previously undiscovered `*.test.ts` files
- `tests/html/stripHtml.test.ts`
- `tests/smoke/run-smoke-with-server.test.mjs`
- `docs/agent/tasks/audit-b0-quality-gate.md`
- `docs/agent/handoffs/audit-b0-quality-gate.md`

## Forbidden files

- Backend repository files
- Production feature, page, API, state, style, and asset files
- Runtime data or deployment configuration
- Existing tests that were already green, except the sanitizer utility tests
  explicitly listed above

## Data or state changes

None.

## API or contract changes

None. `stripHtml` is exported as a shared pure utility only to restore the
existing smoke-test contract; this task does not replace feature callers.

## Baseline evidence

- Main Vitest command: 149 files, 3,908 tests, all passing.
- Undiscovered Node tests: 64 files, 822 tests, 57 failing.
- Four additional undiscovered TypeScript tests: 35 tests, 4 failing.
- `npm run test:html-sanitizer`: fails before assertions because `stripHtml`
  is not exported.
- The smoke wrapper can report success when port 4301 is already occupied: its
  preview child exits, but readiness is satisfied by the unrelated listener.

## Acceptance criteria

- [x] Vitest discovers every `tests/**/*.test.ts` and `src/**/*.test.ts` file.
- [x] A cross-platform Node runner discovers every `tests/**/*.test.mjs` file.
- [x] Previously undiscovered tests pass without changing product behavior.
- [x] Sanitizer smoke tests execute and pass.
- [x] The smoke wrapper fails closed on an occupied port and shuts down the
      preview process it starts.
- [x] `npm run verify` includes both test families and the sanitizer smoke test.
- [x] The tracked working tree contains only files allowed by this task.

## Validation commands

```bash
npm run check
npm run test:unit
npm run test:structure
npm run test:html-sanitizer
npm run build
npm run verify:smoke
npm run verify
```

## Reviewer validation

Accepted locally on 2026-08-10 against Node 22.23.2.

- `npm run test:unit`: 154 files, 3,946 tests passed.
- `npm run test:structure`: 65 files, 817 tests passed.
- `npm run test:html-sanitizer`: passed.
- `npm run build`: 642 modules transformed; PWA generated with 71 precache
  entries.
- `npm run verify:smoke`: 3 checks passed, and port 4301 was free afterward.
- Occupied-port regression: runner exits 1 before build.
- `npm run verify`: exit 0.
- `git diff --check`: passed.

The existing warning inventory remains visible: three lint warnings, fifteen
allowlisted view/API imports, nine unlisted public assets, thirty-three stale
documentation keyword warnings, and twenty-nine Vue files over 300 lines.
No production deployment was performed.

## Risks

- Structural tests may encode retired implementation details. Mitigation:
  assert current user-visible or architecture contracts and avoid exact
  whitespace/import-layout checks.
- Broadening Vitest discovery may reveal real regressions. Mitigation: do not
  suppress them; classify and fix or create a follow-up task.
- Node's direct TypeScript loading is version-sensitive. Mitigation: retain the
  repository's explicit Node 22 engine and run validation on Node 22.

## Rollback plan

Revert this task's commit. No user data, API, or persisted browser state needs
rollback.
