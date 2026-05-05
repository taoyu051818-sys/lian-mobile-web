# Handoff: <task-name>

## Current source check

Record the current sources checked before writing this handoff:

- Current code on `main`:
- Recent merged PRs checked:
- Root `README.md` / `package.json` checked:
- Relevant override files checked:
  - `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`
  - `docs/agent/references/HANDOFFS_OVERRIDE_2026-05-05.md`
  - other relevant override files:

If this handoff updates or contradicts an old task/handoff/contract, state exactly what is superseded.

## Summary

What changed in 3-5 bullet points.

- ...
- ...
- ...

## Files changed

- `path/to/file`: reason for change

## Repository and ownership notes

- Repository touched: `lian-mobile-web`
- Owned area touched: frontend runtime lanes / Vue canary / legacy-static rehearsal / task-board UI / frontend docs / other:
- Backend/API/runtime changes needed? If yes, link the backend task or handoff in `lian-platform-server`.

## API or contract changed

If none, write "None."

Before claiming contract status, check current frontend callers, backend routes, and `docs/agent/references/CONTRACTS_OVERRIDE_2026-05-05.md`.

- `GET /api/example`: new/changed behavior ...

## Data or state changed

If none, write "None."

Do not claim backend runtime data ownership from this repo. If backend data changed, link the backend handoff.

## How to verify

1. Step-by-step verification instructions
2. Current package commands or browser steps
3. Expected results

## Test result

Paste command outputs or summarize test results. Use current `package.json` scripts.

```bash
npm run verify
# output: ...
```

## Known risks

- Risk 1: description
- Risk 2: description

## Not done

- Things this task intentionally did not complete
- Follow-up items for the next task

## Acceptance note

This handoff is not durable acceptance. Reviewer validation must be recorded separately in the task board, task doc, PR, or a newer PR-derived status file.

## Next suggested task

- Suggested next task name and brief description
