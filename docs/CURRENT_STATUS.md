# Current Status

Last verified: 2026-08-23

Active control issue: [#1097](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1097)
for the Actor-backed cart MVP. Workflow governance issue
[#1098](https://github.com/taoyu051818-sys/lian-mobile-web/issues/1098) is implemented by the
CI-consolidation change that publishes this status.

Open release blockers: No release has been requested. The Actor/Cart vertical slice, its local
provider path, and cross-repository verification must pass before any release proposal.

Current production release: None recorded. The project is not launched and all commerce exposure
flags remain default-off.

**Active execution queue:**

- Frontend `#1097`: implement strict Actor initialization, SKU selection and cart read/set/delete
  without adding quote, checkout, order or payment.
- LIAN backend `#943`: make the local backend/test baseline self-contained without changing public
  contracts or authentication behavior.
- GDPlatform `#3`: provide a production-closed local Actor/Cart policy seam and formal migration
  status/apply path while retaining signed assertions, exact scopes and idempotency.

## Accepted baseline

- The implementation base `643acae` contains the accepted offline commerce fixtures and restored
  frontend CI from PR `#1096`.
- The CI-consolidation change retains one authoritative full PR verification workflow and the
  deterministic local E2E gate; deployment and online canary remain explicit manual actions.
- Anonymous store and product discovery is implemented behind default-off frontend/backend/provider
  flags. Actor and cart UI are not part of that accepted baseline.
- On 2026-08-23 the unchanged full `npm run verify` command passed in the CI-consolidation worktree:
  184 Vitest files / 4,957 tests, 68 Node files / 858 tests, sanitizer, production builds and three
  loopback smoke checks.
- The local Playwright PR gate remains a separate automatic pull-request workflow. No production
  host, credential, feature flag or external service was changed by the active work.

## Coordination rule

Before starting new work, query [open frontend issues](https://github.com/taoyu051818-sys/lian-mobile-web/issues?q=is%3Aissue%20state%3Aopen),
[open backend issues](https://github.com/taoyu051818-sys/lian-platform-server/issues?q=is%3Aissue%20state%3Aopen),
and [recent merged pull requests](https://github.com/taoyu051818-sys/lian-mobile-web/pulls?q=is%3Apr%20is%3Amerged).
Closed issue documents and older handoffs are reference material, not an execution queue.
