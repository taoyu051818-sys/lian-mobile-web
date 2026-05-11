# Handoff: issue-397-placesheet-trust-copy-contract

Date: 2026-05-11
Issue: #397

## Summary

Created a bounded docs-only contract slice for PlaceSheet trust, correction, AI-summary disclosure, and safe empty-state wording. The contract stays grounded in the content-ops baseline from `taoyu051818-sys/lian-platform-server#121` and avoids claiming that PlaceSheet runtime acceptance is complete.

## Files changed

| File | Action | Description |
|---|---|---|
| `docs/frontend/contracts/placesheet-trust-copy-contract.md` | Created | Defines trust-state copy, correction CTA wording, AI-summary disclosure rules, empty/hidden-content copy, and conservative save/follow naming |
| `docs/qa/placesheet-trust-copy-test-checklist.md` | Created | Adds a QA checklist mapped to trust, correction, AI-summary, empty-state, and guardrail rules |
| `docs/agent/tasks/issue-397-placesheet-trust-copy-contract.md` | Created | Records scope, allowed/forbidden files, acceptance criteria, and rollback |
| `docs/agent/handoffs/issue-397-placesheet-trust-copy-contract.md` | Created | This handoff file |

## Decisions made

1. Trust states are limited to four primary user-facing buckets: `high-confidence`, `needs-review`, `may-be-stale`, and `correction-pending`.
2. Correction wording uses `帮助纠正` instead of report/complaint language so the copy stays aligned with factual-fix intent from #121.
3. AI disclosure is summary-scoped. It does not downgrade or replace verified place facts.
4. Empty states explicitly distinguish `no content yet`, `temporarily unavailable`, `visibility-limited`, and `discovery-not-ready`.
5. Save/follow wording remains conservative: prefer `保存地点` until real follow/update behavior exists.

## Validation

Manual review performed against:

- `taoyu051818-sys/lian-platform-server#121`
- `taoyu051818-sys/lian-platform-server/docs/agent/content-ops/CAMPUS_PLACE_OPS_FOUNDATION.md`
- issue #397 acceptance criteria and task-proposal constraints

No repo-local commands were run because this pass used the GitHub edit flow for a docs-only slice.

## What was intentionally not done

- No runtime PlaceSheet component changes
- No backend or moderation workflow changes
- No map editing or discovery-ranking work
- No notification-behavior promises for save/follow actions

## Risks

Low risk. Documentation only.

## Rollback

Delete the four docs created by this slice. No runtime behavior is affected.

## Next suggested task

Implement the PlaceSheet presenter/view-model layer for these state keys in the active runtime, then validate it with `docs/qa/placesheet-trust-copy-test-checklist.md` under #63 / #67.
