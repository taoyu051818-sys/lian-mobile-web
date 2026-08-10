# Current Status

Last verified: 2026-08-10

Active control issue: [#1085](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1085).

Open release blockers: None recorded as open GitHub issues.

Current production release: Not recorded in this repository.

**Active execution queue:** F1 Profile session-scoped notification state.

- Task: `docs/agent/tasks/audit-f1-profile-session-state.md`.
- Branch: `codex/audit-f1-profile-session-state`.
- Scope: local frontend implementation and validation only; no push, merge,
  deploy, backend change, or persisted browser-data migration.

Local audit baseline:

- Branch `codex/audit-b0-quality-gate`, commit `fb3eef5`.
- B0 quality gate accepted locally: 154 Vitest files / 3,946 tests and
  65 Node structure files / 817 tests passed; sanitizer, build, smoke, and
  full `npm run verify` also passed.
- This local commit has not been pushed, merged, or deployed.

Before starting new work, query [open frontend issues](https://github.com/taoyu051818-sys/lian-mobile-web/issues?q=is%3Aissue%20state%3Aopen), [open backend issues](https://github.com/taoyu051818-sys/lian-platform-server/issues?q=is%3Aissue%20state%3Aopen), and recent merged pull requests. Closed issues and files under `docs/agent/tasks/`, `docs/agent/handoffs/`, or `docs/archive/` are historical context, not active scope.
