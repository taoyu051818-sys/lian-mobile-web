# RC1 location-to-errand user closure

Status: GREEN locally implemented; independent review pending
Date: 2026-08-24
Base: `8e12abf140db1c4067b0cacd4463983fbf14a2be`

## Current source check

- Revalidated the current errand, runner, map, place, profile/logout, and local Playwright code on
  the pinned base.
- Checked the root `package.json`, current API callers, `tests/e2e/errand-full-chain-proof.spec.ts`,
  and the local deterministic journey lane.
- The historical override files named by the task template are absent on the pinned base; current
  code and merged history are authoritative.
- The existing production-style errand proof advances a pre-seeded order and only proves that the
  browser view mounts. The local proof uses one registered fixture for every transition and does
  not exercise the errand UI or account boundaries.

## Goal

Complete one truthful requester-to-runner errand journey using a stable catalog place, requester
completion, distinct accounts, and a deterministic browser gate that proves private location data
does not cross account boundaries.

## User flow

`creator A merchant detail -> choose catalog dropoff -> create -> logout -> other runner C sees only
the exact safe pool DTO -> logout -> assigned runner B accepts -> logout -> runner C cannot read the
assigned order -> runner B advances/delivers -> logout -> ordinary user cannot read it -> creator A
observes delivered/completes -> runner B is downgraded to the terminal safe DTO`

## Allowed files

- `src/api/errands.ts`
- `src/api/runner.ts`
- `src/types/errand.ts`
- `src/types/runner.ts`
- `src/config/brand/merchant.ts`
- `src/features/errand/ErrandOrderView.vue`
- `src/features/errand/ErrandOrderTimelineView.vue`
- `src/features/errand/useErrandOrderDraft.ts`
- `src/features/errand/useErrandOrderDetail.ts`
- `src/features/errand/ErrandDropoffPlacePicker.vue`
- errand-focused files under `tests/errand/**`
- errand-focused files under `tests/runner/**`
- `tests/e2e/local/errand-location-runner-fixture.ts`
- `tests/e2e/local/errand-location-runner-journeys.spec.ts`
- `scripts/check-test-inventory.mjs` (test inventory count only; required because this frozen
  RED adds one Vitest file)
- `docs/agent/tasks/rc1-location-errand-closure.md`
- `docs/agent/handoffs/rc1-location-errand-closure.md`

## Scope addendum: test inventory gate

The frozen RED introduced `tests/errand/errand-api-complete.test.ts`, raising the repository's
Vitest inventory from 184 to 185. GREEN may update only the numeric/comment expectation in
`scripts/check-test-inventory.mjs` so `npm run check` continues to account for every test file. This
addendum does not authorize runtime, dependency, test discovery, or unrelated script behavior
changes.

## Scope addendum: P0 review remediation round 2

Independent adversarial review found three frontend contract gaps after the first GREEN freeze.
This follow-up stays on the pinned `b396b32b4d7f78c7cb1f9f9e82cc176b92d7512c` commit and may
add or change only the following files beyond the original allowlist:

- `src/features/errand/ErrandOrderMeta.vue`
- `src/features/runner/RunnerOrderCard.vue`
- `src/features/runner/useRunnerCenter.ts`
- shared real-wire fixtures under `tests/errand/fixtures/**`
- `tests/runner/useRunnerCenter.test.ts`

The remediation must make public lifecycle resets (`stop`, managed-viewer reset, and order-id
switch) immediately clear detail, loaded/error state, pending actions, and CTA eligibility while
preserving a successful terminal response through an internal polling-only stop. Cancel and
complete writes require the requested id to equal both the active id and the loaded detail id, plus
their respective capability gate. Late success, failure, or `finally` work from a retired owner may
not mutate the new owner.

The backend's exact terminal runner projection is a valid detail wire shape even though it omits
requester id, pickup/dropoff, timeline, and notes. The frontend must render that safe minimum
without inventing private fields or reporting a load failure. Runner `/mine?role=runner` keeps
completed/cancelled safe history in the active tab with explicit terminal labels and no transition
actions; unknown or terminal backend states may not collapse to `available`. The deterministic
browser fixture must use the real terminal projection instead of returning an empty list that
masks decoder drift.

This addendum does not authorize new routes, auth/session changes, storage, dependencies, generic
runner redesign, notification payload expansion, production data, push, merge, or deployment.

### Round-2 frozen RED/GREEN evidence

- Frozen focused RED: 60 tests, 51 pass / 9 expected fail. The failures were four immediate
  lifecycle clears (managed reset, injected-viewer change, public stop, and order switch), two
  exact cancel/complete gates, one exact-safe terminal detail decoder, one terminal `/mine`
  status, and one terminal history label/action contract. The retired-owner `finally` fence was
  already green.
