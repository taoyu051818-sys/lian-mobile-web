# Motion workflow governance

Issue: #86
Scope: production motion parallelization rules for the card-camera transition system (refs: #66, #84, #163)

## One-thread-one-PR rule

Every motion PR must correspond to exactly one implementation thread. A thread is a bounded unit of work scoped to a single concern within the motion system.

| Rule | Rationale |
|---|---|
| One PR per thread. Do not bundle unrelated motion changes into a single PR. | Keeps review focused and rollback safe. Motion regressions are hard to isolate when changes are batched. |
| One thread per PR. Do not split a single motion concern across multiple PRs unless the split is a documented dependency chain. | Prevents partial merges that leave the motion state machine in an inconsistent intermediate state. |
| Each PR must pass `npm run check` and `npm run verify` before merge. | Catches syntax, structural, and smoke regressions early. |
| Each PR must reference its task doc or issue in the commit message. | Maintains traceability between implementation and design intent. |

### Thread boundary definition

A motion thread is bounded by one of:

- **A single motion phase**: enter transition, exit transition, chrome swap, element morph, return transition.
- **A single contract surface**: `data-motion-role` attributes, overlay positioning, reduced-motion guard, timer cleanup.
- **A single coordination concern**: bottom chrome progress sync, gesture conflict resolution, long-press vs tap discrimination.

If a change touches more than one of these boundaries, split it into separate threads/PRs.

## Merge order

Motion PRs must merge in dependency order. The canonical sequence:

```
1. Contract primitives (data-motion-role, overlay DOM structure)
   └─> 2. Phase implementations (enter, exit, morph)
       └─> 3. Chrome coordination (top/bottom chrome swap, progress sync)
           └─> 4. Gesture integration (tap/long-press discrimination, reduced-motion)
               └─> 5. Polish and accessibility (timer cleanup, prefers-reduced-motion guards)
```

### Merge-order exceptions

- **Hotfix**: If a motion regression is live on the static rehearsal lane (4300) or Vue canary (4301), a targeted fix may merge ahead of sequence. The PR body must document why the exception was made.
- **Parallel-safe leaf changes**: Documentation, test-only, or CSS-only changes that do not alter motion timing or DOM structure may merge in any order.

### Pre-merge checklist

Before merging any motion PR:

1. Verify the PR's dependency chain is merged or explicitly waived.
2. Run `npm run check` (lint + type check).
3. Run `npm run verify` (static + smoke).
4. If the PR touches `data-motion-role` attributes or overlay DOM, manually test the card-to-detail transition on both lanes (4300, 4301).
5. If the PR touches reduced-motion, test with `prefers-reduced-motion: reduce` enabled.

## Ownership boundaries

| Area | Owner | Conflict level | Notes |
|---|---|---|---|
| `docs/design/card-camera-transition.md` | Design thread | open | Motion model spec. Changes require design review. |
| `data-motion-role` attribute contract | Motion thread | soft-lock | Any PR adding/removing/renaming roles must update the design doc. |
| Overlay DOM structure (`card-camera-transition.css`, overlay components) | Motion thread | soft-lock | Changes affect all motion phases. |
| Top/bottom chrome lifecycle | Chrome thread | soft-lock | Shared with app shell. Coordinate with chrome owner. |
| Gesture/timer layer | Interaction thread | soft-lock | Affects tap, long-press, and scroll behaviors. |
| `prefers-reduced-motion` guards | Accessibility thread | open | Self-contained. Low conflict. |
| `src/` motion components | Vue canary lane | soft-lock | Check current PRs before modifying. |
| `public/` motion CSS/DOM | Legacy lane | soft-lock | Check current task scope before modifying. |

### Cross-boundary coordination

When a motion PR needs to touch an area owned by another thread:

1. The PR body must name the other thread and the specific files.
2. The other thread's owner must review before merge.
3. If the other thread is in-flight, pause until it merges or coordinate a joint PR (which then follows the one-thread-one-PR rule by becoming a single coordinated thread).

## Review gates

Motion PRs pass through these review gates:

| Gate | Who | When | Criteria |
|---|---|---|---|
| Scope check | Any reviewer | Before review starts | PR touches only motion-scoped files. No unrelated changes. |
| Contract check | Motion-aware reviewer | During review | `data-motion-role` attributes match the design doc. No new roles without spec update. |
| Timing check | Motion-aware reviewer | During review | Duration values fall within the UX guidelines (micro: 100-180ms, card expand: 180-240ms, page transition: 240-320ms). |
| Accessibility check | Any reviewer | During review | `prefers-reduced-motion` guard present for any new animation. |
| Regression check | CI + manual | Before merge | `npm run verify` passes. Manual card-to-detail transition works on both lanes. |

### Gate waivers

A gate may be waived only if:

- The waiver is recorded in the PR body with a reason.
- The waived gate is tracked as a follow-up issue.
- The waiver does not affect production-critical paths (card-to-detail transition, chrome lifecycle).

## Non-goals

This governance does not cover:

- Backend motion or animation concerns (none exist in `lian-platform-server`).
- Map animation (governed by map v2 lane rules in the task board).
- Non-motion UI transitions (tab switches, page routing).
- Motion tooling or dev-experience improvements (separate track).

## References

- `docs/design/card-camera-transition.md` - motion model spec
- `docs/design/LIAN-Campus-UI-UX-Guidelines-V0.1.md` section 7 - duration and implementation rules
- `docs/agent/00_AGENT_RULES.md` - parallel development boundaries
- `docs/agent/05_TASK_BOARD.md` - lane parallelization guidance
- `docs/agent/FRONTEND_REVIEWER_HANDOFF.md` - issue #163 (motion/gesture contracts)
- `docs/agent/references/RECENT_WORK_HANDOFF_2026-05-06.md` - open motion risks
