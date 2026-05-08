# Task: issue-188-badge-chip-presenter-contract

## Goal

Define a bounded docs-only contract slice for status/type/badge/chip presenter responsibilities. Specify domain taxonomy boundaries, presenter output shape, unknown fallback behavior, AI/official/trust badge semantics, UI primitive boundary rules, and a QA/test checklist.

## Product scope

This is a documentation-only task. It produces:

1. Contract document defining presenter responsibilities and domain taxonomies
2. QA test checklist mapping 1:1 to contract sections
3. Task and handoff records for traceability

No runtime code, no UI components, no API changes.

## Allowed files

- `docs/frontend/contracts/badge-chip-presenter-contract.md`
- `docs/qa/badge-chip-presenter-test-checklist.md`
- `docs/agent/tasks/issue-188-badge-chip-presenter-contract.md`
- `docs/agent/handoffs/issue-188-badge-chip-presenter-contract.md`

## Forbidden files

- `src/**` — no runtime code changes
- `public/**` — no static asset changes
- `package.json` / `package-lock.json` — no dependency changes
- `.github/**` — no CI/infrastructure changes
- `.env*` — no environment changes

## Non-goals

- Runtime implementation of presenter functions
- Vue component migration (TypeChip, TrustBadge, etc.)
- Design token CSS implementation
- E2E or visual regression test setup
- Backend API contract for `official` flag authorization

## Acceptance criteria

- [ ] Contract defines six domain taxonomies: ContentType, TrustStatus, PlaceType, Visibility, PermissionState, SourceKind
- [ ] Contract specifies `PresenterOutput` shape: `{ label, tone, icon, description, ariaLabel, copyKey }`
- [ ] Contract defines unknown enum fallback with `neutral` tone and non-empty fields
- [ ] Contract documents AI badge semantics for `aiGenerated`, `aiAssisted`, `aiSummary`
- [ ] Contract documents official badge semantics with backend-authorization requirement
- [ ] Contract documents trust badge state meanings and user-facing descriptions
- [ ] Contract defines UI primitive boundary rule: domain enums must not be defined in `src/ui/**`
- [ ] Contract maps all taxonomy values to semantic tones with light/dark/high-contrast tokens
- [ ] QA checklist covers presenter mapping, unknown fallback, a11y labels, contrast, and guardrails
- [ ] Issue linkage uses: Part of #188, Related to #188, Does not close #188

## Validation commands

```bash
npm run check
```

## Relationship to parent issue

Part of #188. This task produces the contract and QA documentation slice only. Runtime implementation of presenter functions and component migration are tracked as separate tasks under #188. This task does not close #188.

## Risks

- None — documentation only, no runtime behavior affected.

## Rollback plan

Delete the four new/updated doc files. No runtime behavior is affected.
