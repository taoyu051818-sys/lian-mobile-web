# Task: issue-156-static-asset-base-path-contract

## Goal

Produce a bounded docs-only contract slice for issue #156. Define the base-path/static-asset contract for root versus subpath deployment, asset URL helper expectations, legacy-versus-Vue runtime differences, and PWA scope/start_url alignment.

## Product scope

This task is documentation only. It defines the contract that future implementation slices must follow. It does not change runtime code, Vue components, manifests, scripts, packages, or CI.

## Allowed files

- `docs/frontend/static-asset-base-path-contract.md`
- `docs/agent/handoffs/static-asset-base-path-contract.md`
- `docs/agent/tasks/issue-156-static-asset-base-path-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No runtime base-path implementation
- No `vite.config.ts` or `runtime-config.ts` changes
- No PWA manifest, service worker, or icon changes
- No legacy HTML template changes
- No reverse proxy configuration changes
- Do NOT claim the full parent issue #156 is closed unless later evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Contract document exists at `docs/frontend/static-asset-base-path-contract.md`
- [ ] Document defines root and subpath deployment modes
- [ ] Document defines Vite `base` configuration and `LIAN_BASE_PATH` env variable contract
- [ ] Document defines asset URL resolution rules for Vue runtime (Vite mechanisms)
- [ ] Document defines asset URL resolution rules for legacy runtime (`window.LIAN_BASE_PATH`)
- [ ] Document defines dual-runtime base-path alignment rules
- [ ] Document defines PWA `scope` and `start_url` alignment with base path
- [ ] Document defines CDN and external asset interaction rules
- [ ] Document defines reverse proxy contract for subpath deployment
- [ ] Document includes verification checklists for both deployment modes
- [ ] Handoff and task records exist under `docs/agent/`
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify all three docs files exist, issue linkage remains slice-accurate, and references to #109, #134, #152, and #167 are consistent with the contract text.

## Relationship to parent issue

This task delivers a contract-only slice of #156. The parent issue remains broader and still requires runtime implementation work for Vite `base` configuration, legacy HTML base-path support, `window.LIAN_BASE_PATH` injection, PWA scope alignment, and subpath deployment smoke tests. This task does not close #156.

## Risks

- Contract and implementation may drift if follow-up PRs do not explicitly reference this document
- Legacy runtime subpath support may require non-trivial HTML template rework
- PWA scope rules are forward-looking (#109); changes to the PWA RFC may invalidate parts of this contract

## Rollback plan

Delete the three new docs files. No runtime behavior is affected.
