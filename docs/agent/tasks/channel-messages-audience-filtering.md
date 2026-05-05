# Task: Channel And Messages Audience Filtering

## Goal

Prevent `/api/channel` and message-related timelines from leaking school, private, organization-like, or linkOnly content outside the intended audience.

## Product scope

This task protects the discussion surface. It keeps the channel timeline useful while making it respect the same audience model as feed, detail, and map.

## Allowed files

- `src/server/channel-service.js`
- `src/server/audience-service.js`, only for existing helper reuse or a small `channel` surface alias
- `public/app-messages-profile.js`, only if labels or separate sections need adjustment
- `docs/agent/tasks/channel-messages-audience-filtering.md`
- `docs/agent/handoffs/channel-messages-audience-filtering.md`

## Forbidden files

- `data/post-metadata.json`
- `data/feed-rules.json`
- `src/server/feed-service.js`
- `src/server/post-service.js`
- `server.js`
- NodeBB plugin code

## Data schema changes

None.

## API changes

No new endpoints.

Existing endpoint behavior:

- `GET /api/channel` should continue returning the channel timeline, but with audience filtering applied.

## Acceptance criteria

- [x] `handleChannel()` resolves the current viewer when possible.
- [x] Channel items tied to a topic run through `canViewPost()` before being returned.
- [x] `linkOnly` content does not appear in channel natural distribution.
- [x] School-only content appears only to matching school viewers.
- [x] Private or organization-like content does not appear to non-owners/non-members.
- [x] Guest users see only public channel-eligible content.
- [x] `/api/channel` remains distinct from `/api/messages`.
- [x] If a topic cannot be audience-checked safely, default to hiding it from the channel timeline instead of leaking it.

## Validation commands

```bash
node --check src/server/channel-service.js
node --check src/server/audience-service.js
node scripts/test-audience.js
```

Manual smoke:

```text
1. Create or use existing public, campus, school, private, org-like, and linkOnly test posts.
2. Load /api/channel as guest, school A user, school B user, owner, and admin.
3. Confirm visibility matches feed/detail expectations.
4. Confirm linkOnly is absent from channel even when detail is accessible by direct link.
```

## Risks

- Risk: Channel may look empty for users with no eligible content. Mitigation: add safe empty states in frontend or leave existing channel fallback messaging.
- Risk: Channel filtering may be confused with feed ranking. Mitigation: do not score or rank differently in this task.
- Risk: Current auth may be optional for channel. Mitigation: support guest viewer context.

## Rollback plan

- Revert channel filtering changes.
- Keep any new audience tests that expose real leakage as regression tests for the next attempt.

---

## Review Result Added 2026-05-03

Lane G status: accepted with follow-up.

Verified:

- `handleChannel()` receives `req` and resolves the current user when possible.
- Guest access is preserved.
- Topics with metadata are filtered through `canViewPost(viewer, { visibility, audience }, "map")`.
- linkOnly content is excluded from channel natural distribution.
- `/api/channel` remains distinct from `/api/messages`.

Validation run:

```bash
node --check src/server/channel-service.js
node --check src/server/api-router.js
node scripts/test-routes.js
node scripts/test-audience-hydration.js
```

Follow-up:

- `handleChannel()` currently slices recent topics before audience filtering. This means a page can return fewer than `limit` visible events when hidden topics occupy the selected slice. A later fix should scan recent topics until it fills the requested visible limit or exhausts available topics.
- The comment says channel is a distribution surface like feed/map and uses `"map"` as context. This is acceptable for linkOnly exclusion, but a future `"channel"` context would be clearer if channel-specific rules diverge.
