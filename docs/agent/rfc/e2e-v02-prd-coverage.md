# RFC: V0.2 publish PRD — e2e coverage blueprint

Status: draft (this RFC enumerates the gap; spec PRs are tracked as separate issues)
Owners: LIAN frontend / publish-experience lane
Scope: `lian-mobile-web` `tests/e2e/` matrix for `PRD_POST_CREATION_REVOLUTION_V0.2`
Date: 2026-05-23

## 1. Why this RFC exists

V0.2 of the post-creation experience reshapes the publish surface in five axes
that the existing `tests/e2e/*.spec.ts` matrix does not cover:

1. **Card-as-Editor** (§3): the publish view is a full-screen feed card whose
   fields are the editing surface. There is no `preview` ↔ `edit` toggle.
2. **Auto-trigger LLM** (§4.1): `/api/ai/post-preview` fires on debounce
   (≥600ms idle), on image upload, on location pick — never on submit. No
   user-facing button. Cost is unmanaged at this stage; latency is logged.
3. **Ghost-text title** (§4.2.1): LLM-suggested title renders as inline grey
   ghost text in the title input. Typing dismisses it; clearing brings it
   back. No "accept suggestion" dialog (named anti-pattern).
4. **Body candidate slot** (§4.2.2): LLM polish goes into a `bodyCandidate`
   slot, surfaced as a `✨ 帮我润色` / `↶ 撤回润色` strip under the textarea.
   Apply replaces body; revert restores; user typing a third value silently
   invalidates.
5. **Inline ghost components** (§4.2.3) + **kind inference** (§4.3 / §6 step
   F): the model emits `suggestedComponents` (location / event_time / price /
   merchant_info / trade_condition / help_tag) and an `inferredKind`. The
   4-radio kind selector is removed; payload `kind` flows from inference and
   user-accepted ghost components, gated by verification tags.

The current 20-spec matrix has zero coverage of any of these. The single
publish-adjacent spec (`self-published-round-trip-proof.spec.ts`) only
exercises the V0.1 text-only round trip and does not touch ghost / candidate
/ inference state machines.

This RFC enumerates the gap as a 13-spec blueprint and links each row to a
GitHub issue. The actual `*.spec.ts` files are not written here — that is
follow-up work the issues track.

## 2. Source of truth

