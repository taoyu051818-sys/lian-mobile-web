# 05 Task Board Superseded Notice - 2026-05-05

`docs/agent/05_TASK_BOARD.md` is a long historical task board and must not be used as the current implementation source of truth by itself.

## Current rule

Before using `05_TASK_BOARD.md`, read these first:

1. `docs/agent/README.md`
2. `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
3. `docs/agent/references/TASK_BOARD_OVERRIDE_2026-05-05.md`
4. `docs/agent/references/TASK_DOCS_OVERRIDE_2026-05-05.md`
5. `docs/agent/references/HANDOFFS_OVERRIDE_2026-05-05.md`
6. `docs/agent/references/DOC_REVIEW_FINDINGS_2026-05-05.md`

## Why this notice exists

`05_TASK_BOARD.md` still contains old task state, split-era repo assumptions, historical acceptance records, old port/runtime references, and long audit sections. The file remains useful as history and context, but current code, merged PRs, PR-derived status, and override files are more authoritative.

## Safe usage

Use `05_TASK_BOARD.md` to understand:

- what tasks existed historically;
- why a task was created;
- what validations were once recorded;
- what follow-ups were once suggested.

Do not use it alone to decide:

- what is currently implemented;
- what repo owns a file today;
- whether a task is still active;
- whether a feature is accepted today;
- what command or port should be used today.

## Direct edit note

The file is long enough that GitHub contents replacement can easily become unsafe when tool output is truncated. This sidecar notice exists to avoid accidentally overwriting the task board while still giving direct readers a clear superseded marker.
