# Motion integration lane operational guide

Issue: #86
Scope: operational expectations for merging motion work into production

> **Note:** The legacy static runtime was removed in PR #282. References to port 4300 and dual-lane testing are historical. Motion work now targets only the Vue/Vite runtime.

## Purpose

This document defines the operational contract for motion integration — how motion PRs move from feature branches through validation to production merge. It complements the governance rules in `docs/frontend/motion-workflow-governance.md` and the parallel development rules in `docs/development/motion-parallel-development.md`.

## Pre-integration state

Before starting a motion integration batch:

1. Confirm `main` is green: `npm run verify` passes.
2. Confirm no in-flight PRs touch motion-adjacent files (chrome, overlay, gesture).
3. Confirm the motion design doc (`docs/design/card-camera-transition.md`) reflects the current intended behavior.

## Integration batch procedure

### Step 1: Foundation merge

Merge contract and guard PRs first:

- `data-motion-role` attribute changes
- Overlay DOM structure changes
- Reduced-motion guard additions

Validation: `npm run verify` passes. No behavioral change visible (these are additive/structural).

### Step 2: Core motion merge

Merge phase PRs in this order:

1. Enter transition
2. Exit transition
3. Element morph

Each PR must independently pass `npm run verify`. After each merge, manually test the card-to-detail transition on both lanes (4300, 4301).

### Step 3: Coordination merge

Merge coordination PRs:

1. Chrome swap (top + bottom)
2. Bottom chrome progress sync
3. Gesture integration (tap/long-press discrimination)

Each PR must independently pass `npm run verify`. After each merge, manually test:
- Card-to-detail enter transition (chrome swaps correctly)
- Card-to-detail exit transition (chrome returns correctly)
- Long-press vs tap (no false triggers)

### Step 4: Polish merge

Merge polish PRs:

1. Timer cleanup
2. Accessibility audit (`prefers-reduced-motion`)
3. Performance validation

Final validation: full `npm run verify` plus manual regression test of all motion paths.

## Rollback plan

If a motion integration causes a regression:

1. **Immediate**: Revert the last merged motion PR. Run `npm run verify` to confirm the revert restores green state.
2. **Investigation**: Use `git log --oneline` to identify the specific commit range. Test individual commits if needed.
3. **Fix**: Open a new PR with the fix. Do not force-push or amend the reverted commit.
4. **Re-integration**: Re-run the integration batch from the step that failed.

## CI contract

The `Frontend Validation` workflow (`frontend.yml`) runs `npm run verify` on every PR. Motion PRs must pass this workflow before merge.

Additional CI expectations:

- No new CI steps are required for motion work.
- Motion PRs do not require changes to `scripts/`, `package.json`, or CI configuration.
- If a motion PR requires a new validation script, it must be added in a separate PR that follows the ops guard rules.

## Port contract

| Lane | Port | Motion surface |
|---|---|---|
| Legacy/static rehearsal | 4300 | Card-to-detail overlay, chrome swap, reduced-motion |
| Vue canary | 4301 | Same motion surface via Vue components |

Motion changes must work on both ports. A motion PR that only targets one port must document which port and why.

## Operational rules

1. Motion PRs must not modify `scripts/`, `package.json`, or CI files unless the PR's sole purpose is motion validation tooling.
2. Motion PRs must not modify backend-owned files (`src/server/*`, `data/*`).
3. Motion PRs must not add new runtime dependencies.
4. Motion PRs must not change the port contract (4300, 4301).
5. Every motion PR must include a manual test description in its PR body.

## References

- `docs/ops/frontend-verification-runtime.md` - verification gate contract
- `docs/ops/runtime-inventory.md` - runtime inventory
- `docs/ops/vue-canary-runtime.md` - Vue canary lane contract
- `docs/frontend/motion-workflow-governance.md` - governance rules
- `docs/development/motion-parallel-development.md` - parallel development rules
