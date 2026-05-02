# Handoff: nodebb-integration-audit

Date: 2026-05-02

## Summary

Audited all NodeBB integration points and added Failure Modes section to `NODEBB_INTEGRATION.md`.

## Files changed

| File | Change |
|---|---|
| `docs/agent/domains/NODEBB_INTEGRATION.md` | Added Failure Modes section (connection, auth, topic creation, metadata write, reply fallback, channel, feed read, notifications) |
| `docs/agent/tasks/nodebb-integration-audit.md` | Marked all 10 audit checklist items as done |

## Audit findings

All 10 checklist items verified against code:

1. **Auth**: read ops use `x-api-token`, write ops use explicit `Authorization: Bearer`
2. **_uid**: `addUid()` appends default `_uid`, `withNodebbUid()` sets specific user uid
3. **Regular publish**: uses current user's `nodebbUid` via `ensureNodebbUid()`
4. **AI publish**: same path as regular publish through `createNodebbTopicFromPayload()`
5. **Replies**: tries v3 endpoint first, falls back to legacy on 404/405
6. **Channel**: replies to fixed topic if `CHANNEL_TOPIC_TID` set, otherwise creates new topic
7. **Feed**: `/api/recent` for index, `/api/topic/:tid` for detail, cached 60s/180s
8. **Notifications**: `/api/notifications`, errors return empty list
9. **User lookup**: search by username, create via `POST /api/v3/users` if not found
10. **Failure modes**: documented all error paths and metadata write behavior

## What was intentionally not done

- No runtime smoke tests (read-only audit only)
- No changes to any runtime code
- No changes to NodeBB configuration

## Risks

None. Documentation only.

## Rollback

Revert changes to `docs/agent/domains/NODEBB_INTEGRATION.md` and `docs/agent/tasks/nodebb-integration-audit.md`.

## Next suggested task

Audience Permission Design (`docs/agent/tasks/audience-permission-design.md`) — now has a verified integration baseline to build on.
