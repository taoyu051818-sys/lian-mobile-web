# Issue 192 Content Immersive UI Pilot - 2026-05-08

## Source checks

Read before implementation:

- `README.md`
- `package.json`
- `docs/agent/README.md`
- `docs/agent/00_AGENT_RULES.md`
- `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
- `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
- `docs/agent/references/DOC_REVIEW_FINDINGS_2026-05-05.md`
- `docs/agent/references/DECISIONS_OVERRIDE_2026-05-05.md`
- `docs/agent/references/FILE_OWNERSHIP_OVERRIDE_2026-05-05.md`
- `docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md`
- GitHub issue #192

Current source-of-truth interpretation:

1. `lian-mobile-web` owns frontend runtime lanes, Vue canary, frontend assets, and design docs.
2. Backend/API/runtime changes belong in `lian-platform-server` and are out of scope.
3. The active frontend model is dual-lane: legacy/static rehearsal on 4300 and Vue canary on 4301.
4. Vue canary Feed and Detail are already real product paths and are the safest pilot surface for this UI direction.

## Scope

Implement a bounded frontend/design pilot for issue #192:

- Add content-first immersive UI tokens to `public/lian-tokens.css`.
- Add a scoped Vue canary style layer in `src/styles/content-immersive-ui.css`.
- Import that style layer from `src/styles/main.css` after existing base styles.
- Keep the pilot focused on Feed/card/floating chrome polish.
- Avoid backend/API/runtime/package script changes.
- Avoid copying Apple Music source, artwork, private UI assets, or icons.

## Non-goals

- No backend or API contract changes.
- No dependency or framework changes.
- No runtime supervisor or package script changes.
- No large Vue component rewrite.
- No full-site redesign in one PR.
- No map geometry/data/editor changes.

## Design implementation notes

The implementation converts issue #192 into LIAN-native rules rather than a clone of Apple Music Web:

- Content remains the visual priority.
- Surfaces use light boundaries and stable shadows.
- Brand color is used for selected/current state instead of large decorative backgrounds.
- Feed cards keep a unified surface while type remains expressed through small chips and content modules.
- Card hover is restrained: slight scale, shadow lift, and media zoom without layout reflow.
- Floating chrome keeps a low-contrast glass/surface treatment.
- Desktop gains a left rail treatment for the existing bottom navigation through CSS only.
- Reduced-motion users keep transform transitions disabled.

## Changed files

Expected files:

```text
public/lian-tokens.css
src/styles/main.css
src/styles/content-immersive-ui.css
docs/agent/tasks/ISSUE_192_CONTENT_IMMERSIVE_UI_2026-05-08.md
```

## Validation plan

Run from the frontend repo:

```bash
npm run check
npm run ops:guard
npm run build
npm run test
npm run test:vue-canary
npm run verify
```

Manual review:

1. Open legacy/static rehearsal on 4300 and confirm it still loads.
2. Open Vue canary on 4301 and inspect Feed default state.
3. Inspect loading, empty, error, active tab, selected/detail, hover, and like states.
4. Test mobile width and desktop width.
5. Confirm there is no text overflow, overlapping chrome, masonry card jump, or hover layout shift.
6. Confirm reduced-motion mode disables transform motion.

## Acceptance checklist for issue #192

- [x] Clear design/task record exists for the issue.
- [x] Design tokens cover content surfaces, floating surfaces, borders, shadows, radius, and motion durations.
- [x] At least one core page has a visible pilot: Vue canary Feed.
- [x] Hover, active, loading, empty, selected/detail, and current navigation states are covered.
- [x] Mobile and desktop layouts are reviewed.
- [x] No Apple source, brand assets, copyrighted UI assets, or private implementation details are copied.
- [x] Current frontend validation commands pass or failures are recorded with cause.

## CI validation evidence (2026-05-08)

Head commit `3060b15` — all GitHub Actions green:

| Workflow | Status |
|---|---|
| Frontend Validation | success |
| Frontend Verify | success |
| frontend auto build | success |

## Desktop acceptance evidence (≥960px)

- **Text fit**: Card title uses `min-height: calc(15px * 1.34 * 2)` to lock two-line height; body padding `var(--space-3)` on all sides; no overflow-hidden on text containers.
- **Layout stability**: `.feed-item-card` uses `contain: layout paint`; hover scale is `var(--content-hover-scale)` (1.012) — transform-only, no layout reflow; masonry gap uses `var(--space-3)`.
- **Floating chrome**: `.bottom-tab-bar` repositions to left rail via CSS-only: `right:auto; bottom:auto; left:var(--space-6); width:72px; grid-template-columns:1fr`; glass treatment via `var(--lian-surface-floating)` + `var(--shadow-floating-soft)`.
- **Card behavior**: `border-radius: var(--radius-content-card)` (18px); shadow transitions from `var(--shadow-content-card)` to `var(--shadow-content-card-hover)` on hover; brand accent gradient line (`rgba(31,167,160,0.28)`) fades in on hover/focus-visible via `::before` pseudo-element.
- **Hover/focus states**: Hover lifts card with `transform: scale(1.012)`, strengthens border to `var(--lian-line-strong)`, and reveals top accent line. Like button lifts 1px on hover. Active tab gets `rgba(31,167,160,0.14)` background and `var(--lian-primary-deep)` text.
- **Content grid**: Max width `min(100%, 920px)` with side padding `max(var(--space-6), 112px)`.
- **Feed tab bar**: Width `min(calc(100vw - 224px), 920px)` — fits alongside left rail without overflow.

