# Current Status

Last verified: 2026-08-11

Active control issue: [#1090](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1090)
(F3i is accepted locally under a local-only task contract; external-network and
production access remain paused, so no F3i issue was created online).

Open release blockers: None recorded as open GitHub issues.

Current production release: Not recorded in this repository.

**Active execution queue:**

- F3i mounted Detail reaction settlement consumption is accepted locally under
  `docs/agent/tasks/detail-reaction-settlement-consumer.md`; implementation
  commit `e78a855`. Current authoritative Footer Like, Context Save, and Detail
  Like/Save settlements now project into the current mounted Detail owner. Physical
  Detail requests use request-local sequence boundaries, while ready projection
  preserves the exact post identity and unrelated Detail interactions.
- F3h Feed Footer Like settlement publication is accepted locally under
  `docs/agent/tasks/feed-footer-like-settlement-publication.md`; implementation
  commit `956eff8`. A current authoritative Footer Like result now reaches the
  mounted Feed owner while same-`tid` refresh supplies the latest rollback
  baseline and real owner transitions or disposal permanently stale old work.
- F3g Feed context-menu Save settlement publication is accepted locally under
  `docs/agent/tasks/feed-context-save-settlement-publication.md`;
  implementation commit `64a7603`. An authoritative context-menu Save result
  now reaches the mounted Feed owner. Exact same-`tid` reaction-only shallow
  replacements preserve the independent Save/Share owner tickets, while real
  card replacements still invalidate them.
- F3f Detail-origin reaction settlement projection is accepted locally under
  `docs/agent/tasks/feed-detail-reaction-settlement-projection.md`;
  implementation commit `e804e46`. Current authoritative Detail Like/Save
  results now reach the mounted Feed, and a physical Feed response can only
  overwrite settlements that predate that request's transport boundary.
- F3e truthful Feed card context actions are accepted locally under
  `docs/agent/tasks/feed-card-context-action-truthfulness.md`; implementation
  commit `e917b8b`. A 360 ms hold now opens the owned custom menu, controls and
  replacement cards are isolated, bookmark state is server-authoritative,
  sharing uses the canonical helper, and Report truthfully navigates to Detail.
- F3d bounded Feed auto-load sentinel recovery is accepted locally under
  `docs/agent/tasks/feed-auto-load-sentinel-recovery.md`; implementation commit
  `750973b`. Disabled/cooldown-lost intersections now reconcile once, while one
  continuous residency still cannot form an automatic request loop.
- F3c Feed request-intent and stale-data policy is accepted locally under
  `docs/agent/tasks/feed-request-intent-stale-data-policy.md`; implementation
  commit `fab9dc3`. Pull refresh now preserves committed data, append retry
  owns the failed page, and every request/dispose path is generation guarded.
- F3b account-scoped Feed/Profile read history is accepted locally under
  `docs/agent/tasks/feed-read-history-account-scope.md`; implementation commit
  `05a0fe8`. Guest/account history is isolated, old unowned history is ignored
  but preserved, and late Feed/Profile account transitions are generation
  guarded.
- F3a stable Feed item-identity merge is accepted locally under
  `docs/agent/tasks/feed-stable-item-identity-merge.md`; implementation commit
  `70cc4e3`. Its runtime scope is limited to client-side duplicate-`tid`
  projection.
- The Feed read-only audit also recorded follow-up batches for cursor
  pagination, Profile/cross-tab/account reaction reconciliation, and page
  restoration. They are not part of F3a-F3i.
- F2h normal publish-success actionable-result rendering is accepted locally
  under `docs/agent/tasks/publish-success-actionable-result-render.md`.
- F2g immutable Publish submit snapshot and response ownership is accepted
  locally under `docs/agent/tasks/publish-submit-snapshot-ownership.md`.
- Profile, reload/remount, cross-tab, account-epoch, server-revision,
  cursor-pagination, and page-restoration work remain separate. Cursor
  pagination and Event creation idempotency remain coordinated API/backend
  follow-ups, not F3i changes.
- F2g does not claim Event idempotency, mounted auth refresh, true network
  cancellation, or server-side side-effect reversal are complete.
- Scope is local frontend code and tests only. No push, deployment, production
  mutation, or online environment check is authorized.

Local audit baseline:

- F3i mounted Detail reaction settlement consumption accepted locally on
  `codex/audit-f3i-detail-reaction-consumer`, building on accepted F3h head
  `72768cf`; task commit `f46e171`, red-test and inventory commit `15fdfbb`, and
  runtime implementation commit `e78a855`.
- F3i validation passed: the new behavior suite 45/45, nine focused files
  239/239, the new structure plus Detail feedback suites 12/12, 171 Vitest files
  / 4,331 tests, 66 Node structure files / 839 tests, production build (647
  transformed modules / PWA 71 entries), HTML sanitizer, 3 hermetic localhost
  loopback smoke checks, and full `npm run verify` with exit 0 in about 129.6
  seconds. Two independent reviewers recorded `ACCEPT` with no blocking
  finding.
- F3h Feed Footer Like settlement publication accepted locally on
  `codex/audit-f3h-feed-footer-like`, building on accepted F3g head `3a56e12`;
  task commit `e217f6e`, red-test and inventory commit `d67b320`, and runtime
  implementation commit `956eff8`.
- F3h validation passed: the new behavior suite 42/42, four F3e-F3h behavior
  files 140/140, eight core acceptance files 177/177, the structure suite
  20/20, 30/30 related Footer tests, 170 Vitest files / 4,286 tests, 65 Node
  structure files / 830 tests, production build (647 transformed modules / PWA
  71 entries), HTML sanitizer, 3 loopback smoke checks, and full
  `npm run verify` with exit 0 in about 97.4 seconds. Two independent reviewers
  recorded `ACCEPT` with no blocking finding.
- F3g Feed context-menu Save settlement publication accepted locally on
  `codex/audit-f3g-feed-context-save`, building on accepted F3f head `2d0dd21`;
  task commit `3c53b3f`, red-test/inventory commit `80b05ac`, and runtime
  implementation commit `64a7603`.
- F3g validation passed: the new behavior suite 35/35, six focused acceptance
  files 100/100, the structure suite 16/16, 169 Vitest files / 4,244 tests,
  65 Node structure files / 826 tests, production build (646 transformed
  modules / PWA 71 entries), HTML sanitizer, 3 loopback smoke checks, and full
  `npm run verify` with exit 0 in about 141.9 seconds. Two independent
  reviewers recorded `ACCEPT` with no blocking finding.
- F3f Detail-origin reaction settlement projection accepted locally on
  `codex/audit-f3f-feed-detail-like-reconciliation`; task commit `bb33ef1`,
  red-test commit `6fc4bdd`, public-surface contract commit `d10090f`, owner
  predicate test commit `e2fd712`, and implementation commit `e804e46`.
- F3f validation passed: 168 Vitest files / 4,209 tests, 65 Node structure
  files / 824 tests, production build (646 modules / PWA 71 entries), HTML
  sanitizer, 3 loopback smoke checks, and full `npm run verify` in 94.8
  seconds. Two independent reviewers recorded `ACCEPT` with no blocking
  finding after the external-owner predicate test seam was strengthened.
- F3e truthful Feed card context actions accepted locally on
  `codex/audit-f3e-feed-context-actions`; task commit `855365b`, red-test commit
  `899bae6`, and implementation commit `e917b8b`.
- F3e validation passed: 167 Vitest files / 4,185 tests, 65 Node structure
  files / 824 tests, production build (644 modules / PWA 71 entries), HTML
  sanitizer, 3 loopback smoke checks, and full `npm run verify` in 96.3 seconds.
  Two independent reviewers recorded `ACCEPT` with no blocking finding after a
  stale touch-suppression edge was found, fixed, and reverified.
- F3d bounded Feed auto-load sentinel recovery accepted locally on
  `codex/audit-f3d-feed-auto-load-sentinel`; implementation commit `750973b`.
- F3d validation passed: 166 Vitest files / 4,144 tests, 65 Node structure
  files / 820 tests, production build (643 modules / PWA 71 entries), HTML
  sanitizer, 3 loopback smoke checks, and full `npm run verify` in 98.8 seconds.
  Three independent reviewers recorded `ACCEPT` with no blocking finding.
- F3c Feed request-intent ownership accepted locally on
  `codex/audit-f3c-feed-request-intents`; implementation commit `fab9dc3`.
- F3c validation passed: 165 Vitest files / 4,133 tests, 65 Node structure
  files / 820 tests, production build (643 modules / PWA 71 entries), HTML
  sanitizer, 3 loopback smoke checks, and full `npm run verify`. Two
  independent reviewers recorded `ACCEPT` with no blocking finding.
- F3b account-scoped Feed/Profile read history accepted locally on
  `codex/audit-f3b-read-history-scope`; implementation commit `05a0fe8`.
- F3b validation passed: 164 Vitest files / 4,112 tests, 65 Node structure
  files / 820 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Three independent reviewers recorded no blocking finding
  after Feed logical-completion, missing-ID, and keyed Profile-subtree fixes.
- F3a stable Feed item-identity merge accepted locally on
  `codex/audit-f3a-feed-actions`; implementation commit `70cc4e3`.
- F3a validation passed: 162 Vitest files / 4,084 tests, 65 Node structure
  files / 820 tests, build, sanitizer, 3 loopback smoke checks, and full
  `npm run verify`. Two independent reviewers recorded `ACCEPT`; one initially
  found and then verified the non-positive-ID contract boundary fix.
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
