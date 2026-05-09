# Task: issue-144-responsive-layout-contract

## Goal

Produce a bounded docs-only contract slice for issue #144. Define mobile/tablet/desktop/wide layout modes, navigation variants, Feed column-count policy, wide-screen detail behavior, primary-view composition expectations, and a viewport verification checklist.

## Product scope

This task is documentation only. It defines the contract that future implementation slices must follow. It does not change runtime CSS, Vue components, scripts, packages, or CI.

## Allowed files

- `docs/frontend/responsive-layout-contract.md`
- `docs/agent/handoffs/responsive-layout-contract.md`
- `docs/agent/tasks/issue-144-responsive-layout-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No runtime layout implementation
- No navigation component refactor
- No Feed masonry code changes
- No desktop/tablet CSS/media-query work
- No screenshot suite or Playwright implementation in this slice
- Do NOT claim the full parent issue #144 is closed unless later evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Contract document exists at `docs/frontend/responsive-layout-contract.md`
- [ ] Document defines four layout modes: mobile, tablet, desktop, wide
- [ ] Document defines at least one low-height/landscape modifier rule
- [ ] Document defines navigation variants and which modes use bottom vs side navigation
- [ ] Document defines Feed column-count policy by mode
- [ ] Document defines wide-screen detail behavior, including master-detail expectations
- [ ] Document defines tablet/desktop MVP composition for Feed, Map, Publish, Messages, and Profile
- [ ] Document includes a focused viewport checklist for future responsive validation
- [ ] Handoff and task records exist under `docs/agent/`
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify all three docs files exist, issue linkage remains slice-accurate, and references to #110, #121, #123, #130, and #135 are consistent with the contract text.

## Relationship to parent issue

This task delivers a contract-only slice of #144. The parent issue remains broader and still requires runtime implementation work for shell layout modes, navigation variants, Feed columns, detail layout, and responsive testing. This task does not close #144.

## Risks

- Contract and implementation may drift if follow-up PRs do not explicitly reference this document
- Breakpoints and composition rules may need tuning after screenshot-based validation

## Rollback plan

Delete the three new docs files. No runtime behavior is affected.