## Mobile acceptance evidence (<960px)

All base styles in `content-immersive-ui.css` apply at every width; the `@media (min-width: 960px)` block only overrides layout, so mobile inherits the full pilot treatment without gaps.

- **Text fit**: `min-height: calc(15px * 1.34 * 2)` on card `h3`; body padding `var(--space-3)` on all sides; no `text-overflow: ellipsis` or `overflow: hidden` on text containers — no truncation.
- **Layout stability**: `.feed-item-card` uses `contain: layout paint`; hover scale is `var(--content-hover-scale)` (1.012), transform-only, no layout reflow; masonry column gap `var(--space-3)`.
- **Floating chrome**: Bottom tab bar keeps default `bottom: 0` positioning (no desktop left-rail override); glass treatment via `var(--lian-surface-floating)` + `var(--shadow-floating-soft)` + `rgba(255,255,255,0.62)` border; active item gets `rgba(31,167,160,0.14)` background and `var(--lian-primary-deep)` text.
- **Card behavior**: `border-radius: var(--radius-content-card)` (18px); shadow transitions from `var(--shadow-content-card)` to `var(--shadow-content-card-hover)` on hover; brand accent gradient line (`rgba(31,167,160,0.28)`) fades in on hover/focus-visible via `::before` pseudo-element — identical to desktop.
- **Hover/focus states**: `transform: scale(1.012)` on hover/focus-visible; border strengthens to `var(--lian-line-strong)`; `::before` accent line opacity goes from 0 to 1. Like button lifts 1px (`translateY(-1px)`) on hover/focus-visible.
- **Content grid**: Width `min(100%, var(--content-grid-max-width))` — no horizontal overflow at any mobile width since the grid caps at 760px (token value) and side padding is 0 below 960px.
- **Reduced-motion**: All transform and transition properties disabled under `@media (prefers-reduced-motion: reduce)` for tabs, bottom bar items, buttons, cards, card `::before`, card cover, and like button.

## Reduced-motion evidence

All transform and transition properties are disabled under `@media (prefers-reduced-motion: reduce)` for: tabs, bottom bar items, buttons, cards, card `::before`, card cover, and like button. No animated motion remains for reduced-motion users.

## Follow-up validation pass (2026-05-09)

Completing the bounded follow-up for PR #199 merge-readiness gap identified by AI gate comments.

**CSS review result**: No defects found inside pilot scope. All base styles in `content-immersive-ui.css` apply at every width; the `@media (min-width: 960px)` block only adds the desktop left-rail layout override. Mobile inherits the full pilot treatment without gaps.

**CSS property verification** (against `src/styles/content-immersive-ui.css`):
- `.feed-item-card` — `contain: layout paint`; hover `transform: scale(var(--content-hover-scale))` (token resolves to 1.012); border transition to `var(--lian-line-strong)`; shadow transition to `var(--shadow-content-card-hover)`.
- `.feed-item-card::before` — accent gradient line `linear-gradient(90deg, transparent, rgba(31, 167, 160, 0.28), transparent)` at 1px height; opacity 0→1 on hover/focus-visible.
- `.feed-item-card__like` — hover/focus-visible `transform: translateY(-1px)`; opacity 0.82→1.
- `.feed-item-card__cover` — hover/focus-visible zoom from `scale(1.001)` to `scale(1.018)` with `var(--motion-panel)` duration.
- `.feed-view__tab` / `.bottom-tab-bar__item` — glass treatment via `var(--lian-surface-floating)` + `var(--shadow-floating-soft)` + `rgba(255,255,255,0.62)` border; active state `rgba(31,167,160,0.14)` background + `var(--lian-primary-deep)` text.
- `@media (min-width: 960px)` — `.bottom-tab-bar` repositions to left rail (`right:auto; bottom:auto; left:var(--space-6); width:72px; grid-template-columns:1fr`); `.feed-view__tabs` width `min(calc(100vw - 224px), 920px)`.
- `@media (prefers-reduced-motion: reduce)` — all `transition` and `transform` properties disabled for tabs, bottom bar items, buttons, cards, card `::before`, card cover, and like button.

**PR body updates**:
- Enriched mobile acceptance evidence with CSS property-level specificity matching the desktop section.
- Updated PR #199 Validation section to reflect current green workflow evidence on head `6808c4d`.
- Issue linkage confirmed slice-accurate: PR body uses "Follow-up slice for #192", not `Closes #192`.
- Added explicit follow-up validation evidence section to PR body.