The canonical PRD file `docs/product/PRD_POST_CREATION_REVOLUTION_V0.2.md` has
not landed on `main` at the time of this RFC; the authoritative excerpts
referenced below are quoted verbatim in the merged PR bodies for steps A–E
(#825 / #826 / #841 / #847 / #860). When the PRD lands, this RFC will be
updated to reference it directly. Until then, the §3 / §4.1 / §4.2.1 /
§4.2.2 / §4.2.3 / §4.3 / §6 numbering used here matches the section
numbering that those PR bodies cite.

Implementation seam reference (already on main):

- `src/features/publish/usePublishDraft.ts` — `bodyCandidate` /
  `titleCandidate` / `suggestedComponents` provide-keys
- `src/features/publish/usePublishLlmTick.ts` — debounce + race-safe LLM
  trigger (PR #847)
- `src/features/publish/PublishCandidateBar.vue` — body apply/revert (#826)
- `src/features/publish/PublishTitleCandidateBar.vue` — title slot (#841)
- `src/features/publish/PublishSuggestedComponents.vue` — inline ghosts
  (#860)
- `src/features/feed/FeedItemCardShell.vue` — shared shell for feed and
  publish (#825)
- `src/types/publishSuggestion.ts` — `SuggestedComponentKind` 6-set;
  `InferredKind` 7-set

## 3. Existing e2e matrix (snapshot)

| spec file                                       | covers                                | publish-relevant? |
| ----------------------------------------------- | ------------------------------------- | ----------------- |
| `account-fixture.spec.ts`                       | role-fixture matrix invariants        | indirect (roles)  |
| `journey.spec.ts`                               | anon browse → detail → like/save     | no                |
| `post-detail-cold-start.spec.ts`                | feed → detail mount, deep link        | no                |
| `messages-notification-proof.spec.ts`           | inbox routing                         | no                |
| `runner-center.spec.ts`                         | runner errand list / accept           | no                |
| `errand-full-chain-proof.spec.ts`               | paid_locked → delivered               | no                |
| `errand-order.journey.spec.ts`                  | errand-order secret view              | no                |
| `event-runtime.spec.ts`                         | event_creator / org_member fixture    | no                |
| `event-runtime-proof.spec.ts`                   | event detail join                     | no                |
| `event-complete-reward-proof.spec.ts`           | /complete + /reward fan-out           | no                |
| `help-runtime-proof.spec.ts`                    | help feed + vote denial               | no                |
| `help-manage-runtime-proof.spec.ts`             | help link-event / resolve             | no                |
| `outcome-recap-kb-proof.spec.ts`                | KB recap render                       | no                |
| `merchant-center.journey.spec.ts`               | merchant center list / detail CTA     | no                |
| `trade-author-state.spec.ts`                    | available → reserved → sold           | no                |
| `admin-session-entry.spec.ts`                   | /api/admin/me                         | no                |
| `admin-verification-proof.spec.ts`              | merchant verification + moderation    | no                |
| `admin-verification-aggregate.spec.ts`          | redacted queue                        | no                |
| `self-published-round-trip-proof.spec.ts`       | **V0.1** text-only post round trip    | **partial**       |
| `detail-type-action-blocks.spec.ts`             | detail content normalizer             | no                |

V0.2 publish coverage on `main`: **0 / 13** of the slots this RFC defines.

## 4. Gap matrix

| #  | PRD section          | User story                                                                  | Existing coverage | Suggested spec name                            | Key assertions                                                                                                                                                                                                                                                                                                                  | Depends on (must merge first)               |
| -- | -------------------- | --------------------------------------------------------------------------- | ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| S1 | §3                   | Open publish view; see one full-screen card; click any field to edit; no toggle button | none              | `publish-card-as-editor.spec.ts`               | `[data-feed-card-shell]` exists at root; clicking title/body region focuses input/textarea without intermediate state; no element with text "预览模式" / "切换到编辑" / "进入编辑" or `role=button` toggling mode                                                                                                                | step F + step G                              |
| S2 | §4.1                 | Continuous typing does not fire LLM; pause >800ms fires once; image upload fires once; location pick fires once; submit does not fire | unit-only (`usePublishLlmTick.test.ts`) | `publish-llm-trigger-matrix.spec.ts`            | route-mock `/api/ai/post-preview`; assert N hits across (typing-burst=0, idle-after-typing=1, image-upload=1, location-pick=1, submit-button=0); `imageUrls`/`locationLabel` non-empty in upload/pick payloads                                                                                                                  | step F                                       |
| S3 | §4.2.1               | Empty title + LLM candidate → grey ghost rendered inside input; any keypress dismisses; clearing returns ghost; no dialog | none              | `publish-title-ghost-text.spec.ts`              | candidate-injected → ghost-element visible with PRD's grey contrast; user types → ghost gone same frame; user clears → ghost re-appears; no `role=dialog` matching `建议标题`; ghost text excluded from accessible-name (`aria-hidden` or pseudo-element) so SR users hear only user-typed value                                | step D + ghost-render follow-up              |
| S4 | §4.2.2               | LLM polish lands in slot; bar shows `✨ 帮我润色`; click applies; bar flips to `↶ 撤回润色`; revert restores; typing third value invalidates | unit-only (`publishBodyCandidate.test.ts`) | `publish-body-candidate-bar.spec.ts`            | mock route returns `bodyCandidate=X` while `body=A`; bar visible with apply label; click → textarea value=X, button label=`↶ 撤回润色`; click revert → textarea value=A, button label=`✨ 帮我润色`; user types `B` after apply → bar hidden, no revert reachable; setting candidate equal to current body → bar hidden            | step B (merged)                              |
| S5 | §4.2.3               | 6 component kinds render as ghost cards; accept/dismiss work; verification gates honored | unit-only (`publishSuggestedComponents.test.ts`) | `publish-suggested-components-actions.spec.ts`  | drive `suggestedComponents` via mocked tick; for each `kind` ∈ {`location`,`event_time`,`price`,`merchant_info`,`trade_condition`,`help_tag`}: ghost `<li[data-kind=…]>` rendered; `accept(event_time)` → publishKind=`event`; `accept(merchant_info)` with merchant role → publishKind=`merchant`, with registered role → no-op; `accept(trade_condition)` campus-gated; `accept(help_tag)` only if `tagInput` empty; `accept(location)` does not flip kind; dismiss removes from list; aria-label on accept button reads `建议添加 <reason>` | step E-main (merged) + accounts fixture (3 roles) |
| S6 | §4.3 + §6 step F     | Submit payload `kind` flows from `inferredKind` + user-accept; no 4-radio | none              | `publish-kind-inference-payload.spec.ts`        | record outbound `POST /api/posts` body; (a) no accepts + `inferredKind="event"` → payload.kind=`event`; (b) accept event_time over inferredKind=`text` → kind=`event`; (c) inferredKind=null + no accepts + no images → kind=`text`; (d) image-only → kind=`image`; (e) merchant-gated accept by registered → payload.kind unchanged | step F (in-flight)                           |
| S7 | §6 step F            | DOM no longer contains the 4-radio kind selector                            | none              | `publish-no-kind-radio.spec.ts`                 | `page.locator('input[type=radio][name="publishKind"]')` count = 0; brand-string emit no longer ships `PUBLISH_KIND_IMAGE/_TEXT/_EVENT/_HELP`; `journey.spec.ts` regression: anonymous browse + detail still passes                                                                                                              | step F                                       |
| S8 | §4.1                 | Stale LLM response is dropped; LLM error is silent (no toast, refs intact)  | unit-only         | `publish-llm-stale-and-failure.spec.ts`         | mock 1: `/api/ai/post-preview` 2s delay; user keeps typing; response arrives → no `bodyCandidate` slot mutation, no ghost ever appears; mock 2: 500 response; no toast/alert in DOM, manual submit still succeeds                                                                                                                | step E-pre (merged)                          |
| S9 | §4.1                 | Each tick logs latency + model name; failure logs `status=error`            | none              | `publish-llm-telemetry.spec.ts`                 | install `window.__lianTelemetry` capture in `beforeEach`; assert one `publish_llm_tick` event per tick with `{modelLatencyMs: number, modelName: string, status: "ok"}`; force 500 → `status: "error"` event                                                                                                                    | step F                                       |
| S10 | §6 step G           | Publish view shares `FeedItemCardShell` with feed                           | unit-only (`feed-item-card-shell.structure.test.mjs`) | `publish-shell-shares-feed-card.spec.ts`        | publish view DOM contains `[data-feed-card-shell]` with same border/radius/padding tokens as a feed-list item (computed-style assert against `--radius-card` / `border-color`)                                                                                                                                                  | step G                                       |
| S11 | §4.2.x a11y         | `prefers-reduced-motion: reduce` disables ghost / bar transitions           | unit-only         | `publish-ghost-reduced-motion.spec.ts`          | `context.emulateMedia({ reducedMotion: 'reduce' })`; ghost element computed `transition-duration` = `0s`; same for `PublishCandidateBar`                                                                                                                                                                                        | step E-main                                  |
| S12 | §4.3                | `/api/ai/post-preview` response shape contract is locked                    | none              | `publish-llm-contract-shape.spec.ts`            | hit live endpoint (or stable seeded mock) with minimal grounded payload; assert `candidates` block exists with `title: string\|null`, `bodyCandidate: string\|null`, `suggestedComponents: array<{kind ∈ 6-set, payload: object, label: string}>`, `inferredKind ∈ 7-set ∪ null`, `modelLatencyMs: number`, `modelName: string`; degraded path also returns `candidates` with defensive nulls (no 500) | step C (ps#534, merged)                      |
| S13 | §6 step F (matrix)  | Verification × inferred-kind acceptance behaves per role                    | none              | `publish-kind-inference-role-matrix.spec.ts`    | role × kind matrix: `merchant` ✓ accept(merchant_info); `registered` ✗; `campus` ✓ accept(trade_condition); `registered` ✗; `event_creator` + `registered` both ✓ accept(event_time); `runner` ✓ accept(help_tag) when tagInput empty                                                                                            | step F + accounts fixture                    |

## 5. Out of scope (not blueprinted here)

- **Backend** `/api/ai/post-preview` happy-path / degraded-path is locked by
  ps#534 and its server tests; we only re-assert the response shape from the
  client side (S12).
- **NodeBB-native** like / save / flag flows are owned by the existing
  `journey.spec.ts` / `help-manage-runtime-proof.spec.ts` matrix; the
  publish-side specs do not re-test them.
- **Map** marker layer / location chip rendering is out of scope; S2 / S5
  only assert that location-pick triggers an LLM tick and that
  `accept(location)` does not mutate kind.
- **i18n** locale-switch coverage stays with the existing `resolveAppLocale`
  unit suite; brand-string plumbing is asserted at unit level only.

## 6. Splitting principles

1. **One spec, one PRD section.** Each spec file lines up with one
   `§4.x` / `§6.x` clause so a future PRD revision invalidates one file at
   most. The only "matrix" spec (S13) is justified because the role × kind
   product is what `step F` itself ratifies.
2. **State-machine specs use mocked tick + injected state; contract specs
   hit live.** S4 / S5 / S8 mock `/api/ai/post-preview` and drive the slot
   directly; S12 hits the real endpoint to lock the response shape so that
   ps#534 cannot drift silently. This split protects the state-machine
   specs from upstream LLM flakiness.
3. **No spec opens before its dependency PR merges.** The `Depends on`
   column is the gate. Specs whose dependency is in-flight (`step F`,
   `step G`) are issue-tracked but the issue body must say "blocked on
   <PR>".
4. **Existing fixtures preferred.** Specs needing role context use
   `tests/e2e/fixtures/accounts.ts::loginAs(role)`. No spec spins its own
   user creation. If a role is missing creds the test must `test.skip` via
   the existing `skipIfRoleMissing` helper (see `account-fixture.spec.ts`),
   so CI on missing seeds is yellow not red.
5. **No emoji in DOM assertions.** PRD-quoted labels (`✨ 帮我润色` /
   `↶ 撤回润色`) live in `src/config/brand/publish.ts`; specs assert via
   the brand constant import, not the literal glyph, so a copy change does
   not require touching the spec.
6. **No spec touches `src/features/feed/PublishView.vue` or step F
   in-flight code.** Specs are read-only consumers.

## 7. Scheduling suggestion

Wave 1 (can land today, all dependencies merged):

- S4 `publish-body-candidate-bar.spec.ts` — depends on step B
- S5 `publish-suggested-components-actions.spec.ts` — depends on step E-main
- S8 `publish-llm-stale-and-failure.spec.ts` — depends on step E-pre
- S11 `publish-ghost-reduced-motion.spec.ts` — depends on step E-main
- S12 `publish-llm-contract-shape.spec.ts` — depends on step C (ps#534)

Wave 2 (after step F merges):

- S2 `publish-llm-trigger-matrix.spec.ts`
- S6 `publish-kind-inference-payload.spec.ts`
- S7 `publish-no-kind-radio.spec.ts`
- S9 `publish-llm-telemetry.spec.ts`
- S13 `publish-kind-inference-role-matrix.spec.ts`

Wave 3 (after step G + ghost-text title rendering follow-up):

- S1 `publish-card-as-editor.spec.ts`
- S3 `publish-title-ghost-text.spec.ts`
- S10 `publish-shell-shares-feed-card.spec.ts`

## 8. Rollout & ownership

- Each row above gets one tracking issue in `taoyu051818-sys/lian-mobile-web`
  with title `e2e: <spec-name> — V0.2 <feature> coverage`. Issue body
  carries: scenario, setup (mock vs live, role required), assertion list,
  dependency PR, deferral reason if blocked.
- Spec implementation lands as one PR per spec, on a `test/e2e-<slug>`
  branch, gated on the existing `E2E PR Gate` workflow (cold-start safe per
  `[[project-e2e-wave-a-2026-05-22]]`).
- This RFC is owned by the publish-experience lane; revisions land as new
  PRs editing this file (no in-place rewrite).

## 9. Open questions

1. **Ghost-text DOM strategy** (S3): the current `PublishComposer.vue`
   doesn't yet render the title ghost (only the slot is wired). Whether
   ghost is implemented as a `::placeholder`-style overlay, a sibling
   `<span>` with `aria-hidden`, or a CSS `::before` pseudo-element changes
   what the spec asserts. Resolve before opening S3's PR.
2. **Telemetry sink** (S9): no `window.__lianTelemetry` exists yet on `main`.
   Either step F lands the sink and S9 follows, or S9 ships first with a
   `test.fixme` placeholder. PRD §4.1 mandates "记录每次 LLM 调用的响应
   时间到 telemetry" but is silent on the sink shape.
3. **`accept(price)` fallback semantics** (S5): the merged code has
   `merchant 优先, fallback trade, no-op otherwise`. PRD §4.2.3 phrasing is
   ambiguous on whether non-merchant non-campus users should see a `price`
   ghost at all. S5 currently asserts the implemented behaviour; if PRD
   clarifies, S5 updates accordingly.

## 10. Blueprinted issues

| RFC row | Spec name                                       | Issue                                                                 |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| S1      | `publish-card-as-editor.spec.ts`                | [#870](https://github.com/taoyu051818-sys/lian-mobile-web/issues/870) |
| S2      | `publish-llm-trigger-matrix.spec.ts`            | [#871](https://github.com/taoyu051818-sys/lian-mobile-web/issues/871) |
| S3      | `publish-title-ghost-text.spec.ts`              | [#872](https://github.com/taoyu051818-sys/lian-mobile-web/issues/872) |
| S4      | `publish-body-candidate-bar.spec.ts`            | [#873](https://github.com/taoyu051818-sys/lian-mobile-web/issues/873) |
| S5      | `publish-suggested-components-actions.spec.ts`  | [#874](https://github.com/taoyu051818-sys/lian-mobile-web/issues/874) |
| S6      | `publish-kind-inference-payload.spec.ts`        | [#875](https://github.com/taoyu051818-sys/lian-mobile-web/issues/875) |
| S7      | `publish-no-kind-radio.spec.ts`                 | [#876](https://github.com/taoyu051818-sys/lian-mobile-web/issues/876) |
| S8      | `publish-llm-stale-and-failure.spec.ts`         | [#877](https://github.com/taoyu051818-sys/lian-mobile-web/issues/877) |
| S9      | `publish-llm-telemetry.spec.ts`                 | [#878](https://github.com/taoyu051818-sys/lian-mobile-web/issues/878) |
| S10     | `publish-shell-shares-feed-card.spec.ts`        | [#879](https://github.com/taoyu051818-sys/lian-mobile-web/issues/879) |
| S11     | `publish-ghost-reduced-motion.spec.ts`          | [#880](https://github.com/taoyu051818-sys/lian-mobile-web/issues/880) |
| S12     | `publish-llm-contract-shape.spec.ts`            | [#881](https://github.com/taoyu051818-sys/lian-mobile-web/issues/881) |
| S13     | `publish-kind-inference-role-matrix.spec.ts`    | [#882](https://github.com/taoyu051818-sys/lian-mobile-web/issues/882) |

Each issue links back to the row above by `S<n>` in its body and carries the
appropriate `frontend` / `QA` / `documentation` labels (plus
`api-contract`, `auth`, or `motion` where relevant).
