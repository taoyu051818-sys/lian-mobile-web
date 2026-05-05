# Task: High-Risk Refactor Execution Plan

Status: **Ready for review**

Date: 2026-05-02

Reference: `docs/agent/references/HIGH_RISK_AREAS.md`

## Goal

Turn the six high-risk investigation areas into controlled implementation tracks.

The goal is not to refactor everything immediately. The goal is to make future implementation threads safe by defining:

- order of work;
- smallest safe cuts;
- required tests before edits;
- acceptance criteria;
- rollback rules;
- boundaries between unrelated areas.

## Core Rule

Every high-risk task must follow this sequence:

```text
baseline observation
→ characterization tests / smoke tests
→ narrow behavior-preserving refactor
→ validation
→ handoff
→ only then product behavior changes
```

Do not combine behavior changes with structural refactors in the same PR unless explicitly approved.

## Priority Order

| Priority | Track | Reason | First Deliverable |
|---|---|---|---|
| P0 | Runtime safety gates | Protects all future work | smoke/check scripts and baseline snapshots |
| P1 | `post-metadata.json` write safety | metadata is shared by feed/map/publish/audience | serialized writes or write queue |
| P1 | `api-router.js` route safety | every new feature touches routing | route matcher tests and route table extraction |
| P1 | Audience/auth hydration | current permission checks rely on missing `schoolId` | normalize current user for audience checks |
| P2 | NodeBB integration contracts | prevents uid/auth mistakes | endpoint contract smoke tests |
| P2 | Frontend script load order | prevents homepage blank screens | script-order smoke and duplicate helper plan |
| P3 | Feed scoring cleanup | high blast radius, less urgent than correctness | shared scoring primitive + snapshot diff |
| P3 | Auth modularization | important but risky; not blocking current product flow | extract mail transport after tests |

## Track 0: Runtime Safety Gates

### Problem

The codebase has multiple global/runtime coupling points:

- classic-script frontend globals;
- hand-written router;
- NodeBB endpoint assumptions;
- JSON file storage;
- feed scoring side effects.

### Scope

Add or strengthen tests and smoke checks before any large refactor.

### First implementation cut

- Ensure `scripts/smoke-frontend.js` covers:
  - all frontend script URLs are reachable;
  - key globals exist after load;
  - no obvious mojibake in core Chinese labels;
  - `+` opens Publish page;
  - `messages/profile` view can render.
- Add a route smoke script or test table for `api-router.js` paths.
- Add metadata backup/snapshot command before metadata write changes.

### Acceptance

- One command can run before high-risk PRs and catch app-shell breakage.
- Smoke output is clear enough for deploy checks.
- Failing smoke blocks high-risk merges.

### Do Not

- Do not rewrite frontend module format.
- Do not introduce a bundler in this track.
- Do not change feed ranking.

## Track 1: `post-metadata.json` Write Safety

### Problem

`post-metadata.json` is read/written by publish, AI publish, admin, feed, and map. Current patch writes are shallow merges, and concurrent writes can lose data.

### First implementation cut

Behavior-preserving safety only:

1. Add a per-process metadata write queue or mutex around `patchPostMetadata`.
2. Write through temp file + atomic rename if not already guaranteed by helper.
3. Before write, validate the full object remains JSON and preserves existing keys.
4. Add backup to `outputs/metadata-backup-<timestamp>.json` for manual/admin write paths.

### Acceptance

- Existing publish flows still write the same metadata fields.
- Concurrent simulated patch calls do not drop either patch.
- `node scripts/validate-post-metadata.js` passes.
- No pretty-print churn or full-file reformat unless explicitly approved.

### Rollback

- Revert only data-store write-queue changes.
- Keep metadata backup files out of commits unless they are intentional fixtures.

## Track 2: `api-router.js` Route Safety

### Problem

`api-router.js` is an if-else chain with manual path matching. New route additions can shadow or miss paths.

### First implementation cut

Behavior-preserving route table extraction:

1. Create a small route matcher helper inside `api-router.js` or adjacent module.
2. Keep existing handler signatures.
3. Add tests for known paths:
   - `/api/feed`
   - `/api/posts/:tid`
   - `/api/posts/:tid/replies`
   - `/api/posts/:tid/like`
   - `/api/posts/:tid/save`
   - `/api/messages`
   - `/api/channel`
   - `/api/map/v2/items`
   - `/api/ai/post-preview`
   - `/api/ai/post-publish`
4. Only after route tests exist, consider grouping route registrations by domain.

### Acceptance

- All existing routes resolve to the same handlers.
- Unknown routes still return 404.
- No handler signature migration in the first cut.

### Do Not

- Do not migrate to Express/Fastify in this phase.
- Do not combine route refactor with Publish V2 or NodeBB notification behavior changes.

