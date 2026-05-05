# Task: Audience/Auth Hydration

## Goal

Create one canonical viewer context for Audience checks so real LIAN users with `institution`/`tags` but no stored `schoolId` are evaluated correctly.

## Product scope

This task makes school/campus/private/linkOnly visibility checks reliable across feed, detail, map, channel, messages, and post actions. It does not add new audience UI.

## Allowed files

- `src/server/audience-service.js`
- `src/server/auth-service.js`
- `src/server/feed-service.js`
- `src/server/map-v2-service.js`
- `src/server/post-service.js`
- `src/server/channel-service.js`
- `src/server/ai-light-publish.js`
- `scripts/test-audience.js`
- `docs/agent/tasks/audience-auth-hydration.md`
- `docs/agent/handoffs/audience-auth-hydration.md`

Only touch call sites that need the canonical viewer context.

## Forbidden files

- `public/*`
- `data/post-metadata.json`
- `data/feed-rules.json`
- `server.js`
- NodeBB group/category provisioning
- Database or ORM setup

## Data schema changes

None.

This task may define an internal normalized viewer object, but it must not require rewriting existing auth user records.

Recommended normalized shape:

```json
{
  "userId": "",
  "nodebbUid": null,
  "isGuest": false,
  "isAdmin": false,
  "isVerifiedStudent": false,
  "institution": "",
  "schoolId": "",
  "tags": [],
  "orgIds": [],
  "roles": []
}
```

## API changes

None.

## Acceptance criteria

- [x] Add `hydrateAudienceUser(user)` or equivalent in `audience-service.js`.
- [x] The hydration function handles guest/null users.
- [x] The hydration function derives canonical `schoolId` from existing `institution` and/or `tags`.
- [x] Existing real auth users without `schoolId` can pass school audience checks when their institution matches.
- [x] `orgIds` and `roles` are always arrays after hydration.
- [x] Admin users are explicitly represented in the hydrated viewer context.
- [x] `canViewPost()` and related permission functions use the hydrated viewer context or hydrate internally.
- [x] Feed, detail, map, channel, messages, like/save/report, and publish-related read checks do not each reimplement school derivation.
- [x] `linkOnly` semantics remain unchanged: no natural distribution to feed/map/channel, detail still checks base visibility.
- [x] Audience tests include real auth-store-shaped users with `institution` but no `schoolId`.

## Validation commands

```bash
node --check src/server/audience-service.js
node --check src/server/feed-service.js
node --check src/server/map-v2-service.js
node --check src/server/post-service.js
node --check src/server/channel-service.js
node scripts/test-audience.js
```

If setup fixtures are required:

```bash
node scripts/setup-audience-test.js
node scripts/test-audience.js
```

## Risks

- Risk: Changing hydration can unintentionally widen access. Mitigation: tests must include guest, external, school mismatch, campus-only, school match, private owner, and admin cases.
- Risk: Chinese school names can be encoded incorrectly. Mitigation: preserve UTF-8 and avoid manual double-encoding.
- Risk: Call sites can forget hydration. Mitigation: make permission functions hydrate internally when practical.

## Rollback plan

- Revert the hydration helper and call-site updates.
- Restore previous audience test expectations.
- Re-run audience and metadata validation before continuing implementation.

---

## Review Blockers Added 2026-05-03

This task is now the required fix lane for the Audience System Phase 1-3 review.

Findings:

- `getCurrentUser()` currently returns the raw auth-store user. It does not reliably add `schoolId`, `orgIds`, or role arrays before audience checks.
- `canViewPost()` and related checks depend on those normalized fields. Real users with only `institution` or `tags` may fail school-scoped visibility checks.
- Save, like, report, profile history, map items, channel messages, replies, and detail access all depend on the same viewer context. The fix must be centralized, not reimplemented at each call site.
- Public text-only posts created through `/api/posts` may not get baseline metadata written, because metadata patching is conditional on image/map/non-public fields. That should be fixed in the metadata write safety lane or this audience correctness pass if it touches the same creation path.

Acceptance additions:

- [x] `getCurrentUser()` or a shared audience helper returns a canonical viewer shape for all authenticated and guest users.
- [x] Matching school users with only `institution` and no stored `schoolId` pass school visibility checks.
- [x] External users do not pass school visibility checks.
- [x] Admin override remains explicit and tested.
- [x] `orgIds` and roles are arrays even when absent in stored auth records.
- [x] Audience checks for feed, detail, map, reply, like/save/report, profile saved/liked/history, and channel use the same hydrated viewer logic.
- [ ] Public text-only `/api/posts` creations still write baseline `visibility` and `audience` metadata after NodeBB topic creation.

---

## Review Result Added 2026-05-03

Lane D status: accepted with follow-up.

Verified:

- `hydrateAudienceUser()` exists in `src/server/audience-service.js`.
- `canViewPost()`, `canModeratePost()`, `canCreatePostWithAudience()`, and `canSeeAudienceOption()` hydrate internally.
- Raw auth-store-shaped users with `institution` and no `schoolId` pass matching-school checks.
- `node scripts/test-audience-hydration.js` passed 61/61.

Validation run:

```bash
node --check src/server/audience-service.js
node scripts/test-audience-hydration.js
```

Follow-up:

- `audience.roleIds` is normalized but not used in `canViewPost()` private visibility checks. This is not blocking the school-hydration goal, but it must be handled before role-scoped audience is productized.
- Public text-only `/api/posts` baseline metadata write remains a separate follow-up.

---

## Fix Pass Result Added 2026-05-03

Status: fixed, pending reviewer spot check.

Recorded implementation result:

- Audience hydration blocker is already resolved by Lane D.
- `hydrateAudienceUser()` auto-hydrates raw auth users in all permission functions.
- The broader fix pass reports 143/143 tests passing.
- `/api/posts` baseline metadata follow-up is reported fixed in `src/server/post-service.js`: topic creation now always writes `visibility` and `audience`.

Reviewer validation:

```bash
node scripts/test-audience-hydration.js
node scripts/test-routes.js
```

Spot check still recommended:

- Create a public text-only post through `/api/posts`.
- Confirm its `post-metadata.json` entry contains baseline `visibility` and `audience`.
