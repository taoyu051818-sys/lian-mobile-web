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

- [ ] Clear design/task record exists for the issue.
- [ ] Design tokens cover content surfaces, floating surfaces, borders, shadows, radius, and motion durations.
- [ ] At least one core page has a visible pilot: Vue canary Feed.
- [ ] Hover, active, loading, empty, selected/detail, and current navigation states are covered.
- [ ] Mobile and desktop layouts are reviewed.
- [ ] No Apple source, brand assets, copyrighted UI assets, or private implementation details are copied.
- [ ] Current frontend validation commands pass or failures are recorded with cause.
