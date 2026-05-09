# Handoff: appearance-theme-contract

Date: 2026-05-09
Issue: #150

## Summary

Created a bounded docs-only contract slice defining the LIAN mobile web appearance model for light, dark, and system-driven themes. The contract covers appearance modes, root selector ownership, semantic token layers, theme-color and manifest expectations, contrast matrix requirements, map/media theming policy, local preference persistence, and a focused verification checklist.

## Files changed

| File | Change |
|---|---|
| `docs/frontend/appearance-theme-contract.md` | New. Authoritative appearance/theme contract for theme modes, semantic tokens, browser chrome, contrast, and verification rules |
| `docs/agent/handoffs/appearance-theme-contract.md` | New. This handoff |
| `docs/agent/tasks/issue-150-appearance-theme-contract.md` | New. Task record for this docs slice |

## Decisions made

1. **Three-mode preference model** — `light`, `dark`, and `system` are the only allowed user-facing appearance modes.
2. **Resolved DOM theme** — `system` stays a stored preference, but the DOM must resolve to `light` or `dark` so tokens and browser chrome stay coherent.
3. **Semantic token layering** — implementation must separate foundation palette from semantic surface/content/border/feedback tokens rather than extending hard-coded page colors.
4. **Theme-color contract** — browser chrome, manifest colors, and future PWA status-bar behavior must follow the resolved theme instead of a fixed light default.
5. **Contrast matrix** — glass surfaces, muted text, focus states, feedback surfaces, map controls, and image overlays all need explicit light/dark semantics before dark mode is considered ready.
6. **Map/media policy** — the map may remain visually light in MVP, but surrounding shell and controls still need deliberate dark-theme treatment instead of accidental mismatch.
7. **Preference persistence** — local storage key `lian.appearance` and storage-event sync are now the documented MVP persistence path.

## Validation

Intended validation from the task proposal:

```bash
npm run check
```

Manual validation completed in this pass:

- issue/task scope and allowed-file boundaries checked against the task proposal comment on issue #150
- cross-reference sanity checked against related issues #109, #123, #134, #144, and #147
- output restricted to the three allowed documentation paths

Validation not completed in this environment:

- `npm run check` was not run because this container did not have a local repository checkout and the change was delivered through direct GitHub file creation instead

## What was intentionally not done

- No `src/**`, `public/**`, or manifest implementation work
- No CSS token definitions or dark-mode runtime wiring
- No settings UI, account-sync, or map tile provider changes
- No package, script, or CI changes
- No claim that issue #150 is fully complete

## Risks

- The contract will drift if later token or theme-color PRs do not cite it while implementing root theme state and browser-chrome behavior
- The light-map-inside-dark-shell policy may still need visual tuning once screenshots exist for real surfaces

## Rollback

Delete the three new docs files. No runtime behavior is affected.

## Next suggested task

Implement root appearance state and semantic token ownership, starting with storage-backed `light|dark|system` resolution plus `data-theme` / `color-scheme` synchronization.
