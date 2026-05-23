# Frontend Development Conventions

> Source of truth for how new code should be written in `lian-mobile-web`.
> When this document conflicts with current `main`, fix the doc — code on `main` wins.

This file is the operational rulebook for everyday work. It complements:

- `docs/architecture/frontend-project-structure.md` — folder layering and the structure-validation script.
- `docs/frontend/shell-content-architecture.md` — shell vs page content ownership.
- `docs/architecture/current-file-ownership.md` — file-by-file ownership map.

If a rule below is hard to obey for a real task, change the rule with the user's sign-off; do not work around it silently.

## 1. Layer Boundaries

The runtime is organized as six layers under `src/`. Imports flow downward only.

```
shell        — global app chrome / overlays / layout frame
features/<x> — feature surfaces, page-local composables and presentation
ui           — cross-feature primitives, feedback, layout helpers
composables  — cross-feature glue that uses Vue reactivity but is not a UI primitive
api          — HTTP clients (one module per backend domain)
domain       — pure business rules (no Vue, no fetch, no DOM)
platform     — browser, storage, third-party adapters (no business rules)
```

Hard rules, enforced by `npm run check` (`scripts/validate-project-structure.js`):

- `src/ui/**` must not import from `src/features/**`.
- `src/domain/**` must not import Vue, fetch, DOM, or feature code.
- `src/platform/**` must not import feature/page components.
- `src/features/<a>/**` must not import from `src/features/<b>/**` directly. Cross-feature glue goes through `src/api`, `src/ui`, `src/domain`, `src/composables`, or a feature's public `index.ts`.
- `src/views/` is forbidden (the directory was deleted in #487; pages live under `src/features/<feature>/`).

If you need to break a boundary "just for this case," stop and write a handoff. The boundary is what kept the past three Teleport / mount-order regressions from spreading.

## 2. App-Level Surfaces vs Page-Level Surfaces

Three things live at the App level (mounted in `src/App.vue`):

- `AppShell` — the persistent shell that owns top/bottom chrome and the content frame.
- `DetailSurface` — the post-detail overlay (issue #636). Mounted exactly once via `<Teleport to="body">`.
- `ToastHost` — global feedback host.

Pages **must not**:

- Mount their own copy of `PostDetailPanel`. Use `useDetailNavigation().open(tid, "card")` and let `DetailSurface` render the panel.
- Render their own teleport target with id `lian-shell-top-slot` or `lian-shell-bottom-slot`. Those ids are owned by `ShellChrome`.
- Read `window.location.hash` directly. Use `src/app/view-hash.ts` (view-hash singleton + `pushViewHash`) and `src/app/detail-navigation/url-sync.ts` (post-detail tid). The post-detail-hash writer in `src/app/post-detail-hash.ts` is the only other module that touches `window.history` for the post hash, and it is invoked exclusively from the detail FSM's side-effect handlers.

A page **may**:

- Describe shell chrome intent through a `PageChromeSpec` and emit it on the `chrome` event so `AppShell` can apply it.
- Open a detail by calling `detail.open(tid, "card")`.
- Own its own page-local overlays (gallery, lightbox, place sheet) when those overlays are content, not app chrome.

## 3. ShellChrome Resident Slot Contract

`#lian-shell-top-slot` and `#lian-shell-bottom-slot` are always-resident DOM nodes inside `ShellChrome.vue`. They exist before any teleport from `PostDetailPanel` mounts.

Rules:

- The render condition for the slot DOM is region only (`region === "top"` / `region === "bottom"`). It must not depend on `shellVisible`, on the floating-chrome phase, on `detailOpen`, or on any transition state.
- `applyPageChrome` must not write `slot`. The detail-navigation FSM owns the top slot (toggling `detail-topbar` while the App-level overlay is open) through `setSlot` (`src/shell/useShellChrome.ts`). The FSM does NOT touch the bottom slot — the BottomTabBar must stay mounted under the App-level `DetailSurface` (cold-start contract, #636), and the reply dock teleports into a surface-owned host (`#lian-detail-surface-dock-slot`) rather than the shell bottom slot.
- `ensureBottomSlot("tabs")` is the only place that installs the bottom-tabs default, and only when the slot is empty.

These rules are guarded by `tests/shell/detail-surface.contract.test.mjs` and `tests/shell/shell-chrome.test.ts`. Don't relax them without first deleting the issue #636 reference in the test names — that is the deliberate trip wire.

## 4. State Boundaries

Use this hierarchy when deciding where state lives:

| Concern                                                                                             | Owner                                                          |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Which app view is active (`feed`, `map`, `publish`, `messages`, `profile`, `admin`, `verification`) | `src/app/useActiveView.ts` (URL hash is the source of truth)   |
| Which post-detail tid is open (or `null`)                                                           | `src/app/detail-navigation/store.ts` reducer + store           |
| Shell chrome region intent (tabs, buttons, identity, slot)                                          | `src/shell/useShellChrome.ts`                                  |
| Floating chrome phase (`idle` / `open` / `dragging` / `returning`)                                  | `src/shell/floatingChromeState.ts` (driven by `DetailSurface`) |
| Page-local form state, list state, composer state                                                   | The owning feature directory (`src/features/<x>/use*.ts`)      |

Active view and detail are **independent**. Opening or closing a detail must not move the active view; switching tabs while a detail is open is a user-initiated close (`detail.close("tab-switch")`).

## 5. URL Hash Contract

Two namespaces:

- `#/feed`, `#/map`, `#/publish`, `#/messages`, `#/profile` (and the secret `#/admin`, `#/verification`) — view tabs.
- `#/post/{tid}` — post detail. Top-level overlay, not a tab.

Producers and consumers must use `src/app/deepLink.ts` (`buildPostDetailHash`, `buildViewHash`, `parseDeepLink`). Direct `window.location.hash` reads are limited to `src/app/view-hash.ts` and `src/app/detail-navigation/url-sync.ts`; direct `window.history` writes are limited to those two modules plus `src/app/post-detail-hash.ts`. New consumers go through those modules.

Both `hashchange` and `popstate` are listened for — never just one. The reducer's `url-sync` action is idempotent; do not add defensive "already on this tid" early returns in callers.

## 6. File Size Guidance

`scripts/warn-large-vue-files.js` warns at 300 lines. The warning is intentional — it surfaces files that should be reviewed for decomposition, not blocked.

Decomposition heuristics:

- A `.vue` file over 300 lines is a candidate, but not automatically a problem. Orchestrator views (e.g. `ProfileView.vue`, `PublishView.vue`) earn their length by composing many feature blocks; leaf components should usually stay under 240 lines.
- Pull into a child component when: a section has its own visual boundary, takes 5+ props, or is reused.
- Pull into a composable when: a `.vue` file owns 4+ refs/computeds for one independent concern (gallery, report flow, reply composer).
- Don't pull into a child component when: the only effect is to convert local state into prop drilling.
- Pure styling files do not count toward the 300 line budget — extract a sibling `.css` file with the same name when scoped CSS dominates the line count.

Tracking: the four current warnings (`PublishView.vue`, `VerificationView.vue`, `PostDetailPanel.vue`, `FeedItemCard.vue`) have a follow-up plan in the `#636` PR description and should be tackled in dedicated split PRs, not bundled into feature work.

## 7. Components

- One component per file. SFC name = file name (e.g. `FeedItemCard.vue` → `FeedItemCard`).
- Use `<script setup lang="ts">`. No Options API in new code.
- Props and emits are typed. Use `defineProps<...>()` / `defineEmits<...>()` generic forms.
- Brand strings (labels, copy) live in `src/config/brand/*` and are imported by name. Inline literals are reserved for content that is genuinely component-local (debug labels, single-use ARIA labels that the brand catalog does not yet cover).
- i18n: every user-visible string must round-trip through the locale catalogs in `src/locales/`. Don't hardcode Chinese in templates.

## 8. Composables

- One responsibility per composable. If a composable is named `useFooBar` and exports two unrelated cluster of refs, split it.
- Composables that return refs the parent should also write to must use `Ref<T>` in the return type, not `T`. Be explicit about read vs write contracts.
- Module-level singletons (like `detail-navigation/store.ts`, `view-hash.ts`) are deliberate — when there can only be one instance of the underlying state in the browser (URL hash, single open detail), the singleton is the right shape. Don't try to "scope" them to a component lifecycle.
- Guard SSR/test paths with `if (typeof window === "undefined")` for any code that touches `window`, `document`, or `history`.

## 9. Styling

- Scoped styles (`<style scoped>`) by default.
- Tokens: use design tokens from `src/styles/lian-tokens.css` (`--space-3`, `--lian-primary`, `--radius-card`, `--floating-bar-height`). Don't introduce new magic colors / spacings without a token entry.
- Safe-area: any fixed-position chrome must include `env(safe-area-inset-*)` (top, right, bottom, left) — `tests/shell/safe-area-spacing.structure.test.mjs` is the regression net.
- Reduced motion: keep state-machine semantics intact; only skip the animation. The shell chrome lifecycle is the canonical example.

## 10. Testing

Three test layers:

| Layer                       | Location                                                                | Use when                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unit / reducer / pure logic | `tests/**/*.test.ts` (vitest)                                           | Reducers, normalizers, validators, hash builders                                                                   |
| Structure / contract        | `tests/**/*.contract.test.{ts,mjs}` and `tests/**/*.structure.test.mjs` | Patterns that must hold but cannot be checked at runtime — slot DOM presence, FSM independence, brand string usage |
| Smoke / E2E                 | `tests/e2e/**` (Playwright) and `npm run verify:smoke`                  | Cold-start journeys, real backend integration                                                                      |

Rules:

- New `.test.ts` files use `vitest` (`describe`/`it`/`expect`). The legacy `node:test` style is deprecated for new tests (#499). Existing `.test.mjs` files using `node:test` are fine — match the surrounding file when extending one.
- Contract tests are reserved for behavior the unit runtime cannot reproduce. The `#636` family is the exemplar: jsdom can't surface a Vue Teleport target race, so we lock the source-level shape (`tests/shell/detail-surface.contract.test.mjs`).
- E2E specs target `nat100` / a real backend; do not stub the detail or feed APIs in E2E.
- A bug fix without a regression test is unfinished. Add one.

## 11. Verification

Before opening a PR:

```bash
npm run verify
```

This runs:

1. `verify:static` — structure / encoding / unsafe-DOM / asset-owners / stale-doc / large-vue / ownership-doc / format / lint.
2. `test:unit` — vitest.
3. `verify:smoke` — builds, starts preview, runs the smoke suite against it.

If you want to read the auto-generated file ownership snapshot, run `npm run ownership-doc` locally; the file at `docs/architecture/auto/file-ownership.md` is gitignored and regenerated on demand. `npm run check` regenerates it and then re-runs the generator in check mode, so CI catches generator nondeterminism without that artifact ever entering a PR diff.

If you cannot run `verify:smoke` locally (no Node 22, no preview port available), say so explicitly in the PR description — CI will catch it, but the absence should be visible.

## 12. PR Hygiene

- Branch naming: `cc/<short-issue-or-topic>`, e.g. `cc/636-detail-surface-lift`.
- One concern per PR. Architecture-shaped PRs (ownership boundary moves, layer changes) do not bundle unrelated file splits — diff review is what makes those changes safe, and review collapses when the diff is mixed.
- PR title under 70 chars. The body carries detail.
- Required body sections:
  - **Summary** — what changed and why, in 3-6 bullets.
  - **Architecture** — boundary changes (new App-level surface? slot contract change? state ownership move?).
  - **Test plan** — exact commands run, plus a checklist of what was visually verified.
  - **Risk / rollback** — where the diff lands at runtime, what reverts cleanly.
- Cross-link the issue (`Closes #N` only if the PR really closes it; otherwise `Refs #N`).

## 13. Worktree Workflow

Use git worktrees under `lian-mobile-web.worktrees/` for any non-trivial change so `main` stays clean:

```
git worktree add -b cc/<topic> ../lian-mobile-web.worktrees/cc-<topic> origin/main
```

`node_modules` is not vendored across worktrees; copy from the main checkout (`cp -r ../../lian-mobile-web/node_modules .`) or run `npm install` in the worktree before invoking verify scripts. Never commit `node_modules` from the worktree.

Clean up: when a PR merges, drop the worktree (`git worktree remove ...`) and the local branch.

## 14. Failure-Loop Protocol

If a fix attempt fails twice in a row:

1. Stop patching incrementally.
2. Diagnose the root cause — where the assumption broke, not just which line errored.
3. Either pick a fundamentally different approach or write a handoff describing the impasse.

The recent detail-page incidents (#633 / #634 / #635) are a worked example: three serial patches each fixed a symptom of the same architecture debt (`#636`). Notice the pattern early next time and escalate to a structural change instead of a fourth patch.

## 15. What This Document Does Not Cover

- Backend API contracts. Those belong with the backend repo (`taoyu051818-sys/lian-platform-server`) and should be referenced by issue / PR number rather than duplicated here.
- Specific PRD product decisions. PRD V0.1 lives in `docs/product/` and is the source of truth for _what_ a feature does; this document is about _how_ code is organized.
- Coordination conventions (issue labels, agent thread split). Those live in `docs/agent/00_AGENT_RULES.md`.