- The same focused set now passes 60/60. It includes the detail/action owner tests, real terminal
  wire decoder, runner history decoder/rendering, status normalizer, and notification read path.
- Strict TypeScript, scoped Prettier, and scoped ESLint pass. The full structure suite passes
  863/863.
- Microsoft Edge passes the deterministic distinct-session full chain 1/1, including terminal
  history without an accept CTA and notification navigation to a valid privacy-minimal detail with
  no pickup/dropoff/private sentinel in the DOM.
- The full Vitest run passed 5009 tests and had one environment-only failure because this bundled
  Windows runtime has no `npx` executable for an existing production-bundle guard. A direct Vite
  attempt was independently blocked by the inherited dependency tree missing `workbox-window`;
  neither failure names a scoped task file.
- Broad-test stat touches had byte-identical Git blobs for four publish snapshots and were cleared
  by index refresh. The partial build output was hash-audited and moved recoverably outside the
  repository under `work/verification/generated-artifacts/`.

## Forbidden scope

- No auth/profile/community/NodeBB/GDPlatform/LAPlatform/commerce/admin runtime change.
- No generic map picker rewrite, free pin, browser geolocation, live runner location, auto-assign,
  radius matching, dispute, partial refund, or new dependency.
- No backend code in this repository and no runtime data, production, credential, push, merge, or
  deployment action.
- Do not depend on another RC1 branch.

## Contract

- The dropoff selector reads the existing same-origin `GET /api/map/v2/items` catalog.
- Selecting a catalog item writes its stable place id, display label, and finite coordinates into
  the existing `PostLocation` request shape.
- Editing the selected label manually clears the stale place id and coordinates before submit.
- `POST /api/errands/orders/:orderId/complete` is exposed only when the requester sees `delivered`.
  It is guarded while in flight and adopts only a normalized returned order detail.
- Browser actors are always distinct: creator A, assigned runner B, other runner C, and an ordinary
  user. Every switch crosses a real logout/login boundary in the fixture.
- After logout, delayed responses and prior-account DTOs must not render under the next account.
- The runner pool and terminal runner history must tolerate privacy-minimal DTOs with locations and
  notes omitted. The browser test recursively rejects private sentinels in API bodies and DOM.

## Explicit follow-ups

- Create does not currently carry a cross-request idempotency key. A lost successful response can
  lead to a second order and wallet lock on retry.
- Create does not currently re-run the eligibility contract server-side; the UI preflight can be
  bypassed by a direct caller.
- Catalog `placeId` is supplied by the client and is not yet attested by the backend. It must never
  be treated as a server-owned safe area for runner-pool disclosure.

## RED matrix

- R1: catalog place selection preserves stable identity; manual edit removes stale identity.
- R2: create wire carries the selected structured location.
- R3: requester complete is available only at `delivered` and settles to `completed` once.
- R4: privacy-minimal runner DTOs normalize and render without private fields.
- R5: one same-page Playwright journey crosses all four identities and recursively proves sentinel
  absence before assignment, for non-participants, after logout, and after completion.
- R6: every intercepted request is accounted for.

## Frozen RED evidence

- Focused Vitest: 36 tests, 28 pass / 8 expected fail. The eight failures are intentionally
  distributed as catalog-place draft adoption (1), requester-complete API exposure (1), delivered
  creator positive eligibility (1), creator negative eligibility plus zero API calls for
  `created` / `assigned` / `completed` (3), in-flight second-call locking (1), and
  omission-preserving runner-pool normalization (1). The three explicit non-delivered creator
  cases prevent an ownership-only implementation from passing the completion contract.
- Structure test: 36 tests, 33 pass / 3 expected fail. Missing contracts are the picker mount,
  picker/complete brand strings, and the delivered-only complete action.
- Strict TypeScript (`vue-tsc --noEmit`): passes on the frozen RED tree.
- Local Playwright: the distinct-session fixture and spec type-check and are discoverable. This
  Windows runner is currently blocked before test execution because its configured local Chromium
  executable is absent; no browser result is represented as a product assertion. Once Chromium is
  present, the journey's first expected runtime RED remains
  `errand-order-dropoff-place-picker`.
- The browser journey freezes creator A, assigned runner B, other runner C, and ordinary D as
  distinct login sessions. It asserts recursive sentinel absence, exact pool keys, participant-only
  reveal, creator completion, and terminal runner downgrade. Every held old-account response is
  released only after the next account has logged in and established its own visible state, then the
  new account's DOM/state is checked for the old title and private sentinels. For the held runner B
  `/mine` response, runner C first establishes the available view, B's response is released and
  awaited, then runner C actually switches to the active view while its own refresh is held. The
  test asserts an empty active view, no old B DTO, and no private sentinel both before and after
  runner C's empty response settles, catching hidden-tab pollution.

