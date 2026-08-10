# Task: publish-success-actionable-result-render

## Status and source

- Decision date: 2026-08-10.
- Repository: `lian-mobile-web`.
- Upstream source reviewed: `main@d0ee0e9802149e5d99bd2c5064d6770adb1c041d`.
- Local prerequisite: F2g acceptance `e76418d` with implementation `ea0c29e`.
- Working branch: `codex/audit-f2h-publish-success-preview`.
- The root `README.md`, `package.json`, current status, F2g task/handoff,
  Publish preview component, publish-result type, brand strings, submit/reset
  flow, and current structure tests were checked from the local accepted
  baseline.
- Recent online issues and merged pull requests are intentionally not queried:
  the user paused network/security-related activity. This local task document
  is the only active scope record and must not be described as pushed, merged,
  deployed, or production-verified.
- This is a local render-policy correction. It changes no HTTP endpoint, DTO,
  persistence key, backend, authentication, deployment, or production state.

## Reproduced problem

F2g correctly captures a frozen actionable result before submission. On a
normal owned success it resets the live form and then restores the stored
`actionablePost` result. The preview component nevertheless renders its outer
container only when the reset-owned live draft still has text or structure.

The deterministic sequence is:

```text
submit A -> success -> clear live draft -> restore stored result A
         -> outer preview predicate sees only the empty live draft -> hide A
```

The success message and post link remain visible, but the structured published
result is unreachable. Regular, Event, image, Merchant, Trade, help, and place
results can all reach this state.

Adding `actionablePost` to the outer predicate alone is not sufficient. It
would also reveal the reset live-draft defaults, producing contradictory output
such as “普通帖子 / 文字 / 无结构” beside a stored Event or Merchant result.

## Product decision

Treat the two preview sources as independent UI regions:

- the live-draft preview describes the currently editable draft;
- the stored published-result panel describes the successful submitted
  snapshot;
- either source may make the outer container visible;
- live-only labels, body, sections, and suggested components render only when
  meaningful live draft state exists;
- the stored result renders independently and never inherits reset defaults;
- when A has published and the user is editing B, both regions may be visible:
  live fields describe B and the stored panel describes A.

Because the stored panel is reachable only after a response, its label is past
tense: “已发布为”. Internal kind values are mapped to user-facing Chinese
labels: text, image, help, place, event, merchant, and trade become 文字、图片、
求助、地点、活动、商家、交易.

## Goal and render model

Use two explicit predicates:

```ts
const hasLiveDraftPreview = computed(
  () => title/body content exists || live structure exists,
);

const shouldRender = computed(
  () => hasLiveDraftPreview.value || Boolean(props.actionablePost),
);
```

Required invariants:

- Empty live props plus a stored result render the outer preview and published
  result panel.
- Published-only mode does not render the live kind, wire kind, free-text hint,
  live sections, or live suggested components.
- Empty live props plus no stored result render nothing.
- Live-draft-only behavior remains unchanged.
- Live B plus stored A renders both independent regions without mixing values.
- Every `PublishActionablePostPreview.kind` has a stable user-facing label;
  raw enum values never appear in the published-result UI.
- The stored-result heading is “已发布为”, not the pre-submit future tense.
- Existing F2g submit/reset ownership and result lifecycle stay unchanged.

## Allowed files

Runtime:

- `src/features/publish/PublishActionablePreview.vue`
- `src/config/brand/publish.ts` (published-result tense only)

Tests and inventory:

- `tests/publish/publishActionablePreview.render.test.ts` (new)
- `tests/publish/publishActionablePreview.structure.test.mjs`
- `scripts/check-test-inventory.mjs` (Vitest 160 -> 161 only)

Documentation:

- `docs/CURRENT_STATUS.md`
- `docs/agent/tasks/publish-success-actionable-result-render.md`
- `docs/agent/handoffs/publish-success-actionable-result-render.md`

## Forbidden files and non-goals

- No `usePublishSubmit`, `PublishView`, API client, DTO, endpoint, request,
  response, backend, database, Redis, auth, dependency, build, deployment, or
  production change.
- No change to F2g snapshot/owner/reset ordering or regular-post idempotency.
- No Event idempotency invention; ambiguous Event retry remains a coordinated
  frontend/backend follow-up.
- No editor lock, layout redesign, new interaction, animation, or design-token
  change.
- No global localization migration. F2h maps only the seven existing stored
  preview kind values at this component boundary.
- No E2E call to an online origin, server access, credential use, network
  probing, push, merge, or deployment.
- No file outside the allowed list.

## Test-first matrix

The new behavior test uses Vue server rendering in-process. It must not start a
browser, web server, backend, or network request.

- Blank live draft + stored regular text result: outer container and stored
  panel render; live header/body/wire-kind/unstructured UI do not render.
- Blank live draft + stored Event result: stored panel renders “已发布为：活动”
  with no contradictory “普通帖子 / 文字” live shell.
- Blank live draft + `actionablePost=null`: the component renders no preview.
- Live draft only: current kind, wire kind, text/structure, and component
  behavior remains visible.
- Live B + stored A: the live region contains only B while the stored region
  contains only A.
- Table-driven stored-kind coverage renders the Chinese label for all seven
  `InferredKind` values and never renders the raw enum token as its kind label.
- The existing structure test proves the two render predicates remain separate
  and the published block is outside the live-only wrapper.

## Acceptance criteria

- [ ] The old implementation fails the published-only server-render test
      because its outer predicate hides the stored result.
- [ ] The minimal implementation passes every render-mode and kind-label case.
- [ ] Existing F2g submit/result ownership tests remain unchanged and green.
- [ ] Vitest inventory is exactly 161; Node structure inventory remains 65.
- [ ] Typecheck, build, sanitizer, smoke, focused tests, and full
      `npm run verify` pass.
- [ ] Independent review records acceptance and no blocking finding remains.
- [ ] Only allowed files change; no network, production, push, merge, or
      deployment action occurs.

## Data, compatibility, and migration

None. The same `PublishActionablePostPreview` object is rendered with a corrected
visibility boundary and user-facing labels. No browser storage, wire payload,
server record, or schema changes. No migration is required.

## Risks

- A broad outer gate could expose reset defaults. Mitigation: gate every live
  preview region with `hasLiveDraftPreview` and exercise published-only Event
  rendering.
- A partial kind map could leak raw enum values or silently mislabel future
  values. Mitigation: an exhaustive `switch` over the current `InferredKind`
  union plus table-driven rendering tests.
- A structural-only test could pass while Vue still hides the result.
  Mitigation: render the real SFC with `@vue/server-renderer`.

## Rollback

Revert the bounded F2h runtime, tests, inventory, and documentation commits.
No API, server, database, Redis, browser-storage, or deployed-state cleanup is
required.

## Validation commands

```bash
npx vitest run \
  tests/publish/publishActionablePreview.render.test.ts \
  tests/publish/usePublishSubmitSnapshotOwnership.test.ts \
  tests/publish/usePublishSubmitIdempotency.test.ts \
  tests/publish/usePublishSubmitEventDraftContext.test.ts
node --test \
  tests/publish/publishActionablePreview.structure.test.mjs \
  tests/publish/viewPostEntry.structure.test.mjs
npm run build
npm run verify
```
