# Handoff: audit-b0-quality-gate

## Status

Locally accepted on 2026-08-10. The changes are on
`codex/audit-b0-quality-gate` and have not been committed, pushed, or deployed.

## Baseline

- Repository: `lian-mobile-web`
- Base: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`
- Runtime used for validation: Node 22.23.2

## What changed

- Vitest now discovers all current `tests/**/*.test.ts` and
  `src/**/*.test.ts` files.
- A cross-platform Node runner discovers all `tests/**/*.test.mjs` files.
- An inventory guard makes test-file additions and removals explicit.
- Previously omitted structural tests now assert current semantic contracts
  instead of retired layout, comment, whitespace, or import formatting.
- `stripHtml` restores the existing sanitizer smoke contract and has direct
  unit coverage.
- The smoke wrapper now rejects occupied ports, observes preview startup
  failure, runs Vite directly, and shuts its preview process down.

No feature page, API module, state store, style sheet, asset, backend file, or
production configuration was changed.

## Validation

- `npm run test:unit`: 154 files / 3,946 tests passed.
- `npm run test:structure`: 65 files / 817 tests passed.
- `npm run test:html-sanitizer`: passed.
- `npm run build`: passed (642 modules; 71 PWA precache entries).
- `npm run verify:smoke`: 3 checks passed; no listener remained on port 4301.
- `npm run verify`: exit 0.
- `git diff --check`: passed.

## Known follow-ups

The quality gate still reports its pre-existing non-blocking inventory: three
lint warnings, fifteen allowlisted view/API imports, nine unlisted assets,
thirty-three stale-document markers, and twenty-nine Vue files over 300 lines.
These belong in later bounded refactor batches and were intentionally not
mixed into B0.

## Rollback

Revert this batch. It has no data migration, persisted browser state change,
or server-side dependency.
