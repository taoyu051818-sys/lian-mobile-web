# Current Status

Last verified: 2026-08-10

Active control issue: [#1086](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1086).

Open release blockers: None recorded as open GitHub issues.

Current production release: Not recorded in this repository.

**Active execution queue:** F2a detail navigation monotonic request generation.

- Task: `docs/agent/tasks/detail-navigation-monotonic-request-generation.md`.
- Branch: `codex/audit-f2a-detail-request-generation`.
- Scope: local reducer/tests/docs only; no API, DOM, backend, production,
  deployment, or persisted-data change.

Local audit baseline:

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
