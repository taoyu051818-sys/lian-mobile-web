# Task: issue-397-placesheet-trust-copy-contract

## Goal

Define a bounded docs-only copy contract for PlaceSheet trust, correction, AI-summary disclosure, and safe empty/hidden-content states.

## Product scope

This task produces:

1. a frontend contract document for PlaceSheet trust/correction wording;
2. a QA checklist that maps to the contract states;
3. task and handoff records for traceability.

No runtime code, no backend changes, no moderation-flow implementation, and no large UI redesign.

## Allowed files

- `docs/frontend/contracts/placesheet-trust-copy-contract.md`
- `docs/qa/placesheet-trust-copy-test-checklist.md`
- `docs/agent/tasks/issue-397-placesheet-trust-copy-contract.md`
- `docs/agent/handoffs/issue-397-placesheet-trust-copy-contract.md`

## Forbidden files

- `src/**`
- `public/**`
- `package.json`
- `package-lock.json`
- `.github/**`
- `.env*`
- backend code or moderation-policy implementation files

## Non-goals

- Runtime PlaceSheet implementation under #63 or #67
- Moderation or report-policy approval under #129
- Search/discovery ranking work under #141
- Map-point editing workflow
- Notification behavior for place follow/save actions

## Acceptance criteria

- [ ] Contract distinguishes `high-confidence`, `needs-review`, `may-be-stale`, and `correction-pending`
- [ ] Contract defines correction CTA wording that stays separate from moderation/report language
- [ ] Contract defines AI-summary disclosure that remains separate from verified place facts
- [ ] Contract defines empty states for `no content yet`, `temporarily unavailable`, `visibility-limited`, and `discovery-not-ready`
- [ ] Contract defines conservative save/follow wording that does not over-promise notifications
- [ ] QA checklist maps to the contract and keeps issue linkage non-closing

## Validation

Manual doc review against:

- `taoyu051818-sys/lian-platform-server#121`
- `taoyu051818-sys/lian-platform-server/docs/agent/content-ops/CAMPUS_PLACE_OPS_FOUNDATION.md`
- issue #397 acceptance criteria

Repo-local validation commands were not required for this docs-only slice in the GitHub edit flow environment.

## Relationship to parent issue

Related to #397.
Related to #63.
Related to #67.
Related to #129.
Related to #141.
Related to taoyu051818-sys/lian-platform-server#121.
Does not close #397.
Does not close #63.
Does not close #67.
Does not close #129.
Does not close #141.

## Risks

Low risk. Documentation only.

## Rollback plan

Delete the four docs created by this slice. No runtime behavior is affected.
