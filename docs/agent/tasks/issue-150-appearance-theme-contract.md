# Task: issue-150-appearance-theme-contract

## Goal

Produce a bounded docs-only contract slice for issue #150. Define light/dark/system appearance policy, semantic token ownership, theme-color/PWA status-bar expectations, contrast matrix requirements, map/media theme policy, preference persistence, and a verification checklist.

## Product scope

This task is documentation only. It defines the contract that future implementation slices must follow. It does not change runtime CSS, Vue components, manifests, scripts, packages, or CI.

## Allowed files

- `docs/frontend/appearance-theme-contract.md`
- `docs/agent/handoffs/appearance-theme-contract.md`
- `docs/agent/tasks/issue-150-appearance-theme-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No runtime dark-mode implementation
- No token CSS or manifest changes
- No PWA/service-worker/browser integration changes
- No settings UI or account-sync implementation
- No screenshot suite or Playwright implementation in this slice
- Do NOT claim the full parent issue #150 is closed unless later evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Contract document exists at `docs/frontend/appearance-theme-contract.md`
- [ ] Document defines three appearance modes: `light`, `dark`, `system`
- [ ] Document defines root theme resolution and `color-scheme` expectations
- [ ] Document defines semantic token layers and required shared surfaces
- [ ] Document defines theme-color / manifest / browser-chrome expectations
- [ ] Document defines contrast matrix expectations for common UI surfaces
- [ ] Document defines preference persistence and cross-tab sync behavior
- [ ] Document defines map/media theming expectations and verification checklist
- [ ] Handoff and task records exist under `docs/agent/`
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify all three docs files exist, issue linkage remains slice-accurate, and references to #109, #123, #134, #144, and #147 are consistent with the contract text.

## Relationship to parent issue

This task delivers a contract-only slice of #150. The parent issue remains broader and still requires runtime implementation work for root theme state, semantic token values, theme-color/manifest integration, map/media theming, and screenshot/contrast validation. This task does not close #150.

## Risks

- Contract and implementation may drift if follow-up PRs do not explicitly reference this document
- Theme-color, map, and glass-surface choices may need tuning after screenshot-based review

## Rollback plan

Delete the three new docs files. No runtime behavior is affected.
