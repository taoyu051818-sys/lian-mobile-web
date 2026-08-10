# Current Status

Last verified: 2026-08-10

Active control issue: [#1090](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1090)
(F2h is accepted locally under a local-only task contract; network and
production access remain paused, so no F2h issue was created online).

Open release blockers: None recorded as open GitHub issues.

Current production release: Not recorded in this repository.

**Active execution queue:**

- F3a stable Feed item-identity merge is planned locally under
  `docs/agent/tasks/feed-stable-item-identity-merge.md`. Its runtime scope is
  limited to client-side duplicate-`tid` projection; no implementation has
  started yet.
- The Feed read-only audit also recorded follow-up batches for cursor
  pagination, account-scoped read history, Feed/Detail reaction
  reconciliation, auto-load recovery, request intents, page restoration, and
  truthful context-menu actions. They are not part of F3a.
- F2h normal publish-success actionable-result rendering is accepted locally
  under `docs/agent/tasks/publish-success-actionable-result-render.md`.
- F2g immutable Publish submit snapshot and response ownership is accepted
  locally under `docs/agent/tasks/publish-submit-snapshot-ownership.md`.
- The next bounded audit moves to the Feed page/module. Event creation
  idempotency remains a coordinated frontend/backend follow-up, not an F2h
  change.
- F2g does not claim Event idempotency, mounted auth refresh, true network
  cancellation, or server-side side-effect reversal are complete.
- Scope is local frontend code and tests only. No push, deployment, production
  mutation, or online environment check is authorized.

Local audit baseline:

- F2h Publish success actionable-result rendering accepted locally on
  `codex/audit-f2h-publish-success-preview`; implementation commit `e5e2c65`.
- F2h validation passed: 161 Vitest files / 4,078 tests, 65 Node structure
  files / 820 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Three independent reviewers recorded `ACCEPT` with no
  blocking finding.
- F2g Publish submit snapshot/response ownership accepted locally on
  `codex/audit-f2g-publish-submit-snapshot`; implementation commit `ea0c29e`.
- F2g validation passed: 160 Vitest files / 4,067 tests, 65 Node structure
  files / 819 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Two independent reviewers recorded `ACCEPT`; a separate
  reachability review reported no blocking finding.
- F2f Publish image-upload ownership/order accepted locally on
  `codex/audit-f2f-publish-image-upload-ownership`; implementation commit
  `8847203`.
- F2f validation passed: 159 Vitest files / 4,052 tests, 65 Node structure
  files / 817 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Two independent reviewers recorded `ACCEPT`; a separate
  reachability review reported no blocking finding.
- F2e Publish draft account-scope re-entry accepted locally on
  `codex/audit-f2e-publish-draft-scope-reentry`; implementation commit
  `d93721e`.
- F2e validation passed: 158 Vitest files / 4,031 tests, 65 Node structure
  files / 817 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Two independent reviewers recorded `ACCEPT`.
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
