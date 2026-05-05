# Handoff: Pro Engineering Decision Task Split

## Date

2026-05-03

## Thread scope

Architecture and project-management documentation only. No runtime code was changed.

## Decision implemented in docs

The Pro engineering decision has been converted into concrete task documents and task-board entries.

Current engineering theme:

```text
Make existing features reviewable, reproducible, distributable across threads, and ready for repo split.
```

## Files changed

- `docs/agent/references/PRO_ENGINEERING_DECISION_2026-05-03.md`
- `docs/agent/05_TASK_BOARD.md`
- `docs/agent/tasks/frontend-stability-smoke.md`
- `docs/agent/tasks/nodebb-detail-actions-profile-history.md`
- `docs/agent/tasks/lane-f-messages-review-rerun.md`
- `docs/agent/tasks/publish-v2-browser-acceptance.md`
- `docs/agent/tasks/audience-write-side-minimum-audit.md`
- `docs/agent/handoffs/pro-engineering-decision-task-split.md`

## New task docs

- `docs/agent/tasks/lane-f-messages-review-rerun.md`
- `docs/agent/tasks/publish-v2-browser-acceptance.md`
- `docs/agent/tasks/audience-write-side-minimum-audit.md`

## Existing task docs updated

- `docs/agent/tasks/frontend-stability-smoke.md`
- `docs/agent/tasks/nodebb-detail-actions-profile-history.md`

## Current execution order

1. Fix frontend smoke harness.
2. Rerun Lane F Messages review.
3. Run Publish V2 browser acceptance.
4. Run NodeBB detail/profile browser acceptance.
5. Clean docs/agent baseline.
6. Audit Audience write-side minimum enforcement.
7. Prepare backend repo bootstrap.

## Explicit non-goals

- No runtime fixes in this documentation handoff.
- No feature expansion.
- No recommendation strategy changes.
- No LLM auto-publish/auto-review.
- No complex Map v2 editor continuation in the P0 batch.
- No immediate destructive repo split.

## Next thread instructions

Pick the first open P0 task from `docs/agent/05_TASK_BOARD.md`.

Implementation threads should not start from this handoff alone. They must read the relevant task doc before editing runtime files.