## Track 3: Audience/Auth Hydration

### Problem

Audience docs say `schoolId` is derived from `institution` at read time, but real auth users often do not carry `schoolId`. Permission checks using `user.schoolId` can fail.

### First implementation cut

Add a single normalization boundary:

```text
auth user from store
→ audience-ready user object
→ canViewPost / canReplyToPost / canCreatePostWithAudience
```

Recommended helper:

```js
hydrateAudienceUser(user)
```

It should derive:

- `schoolId` from `institution`;
- `orgIds` as `[]` when missing;
- `roleIds` as `[]` when missing.

### Acceptance

- Existing `publicAuthUser()` behavior is unchanged unless explicitly desired.
- `canViewPost()` works for users with only `institution`.
- Audience tests include a real registered-user shape with no stored `schoolId`.

### Do Not

- Do not introduce database-backed organizations in this cut.
- Do not implement write-side audience enforcement in the same PR unless scoped separately.

## Track 4: NodeBB Integration Contracts

### Problem

NodeBB calls depend on endpoint shape, `_uid`, and auth header mode. Mistakes cause user identity bugs, rate limits, or notification leaks.

### First implementation cut

Add contract smoke tests for installed NodeBB:

- vote/unvote first post;
- bookmark/unbookmark first post;
- user bookmarks list;
- user upvoted list;
- topic detail with user `_uid`;
- notifications with current user `_uid`;
- reply create fallback endpoint.

### Acceptance

- Each smoke test prints endpoint, method, uid mode, status, and response shape.
- Failures do not mutate LIAN metadata.
- No API token is printed.

### NodeBB Reply Notifications Cut

This is now a product-approved next cut:

- `/api/messages` must be current-user scoped.
- NodeBB replies/comments can enter messages as `讨论` / `回复` / `通知`.
- Messages page is not private chat.
- Notifications must be audience-filtered before return.

Use the task board entry `NodeBB Reply Notifications In Messages Page` for implementation details.

## Track 5: Frontend Script Load Order

### Problem

Frontend files are classic scripts with globals. `displayImageUrl`, `escapeHtml`, and `api` are duplicated in different scopes.

### First implementation cut

Add guardrails before cleanup:

1. Add a script-order smoke test.
2. Assert required globals after load:
   - `state`
   - `api`
   - `openDetail`
   - `loadMessages`
   - `loadProfile`
   - `window.MapV2`
   - `publishPageOpen`
3. Document which helpers are canonical:
   - `app-utils.js` owns app-wide `api`, `escapeHtml`, `displayImageUrl`, upload/compression helpers.
   - `map-v2.js` may keep private IIFE helpers, but must not export conflicting globals.

### Acceptance

- No blank homepage after script order changes.
- No duplicate global helper introduction.
- Browser smoke passes.

### Do Not

- Do not convert to ESM/bundler in the first cleanup cut.
- Do not merge split files back into `app.js`.

## Track 6: Feed Scoring Cleanup

### Problem

`scoreItem()` and `scoreBreakdown()` duplicate scoring logic. `momentScoreItem()` has hardcoded weights.

### First implementation cut

Observation and extraction only:

1. Run feed snapshots before changes.
2. Extract shared scoring components without changing final scores.
3. Make `scoreBreakdown()` reuse the same component calculations as `scoreItem()`.
4. Keep `momentScoreItem()` behavior unchanged in first cut.

### Acceptance

- Snapshot diff shows no unexpected item order changes for the same inputs.
- `feed-debug` still explains all current score fields.
- No `feed-rules.json` tuning in the same PR.

### Do Not

- Do not change ranking weights in the refactor PR.
- Do not combine with audience filtering or metadata schema work.

## Track 7: Auth Modularization

### Problem

`auth-service.js` handles password hashing, sessions, NodeBB uid mapping, email verification, SMTP, invites, and public user serialization.

### First implementation cut

Extract only mail transport after tests:

- `sendMail`
- `sendResendMail`
- `sendSmtpMail`

Keep exported behavior identical.

### Acceptance

- Register/email-code flow still works.
- SMTP and Resend failure messages remain compatible.
- No password/session format changes.

### Do Not

- Do not change password hashing.
- Do not change session cookie format.
- Do not change invite cascade behavior without a separate review.

## Merge Rules

Each PR may touch only one high-risk track, except Track 0 smoke tests may accompany a track if they are strictly additive.

Do not combine:

- feed scoring + metadata writes;
- router refactor + NodeBB behavior;
- auth changes + audience behavior;
- frontend script cleanup + Publish V2 UX;
- map editor + publish/map picker.

## Required Handoff

Every high-risk implementation thread must create or update a handoff with:

- track name;
- files changed;
- behavior changed or explicitly unchanged;
- baseline command results;
- validation command results;
- rollback instructions;
- remaining risks.

