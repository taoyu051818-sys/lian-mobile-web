# Task: issue-186-feedback-toast-contract

## Goal

Produce a bounded docs-only contract slice for issue #186. Define the feedback channel taxonomy (toast vs inline vs fatal), queue/timer/privacy expectations, live-region accessibility policy, and a focused test checklist. No runtime implementation.

## Product scope

This is documentation only. The contract defines rules that future implementation code must follow. It does not modify any source file, build configuration, or test suite.

## Allowed files

- `docs/frontend/feedback-toast-contract.md`
- `docs/agent/handoffs/feedback-toast-contract.md`
- `docs/agent/tasks/issue-186-feedback-toast-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `scripts/**`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/**`

## Non-goals

- No feedback runtime implementation (toast queue, timer registry, dedup, action buttons)
- No changes to `src/ui/feedback/toast-state.ts`, `ToastHost.vue`, or `Toast.vue`
- No `src/public/scripts/package/CI` changes
- No timer or component code edits
- Do NOT claim the full parent issue #186 is closed unless the delivered evidence truly satisfies the broader acceptance criteria

## Acceptance criteria

- [ ] Contract document exists at `docs/frontend/feedback-toast-contract.md`
- [ ] Document defines feedback channel taxonomy: field error, inline error, toast, fatal fallback
- [ ] Document defines toast queue constraints (max visible, max queued, dedup window, priority)
- [ ] Document defines timer registry contract (track timeout ids, cleanup on dismiss/clear/dispose)
- [ ] Document defines live-region policy (host owns region, severity-based assertiveness, no focus steal)
- [ ] Document defines privacy boundaries (forbidden content in toast messages)
- [ ] Document defines scope/lifecycle (view-scoped, session-scoped, global; cleanup on logout)
- [ ] Document includes a focused test checklist covering timers, queue, a11y, privacy, scope, and channel boundaries
- [ ] Handoff and task records exist in `docs/agent/`
- [ ] `npm run check` passes
- [ ] No files outside the allowed list were modified

## Validation commands

```bash
npm run check
```

Manual: verify all three docs files exist and cross-references to issues #113, #133, #147, #154, #185 are correct.

## Relationship to parent issue

This PR delivers a contract-only slice of #186. The parent issue's broader acceptance criteria (runtime implementation, component refactoring, test scaffolding) remain open. This PR should be linked to #186 as a follow-up contract, not as closure.

## Risks

- Contract may drift from implementation if not enforced by code review or linting
- Test checklist is prescriptive but unimplemented; a follow-up task must write the actual tests

## Rollback plan

- Delete the three new docs files. No runtime behavior is affected.
