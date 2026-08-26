# Handoff: RC1 B1 identity + community closure

Lifecycle: local implementation handoff. Independent review is still required; no push, merge, or
deployment has occurred.

## Summary

- Notification rows now preserve backend provider source and a positive reply `pid`; navigation still
  opens the existing topic detail by `tid`.
- Merge identity, Vue keys/memo invalidation, optimistic local read marks, and failure rollback all use
  `(source,id)`, so LIAN and NodeBB rows with the same raw ID remain visible and independent.
- The existing optimistic read UX and backward-compatible no-source call shape remain unchanged.
- Read transport is a single-item call, avoiding a scalar source being incorrectly applied to a
  mixed-provider ID batch.
- A hermetic same-browser journey drives A login/logout, B login/reply/logout, A login/inbox/read and
  proves actor, inbox, and mutation ownership at every step.
- The local Playwright config accepts an optional `LIAN_LOCAL_E2E_BROWSER_CHANNEL`; its existing
  Chrome default and CI behavior are unchanged.

## API and state

- Additive `NotificationItem.source?: "lian" | "nodebb"` and `NotificationItem.pid?: number`.
- `POST /api/notifications/:id/read?source=lian|nodebb` when the row declares a source; legacy rows
  continue to call the original path without a query.
- The positive `pid` is preserved as data only. `NotificationItem.target` remains `{ kind: "detail",
tid }`, and notification open continues to `#/post/:tid`.
- No persisted frontend state, runtime data, backend file, schema, or production configuration changed.

## TDD and verification

- RED refinement: the focused frontend matrix produced 14 pass / 21 fail for missing composite
  provider identity, provider-isolated optimistic state/rollback, single-item source-scoped API,
  positive pid preservation, and Vue-key structure.
- GREEN: the focused Vitest matrix produced 38/38 pass; the existing Node structure contract for
  notification read wiring produced 14/14 after being updated to the single-item/composite contract.
- Browser RED: the journey initially failed before the hermetic fixture existed.
- Browser stability RED: one cold Vite start remained on the lazy profile route's loading shell past
  the default five-second assertion, before any auth or fixture write. The helper now gives that one
  cold-start assertion 15 seconds without widening the global timeout.
- Browser GREEN:
  `LIAN_LOCAL_E2E_BROWSER_CHANNEL=msedge npx playwright test tests/e2e/local/identity-community-journeys.spec.ts --config=playwright.local.config.ts`
  initially produced 1/1 pass; the final `--repeat-each=3` stability run produced 3/3. Each run
  recorded login writes `[a,b,a]`, logout writes `[a,b]`, one B-owned reply, and exactly one A-owned
  NodeBB read while B's notification stayed unread.
- Final Node 22 `npm run check`: passed with only three pre-existing lint warnings; test inventory
  remained frozen at 184 Vitest files and 68 Node test files.
- `npm run build`: passed; Vue type-check and production Vite/PWA build succeeded.
- Full `npm run test:unit`: 4,992 passed / 1 failed. The sole failure is an unchanged Windows test
  harness issue: `execFileSync("npx")` returns `ENOENT`; the production build was separately green.

## Risks and not done

- The browser fixture proves the UI and transport contract, not a real NodeBB deployment.
- Backend direct/fallback provider behavior and its risks are recorded in the paired backend handoff.
- Reply-level scroll/anchor positioning is not implemented. The retained `pid` is available for a
  later navigation slice, while this batch deliberately keeps the existing topic-level `tid` route.
- Production/staging credentials, external services, deployment, push, merge, private messages,
  commerce/GD, and LAPlatform were intentionally not touched.
- Integration must include the backend slice and P0 migrated-auth prerequisite before acceptance.

## Cleanup and rollback

Playwright uses page-local in-memory data and loopback interception; no cleanup is needed. Rollback is
commit-level by reverting this local frontend slice and the paired backend slice. Ignored build,
browser, and generated ownership-doc outputs were moved out of the worktree without loss (99 files /
41,550,581 bytes) to
`work/verification/generated-artifacts/rc1-b1-identity-community-frontend/`; the worktree retains no
`dist/` or `test-results/` directory.
