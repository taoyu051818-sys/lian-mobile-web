# Handoff: responsive-layout-contract

Date: 2026-05-09
Issue: #144

## Summary

Created a bounded docs-only contract slice defining responsive layout modes for the LIAN mobile web shell. The contract covers mobile/tablet/desktop/wide breakpoints, navigation variants, Feed column-count policy, wide-screen detail behavior, desktop/tablet MVP composition for primary views, and a focused viewport verification checklist.

## Files changed

| File | Change |
|---|---|
| `docs/frontend/responsive-layout-contract.md` | New. Authoritative layout-mode contract for responsive shell/navigation/feed/detail/view-composition rules |
| `docs/agent/handoffs/responsive-layout-contract.md` | New. This handoff |
| `docs/agent/tasks/issue-144-responsive-layout-contract.md` | New. Task record for this docs slice |

## Decisions made

1. **Four width-based modes** — `mobile`, `tablet`, `desktop`, `wide` with a secondary `short-height` modifier.
2. **Navigation contract** — bottom navigation remains the default on mobile; side rail becomes the desktop/wide default; short-height mobile landscape uses compact side navigation instead of a persistent bottom bar.
3. **Feed density policy** — Feed shifts from 1-2 columns on mobile to 3 columns on tablet/desktop and 4 on wide screens.
4. **Detail behavior split** — mobile keeps full-screen detail; desktop/wide default to master-detail; tablet remains conservative unless both width and height are generous.
5. **Primary-view MVP matrix** — Feed, Map, Publish, Messages, and Profile each now have documented tablet/desktop composition expectations so future implementation work does not invent layouts ad hoc.
6. **Viewport checklist** — six target viewports are now the minimum responsive verification set for follow-up implementation slices.

## Validation

Intended validation from the task proposal:

```bash
npm run check
```

Manual validation completed in this pass:

- issue/task scope and allowed-file boundaries checked against the task proposal comment on issue #144
- cross-reference sanity checked against related issues #110, #121, #123, #130, and #135
- output restricted to the three allowed documentation paths

Validation not completed in this environment:

- `npm run check` was not run because this container could not obtain a local repository checkout and direct GitHub file-edit flow was used instead

## What was intentionally not done

- No `src/**` or `public/**` implementation work
- No runtime CSS/media-query changes
- No Vue shell/navigation/masonry/detail code edits
- No package, script, or CI changes
- No claim that issue #144 is fully complete

## Risks

- The contract will drift if later implementation PRs do not cite it during shell, Feed, or view-layout work
- Breakpoint values and navigation variants may still need product tuning once real UI slices are exercised in browser screenshots

## Rollback

Delete the three new docs files. No runtime behavior is affected.

## Next suggested task

Implement the app-shell layout-state and navigation-variant slice that consumes this contract, starting with shell mode detection and bottom-vs-side navigation ownership.
