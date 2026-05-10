# Motion parallel development rules

Issue: #86
Scope: how motion work runs in parallel with other frontend lanes

## Parallel-safe motion work

These motion tasks can run in parallel with each other and with non-motion lanes:

| Task | Conflict level | Why parallel-safe |
|---|---|---|
| Reduced-motion guard additions | open | Self-contained CSS/JS. No shared state. |
| `data-motion-role` attribute additions to new components | open | Additive. Does not change existing roles. |
| Motion documentation updates | open | Documentation only. No runtime impact. |
| Timer cleanup in motion-adjacent code | soft-lock | Scoped to timer lifecycle. Does not change motion timing. |
| Motion test additions | open | Test-only. No production impact. |

## Coordination-required motion work

These tasks touch shared surfaces and require coordination with other lanes:

| Task | Conflicts with | Coordination rule |
|---|---|---|
| Chrome lifecycle changes | App shell lane, bottom chrome progress | Both owners must review. Merge chrome PR first. |
| Overlay DOM structure changes | All motion phases | Merge overlay PR before any phase PR that depends on it. |
| `data-motion-role` renames or removals | All consumers of the attribute | Must update design doc and all referencing components in the same PR. |
| Motion timing changes | UX guidelines compliance | Must verify durations against `LIAN-Campus-UI-UX-Guidelines-V0.1.md` section 7. |
| Gesture/tap discrimination | Feed interaction, long-press, scroll | Coordinate with interaction thread. Merge gesture PR before motion PR that depends on it. |

## Runtime considerations

The legacy static runtime was removed in PR #282. Motion work now targets only the Vue/Vite runtime under `src/`.

### Rules

- A motion PR that changes the **contract** (`data-motion-role` attributes, overlay DOM structure) must update the design doc and all referencing components in the same PR.
- A motion PR that changes only **implementation** (timing, easing, CSS) may target a single concern.

## Integration lane expectations (refs: #84)

The integration lane is where motion threads converge before being considered production-ready. It is not a separate code lane — it is a merge-order discipline.

### Integration sequence

```
Phase 1: Foundation
  ├── Contract primitives (data-motion-role, overlay DOM)
  └── Reduced-motion guards (independent, parallel-safe)

Phase 2: Core motion
  ├── Enter transition (depends on Phase 1 contracts)
  ├── Exit transition (depends on Phase 1 contracts)
  └── Element morph (depends on Phase 1 contracts)

Phase 3: Coordination
  ├── Chrome swap (depends on Phase 2 enter/exit)
  ├── Bottom chrome progress sync (depends on Phase 2 enter)
  └── Gesture integration (depends on Phase 2 enter/exit)

Phase 4: Polish
  ├── Timer cleanup (depends on Phase 3)
  ├── Accessibility audit (depends on Phase 3)
  └── Performance validation (depends on Phase 3)
```

### Integration gates

A phase is "integrated" when:

1. All PRs in the phase are merged to the target branch.
2. `npm run verify` passes on the merged state.
3. The card-to-detail transition works on both lanes (4300, 4301).
4. No regressions in non-motion smoke checks.

### Integration failure protocol

If an integration gate fails:

1. Identify the failing PR via `git bisect` or targeted revert.
2. Revert the failing PR. Do not attempt to fix-forward during integration.
3. Open a regression issue linking the failure to the reverted PR.
4. Re-run the integration gate on the post-revert state.

## Branch strategy

- Motion feature branches follow the naming pattern: `motion/<phase>-<concern>` (e.g., `motion/enter-transition`, `motion/chrome-swap`).
- Each branch targets `main` or the current integration branch.
- Branches should live 1-3 days maximum. Longer-lived branches increase merge conflict risk.
- Rebase or merge from `main` daily to stay current.

## Validation commands

Run these before every motion PR merge:

```bash
npm run check          # lint + type check
npm run verify         # static guards + smoke (both layers)
```

For motion-specific validation:

```bash
# Test card-to-detail transition on legacy lane
# (manual: open a feed card, verify enter/exit animation)

# Test card-to-detail transition on Vue canary
# (manual: same test on port 4301)

# Test reduced-motion
# (manual: enable prefers-reduced-motion in browser devtools, verify no animation)
```
