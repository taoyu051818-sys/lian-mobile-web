# Task: issue-153-localization-locale-contract

## Goal

Produce a bounded docs-only contract slice for issue #153. Define the zh-CN-first localization policy, locale resolution order, metadata/title language policy, formatter responsibilities, copy-resource structure, validation error contract, map/provider language alignment, PWA metadata localization, and accessibility copy policy.

## Product scope

This task is documentation only. It defines the contract that future implementation slices must follow. It does not change runtime Vue components, i18n libraries, formatters, manifests, scripts, packages, or CI.

## Allowed files

- `docs/frontend/localization-locale-contract.md`
- `docs/agent/handoffs/localization-locale-contract.md`
- `docs/agent/tasks/issue-153-localization-locale-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No i18n library installation or configuration
- No copy catalog creation or hardcoded string migration
- No formatter implementation or `Intl.*` wrapper code
- No locale switching, language picker UI, or router meta hooks
- No PWA manifest changes or dynamic manifest generation
- No map tile provider parameter changes
- No screenshot suite or Playwright implementation in this slice
- Do NOT claim the full parent issue #153 is closed unless later evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Contract document exists at `docs/frontend/localization-locale-contract.md`
- [ ] Document defines zh-CN-first policy and MVP locale scope
- [ ] Document defines locale resolution order (URL > account > client > browser > default)
- [ ] Document defines metadata and document-title language rules
- [ ] Document defines formatter layer responsibilities and required formatters
- [ ] Document defines copy-resource directory structure and key namespace convention
- [ ] Document defines validation error structured-key contract
- [ ] Document defines map/place provider language alignment rules
- [ ] Document defines PWA metadata localization expectations
- [ ] Document defines accessibility copy policy
- [ ] Document defines cross-issue boundary with #113, #117, #118, #133, #147, #150, #106, #120, #132, #146
- [ ] Handoff and task records exist under `docs/agent/`
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify all three docs files exist, issue linkage remains slice-accurate, and cross-references to #106, #113, #117, #118, #120, #132, #133, #140, #146, #147, and #150 are consistent with the contract text.

## Relationship to parent issue

This task delivers a contract-only slice of #153. The parent issue remains broader and still requires runtime implementation work for i18n library integration, copy catalog creation, hardcoded string migration, formatter implementation, metadata registry, map provider language wiring, and PWA manifest localization. This task does not close #153.

## Risks

- Contract and implementation may drift if follow-up PRs do not explicitly reference this document
- The copy-resource structure assumes a flat `src/i18n/messages/zh-CN.ts` catalog; a chosen i18n library may require structural adjustments
- Backend error format alignment for the validation contract has not been negotiated

## Rollback plan

Delete the three new docs files. No runtime behavior is affected.