## GREEN implementation evidence

Implemented on 2026-08-24 in the scoped frontend worktree.

- Catalog dropoff selection uses the existing same-origin `GET /api/map/v2/items` catalog through a
  colocated errand composable, preserving stable place identity, display label, and finite
  coordinates.
- Manual dropoff edits clear stale `placeId`, `lat`, and `lng` before submit.
- Errand create wires the selected structured dropoff request shape.
- Requester completion posts to `/api/errands/orders/:orderId/complete` only when the current viewer
  is the delivered order requester, and guards duplicate in-flight calls.
- Detail/complete ownership now uses operation snapshots covering order id, viewer id, lifecycle,
  managed identity generation, reset/unmount, and poll owner state. Late success/error/finally from
  logout, reset, viewer switch, active-order switch, and poll refresh cannot commit under the next
  owner.
- Runner pool DTO normalization tolerates omitted locations/notes and preserves minimal public keys.
- The picker is a sibling of the dropoff input label, avoiding nested interactive controls.

Validation run:

- Targeted owner RED before fix:
  `tests/errand/useErrandOrderDetail.test.ts` failed 1/14 for auth-before-detail admission, then
  failed 2/16 for reset-before-first-identity and stale poll admission.
- Targeted owner GREEN after fix:
  `tests/errand/useErrandOrderDetail.test.ts` passed 16/16.
- Focused Vitest:
  `node node_modules/vitest/vitest.mjs run tests/errand tests/runner/runner-api-contract.test.ts`
  passed 42/42.
- Structure:
  `node --test tests/errand/errand-order.structure.test.mjs` passed 37/37.
- Strict TypeScript:
  `vue-tsc --noEmit` passed.
- `npm run check` passed structure, encoding, inventory 185/68, runtime exposure, unsafe DOM,
  view-boundary, asset/stale/ownership/large-vue warning gates, then failed only at repository
  format baseline: 26 pre-existing files need Prettier; no scoped task file appeared in the warning
  list.
- `npm run lint` passed with 0 errors and 3 pre-existing warnings in map/detail tests.
- `npm run build` passed `vue-tsc` and failed in Vite/PWA because local `node_modules` cannot resolve
  `workbox-window`.
- `npm run test:e2e:local -- tests/e2e/local/errand-location-runner-journeys.spec.ts` was discovered
  as 1 test but could not launch because local Chrome is absent at
  `C:\Users\Admin\AppData\Local\Google\Chrome\Application\chrome.exe`.
- Generated `test-results/`, `dist/`, and ownership-doc side effects were moved recoverably under
  `work/verification/generated-artifacts/rc1-b2-errand-green/`.

## Scope addendum: final-review terminal write ownership

The final independent review found one remaining same-order race inside the already-scoped detail
composable. A manual refresh admitted before a successful requester `complete` or `cancel` can settle
after that terminal write, replace the adopted terminal DTO with its older active DTO, and re-enable
the CTA for a second POST. This addendum permits only the composable, its focused runtime tests, and
this task record. A successful terminal write must retire every earlier read owner while retaining
its own terminal detail; late read success, error, and `finally` paths must not change detail,
loading, error, or action eligibility.

### Final-review RED/GREEN evidence

- Frozen RED: the focused composable file ran 25 tests, with 23 pass / 2 expected fail. The complete
  and cancel cases both showed the same stale-read takeover: terminal detail was initially adopted
  while loading remained true, then the earlier active response and error rewrote detail/error,
  re-enabled the CTA, and increased the terminal POST count from one to two.
- GREEN: the focused composable file passes 25/25; the broader errand/runner/notification Vitest
  gate passes 125/125; the complete structure suite passes 863/863; strict TypeScript, scoped
  Prettier/ESLint, encoding, test-inventory, runtime-exposure, and `git diff --check` pass.
- Microsoft Edge passes the deterministic distinct-session chain 1/1 in 14.6 seconds (22.3 seconds
  including the local Vite lifecycle).

## Validation

```powershell
npm exec vitest run tests/errand tests/runner/runner-api-contract.test.ts
npm run test:structure
npm run test:e2e:local -- tests/e2e/local/errand-location-runner-journeys.spec.ts
npm run check
npm run build
git diff --check
```

## Rollback

Revert only the scoped frontend, tests, task, and handoff commit. The change owns no persisted
business data or deployment flag.
