# Task: probe-debug-governance-contract

Issue: [#155](https://github.com/taoyu051818-sys/lian-mobile-web/issues/155) — Related to #155, Part of #155, Does not close #155

## Goal

Produce a bounded docs-only governance contract for temporary probes, debug UI, feature flags, release diagnostics, and production cleanup. Define probe/flag registry fields, production UI rules, localStorage cleanup policy, release diagnostics guidance, console/logging policy, engineering wording guard, and a QA guard checklist. No runtime implementation.

## Product scope

This is documentation only. The contract defines rules that future implementation code must follow. It does not modify any source file, build configuration, or test suite.

## Allowed files

- `docs/frontend/probe-debug-governance-contract.md`
- `docs/qa/probe-debug-guard-checklist.md`
- `docs/agent/tasks/probe-debug-governance-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No runtime flag registry implementation (`src/platform/flagRegistry.ts`)
- No runtime logger wrapper implementation (`src/platform/logger.ts`)
- No removal or modification of the existing `HOME_UPDATE_PROBE_VERSION` in `FeedView.vue`
- No CI guard implementation (that is #124)
- No storage registry implementation (that is #106)
- Do NOT claim the full parent issue #155 is closed unless the delivered evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Governance contract exists at `docs/frontend/probe-debug-governance-contract.md`
- [ ] Document defines probe/flag registry fields: `key`, `type`, `default`, `env`, `owner`, `expiry`, `cleanupIssue`, `storageKey`, `userVisibleImpact`, `productionPolicy`
- [ ] Document specifies production startup/user-visible UI must not show engineering probes by default
- [ ] Document defines localStorage cleanup and key lifecycle rules
- [ ] Document defines release diagnostics guidance (releaseId, build manifest, health endpoint)
- [ ] Document defines console/logging production policy
- [ ] Document defines engineering wording guard (forbidden terms in production copy)
- [ ] Document defines overlay and accessibility rules for debug surfaces
- [ ] QA guard checklist exists at `docs/qa/probe-debug-guard-checklist.md`
- [ ] QA checklist covers: expired probes, engineering wording, bare console logging, production-visible debug UI, localStorage hygiene, release diagnostics, overlay/a11y, registry completeness
- [ ] Issue linkage uses slice-accurate form: "Related to #155, Part of #155, Does not close #155"
- [ ] `npm run check` passes
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify both docs files exist and cross-references to issues #106, #113, #119, #124, #126, #133, #134, #135, #147, #149, #153, #154 are correct.

## Relationship to parent issue

This PR delivers a contract-only slice of #155. The parent issue's broader acceptance criteria (runtime flag registry, logger wrapper, CI guards, storage registry integration, removal of the home update probe) remain open. This PR should be linked to #155 as a follow-up contract, not as closure.

## Risks

- Contract may drift from implementation if not enforced by code review or linting
- QA checklist is prescriptive but unimplemented; a follow-up task must wire the CI guards
- Registry format is aspirational until `src/platform/flagRegistry.ts` exists

## Rollback plan

- Delete the two new docs files and this task doc. No runtime behavior is affected.
