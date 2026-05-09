# Handoff: issue-188-badge-chip-presenter-contract

Date: 2026-05-08
Issue: #188

## Summary

Created a bounded docs-only contract slice defining badge/chip presenter responsibilities. The contract specifies six domain taxonomies (ContentType, TrustStatus, PlaceType, Visibility, PermissionState, SourceKind), the presenter output shape, unknown fallback behavior, AI/official/trust badge semantics, UI primitive boundary rules, and a QA test checklist.

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `docs/frontend/contracts/badge-chip-presenter-contract.md` | Updated | Added PermissionState taxonomy (§1.6), UI primitive boundary rule (§1.7), PermissionState→Tone mapping (§6.2), permissionState ariaLabel examples (§5.3), expanded acceptance criteria, issue linkage |
| `docs/qa/badge-chip-presenter-test-checklist.md` | Created | QA test checklist with 9 sections (T1–T9) covering mapping, fallback, AI/official/trust badges, a11y, contrast, and UI primitive boundary guardrails |
| `docs/agent/tasks/issue-188-badge-chip-presenter-contract.md` | Created | Task definition with allowed/forbidden files, acceptance criteria, validation commands |
| `docs/agent/handoffs/issue-188-badge-chip-presenter-contract.md` | Created | This handoff file |

## Decisions made

1. **PermissionState taxonomy added** — Six states (`granted`, `denied`, `restricted`, `pending`, `expired`, `public`) aligned with audience/permission design in `docs/agent/tasks/audience-permission-design.md`.
2. **UI primitive boundary rule (§1.7)** — Explicit rule that domain enums must not be defined, re-exported, or referenced inside `src/ui/**`. UI primitives accept only visual props (`tone`, `size`, `variant`).
3. **Unknown fallback unchanged** — All presenters share the same `UNKNOWN_FALLBACK` with `neutral` tone. No per-taxonomy fallback variants.
4. **Issue linkage style** — Used "Part of #188. Related to #188. Does not close #188." per slice-accurate convention.
5. **TrustStatus naming** — Contract uses `TrustTone` in taxonomy (§1.2) to distinguish from `SemanticTone`. QA checklist uses `presentTrustStatus()` for presenter function name per existing convention.

## Validation

```bash
npm run check
```

## What was intentionally not done

- No runtime presenter function implementation
- No Vue component migration
- No design token CSS changes
- No E2E or visual regression tests
- No backend API changes

## Risks

None — documentation only. No runtime behavior affected.

## Rollback

Delete the four updated/created doc files. No runtime behavior is affected.

## Next suggested task

Implement runtime presenter functions (`presentContentType`, `presentTrustStatus`, `presentPlaceType`, `presentVisibility`, `presentPermissionState`, `presentSourceKind`) in a new `src/presenters/` module, with unit tests covering the QA checklist scenarios.
