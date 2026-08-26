# Task: RC1 B1 identity + community closure

Lifecycle: local-only implementation task based on frontend
`8e12abf140db1c4067b0cacd4463983fbf14a2be`. No push, merge, or deployment.

## Goal and product scope

Prove in one real browser page that A can log in and out, B can log in and reply as B, B can log out,
and A can log back in to see and mark only A's reply notification read without either account's inbox
or actor state leaking into the other.

The paired backend task is `lian-platform-server/docs/agent/tasks/rc1-b1-identity-community-closure.md`.
The backend migrated-auth fix `1c14c3832289a95e7bf6d4726602641ff9901361` is a parallel integration
prerequisite and is not reproduced here.

## Allowed files

- `src/api/notifications.ts`
- `src/features/messages/NotificationList.vue`
- `src/features/messages/useNotifications.ts`
- `src/types/messages.ts`
- `tests/messages/channel-read-payload.test.mjs`
- `tests/messages/notification-api-pagination-read.test.ts`
- `tests/messages/notification-relation-context.structure.test.ts`
- `tests/messages/useNotifications.test.ts`
- `tests/e2e/local/identity-community-fixture.ts`
- `tests/e2e/local/identity-community-journeys.spec.ts`
- `playwright.local.config.ts`
- this task and its matching handoff

## Forbidden

- Authentication/profile session implementation files; the journey consumes existing login/logout.
- Commerce/GD, LAPlatform, feed ranking, deploy interlocks, or production configuration.
- Production NodeBB, cookies, credentials, accounts, Redis, database, or network requests.
- Push, merge, release, or deployment.

## Contract and state

- Preserve backend `source: "lian" | "nodebb"` on normalized notifications.
- Preserve a positive backend reply `pid` as independent `NotificationItem.pid`; keep navigation on
  the existing `tid` detail target instead of inventing an unsupported reply anchor.
- Echo that source as `?source=` on the existing per-id read endpoint.
- Use `(source,id)` as notification identity for merge, Vue keys, optimistic local read state, and
  rollback so equal raw IDs from LIAN and NodeBB remain independent.
- Keep the existing one-argument read helper behavior for older/missing-source rows, but narrow the
  public mutation helper to one notification per call because a scalar source cannot safely describe
  a mixed-provider batch.
- Playwright data is an in-memory state object created once per test and discarded with the page.

## Acceptance and TDD

- [x] RED proves source is dropped by normalization/read calls before the change.
- [x] GREEN proves source preservation and provider-scoped read paths.
- [x] Adversarial RED/GREEN proves same-id LIAN/NodeBB rows both render and concurrent optimistic
      updates/rollback affect only the selected provider identity.
- [x] Positive reply `pid` is preserved while the existing topic-detail `tid` target stays unchanged.
- [x] One same-page Playwright journey proves A -> B -> A identity/reply/inbox/read isolation.
- [x] Every API is intercepted on loopback and unexpected requests fail the journey.
- [x] Build and repository check pass.

## Cleanup and rollback

There is no external data cleanup. Revert the local frontend commit to remove the additive source
and pid fields, composite identity, query hint, browser fixture, and optional local browser-channel
override.
