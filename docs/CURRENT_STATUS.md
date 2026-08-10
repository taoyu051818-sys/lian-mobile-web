# Current Status

Last verified: 2026-08-10

Latest control issue: [#1090](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1090)
(F2e task contract recorded locally; implementation not yet started).

Open release blockers: None recorded as open GitHub issues.

Current production release: Not recorded in this repository.

**Active audit queue:**

- F2e Publish draft account-scope re-entry: normal in-app login/logout was
  confirmed to unmount Publish, so A → B → A is not a currently reachable
  normal-UI incident. The composable contract still fails that transition and
  is approved for bounded defensive hardening under #1090.
- Scope is local frontend code and tests only. No push, deployment, production
  mutation, or online environment check is authorized.

Local audit baseline:

- F2d Publish structured location handoff accepted locally on
  `codex/audit-f2d-publish-structured-location`; implementation commit
  `1418bf6`.
- F2d validation passed: 157 Vitest files / 4,018 tests, 65 Node structure
  files / 817 tests, build, sanitizer, 3 local smoke checks, 2 deterministic
  loopback browser journeys, and full `npm run verify`. Independent review
  recorded `ACCEPT` with no remaining blocker.
- F2c Publish map-picker draft continuity accepted locally on
  `codex/audit-f2c-publish-map-picker-continuity`; implementation commits
  `ccfc236` and `165233f`.
- F2c validation passed: 156 Vitest files / 3,981 tests, 65 Node structure
  files / 817 tests, build, sanitizer, 3 local smoke checks, deterministic
  local browser round trips, and full `npm run verify`.
- F2b Publish AI attempt boundary accepted locally on
  `codex/audit-f2b-publish-ai-attempt-boundary`; implementation commit
  `391d17a`.
- F2b validation passed: 156 Vitest files / 3,978 tests, 65 Node structure
  files / 817 tests, build, smoke, and full `npm run verify`.
- F2a detail request generation accepted locally on
  `codex/audit-f2a-detail-request-generation`; implementation commit `1653237`.
- F2a validation passed: 155 Vitest files / 3,961 tests, 65 Node structure
  files / 817 tests, build, smoke, and full `npm run verify`.
- F1 Profile session state accepted locally on
  `codex/audit-f1-profile-session-state`; implementation commit `35768e7`.
- F1 validation passed: 155 Vitest files / 3,955 tests, 65 Node structure
  files / 817 tests, build, smoke, and full `npm run verify`.
- Branch `codex/audit-b0-quality-gate`, accepted commit `0ea4cc1`.
- B0 quality gate accepted locally: 154 Vitest files / 3,946 tests and
  65 Node structure files / 817 tests passed; sanitizer, build, smoke, and
  full `npm run verify` also passed.
- These local commits have not been pushed, merged, or deployed.

Before starting new work, query [open frontend issues](https://github.com/taoyu051818-sys/lian-mobile-web/issues?q=is%3Aissue%20state%3Aopen), [open backend issues](https://github.com/taoyu051818-sys/lian-platform-server/issues?q=is%3Aissue%20state%3Aopen), and recent merged pull requests. Closed issues and files under `docs/agent/tasks/`, `docs/agent/handoffs/`, or `docs/archive/` are historical context, not active scope.
