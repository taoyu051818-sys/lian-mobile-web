# Handoff: prelaunch frontend CI consolidation

Status: implementation complete; awaiting independent review
Issue: `#1098`
Date: 2026-08-23

## Outcome

Frontend quality coverage is unchanged, but duplicate and premature automation is removed from the
normal development path:

- `Frontend Verify` is the sole pull-request/main-push workflow that installs dependencies and runs
  the complete `npm run verify` command.
- `E2E PR Gate` is retained unchanged for deterministic local Playwright journeys, including the
  accepted store/product commerce journeys.
- the former duplicate `Frontend Validation` workflow and its legacy commit-status publisher are
  removed;
- `Frontend Release Build` is manual-dispatch only and deploys only when explicitly dispatched from
  `main` into the existing protected production environment;
- `Production Canary` remains available read-only, but its unattended daily schedule is removed.

No application source, test assertion, package script, dependency, feature flag, branch-protection
setting, credential or external environment changed.

The live verification and release docs now point at the retained workflows. The runbook also
records that the manual prelaunch deploy still rebuilds remotely and is therefore not an accepted
production artifact path; fixing that release implementation remains a separate prelaunch task.

## Validation

- all workflow YAML files parsed successfully;
- static event inspection found one PR `npm run verify` path, the existing PR E2E path, no scheduled
  production canary and no push-triggered deployment;
- unchanged `npm run verify` passed: 184 Vitest files / 4,957 tests, 68 Node files / 858 tests,
  sanitizer, production builds and 3/3 loopback smoke checks;
- `git diff --check` passed;
- current-status structure markers and queue tests remained green as part of the full suite.

## Deferred release work

Automatic deployment and scheduled canaries should be reconsidered only after a real release target,
credentials, rollback owner and operational window exist. Re-enabling either requires a separate
release task; this change does not remove the underlying manual workflow implementation.
