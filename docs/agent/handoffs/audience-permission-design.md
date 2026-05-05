# Handoff: audience-permission-design

Date: 2026-05-02

## Summary

Designed LIAN's audience/permission model for multi-school and multi-organization visibility.

## Files changed

| File | Change |
|---|---|
| `docs/agent/domains/AUDIENCE_SYSTEM.md` | New. Full design document. |
| `docs/agent/tasks/audience-permission-design.md` | Audit checklist items verified. |

## Design outputs

1. **Audience schema**: `visibility`, `schoolIds`, `orgIds`, `roleIds`, `userIds`, `linkOnly`
2. **5 permission functions**: `canViewPost`, `canCreatePostWithAudience`, `canReplyToPost`, `canModeratePost`, `canSeeAudienceOption`
3. **8 enforcement points**: feed, feed-debug, detail, replies, map, search, channel, notifications
4. **NodeBB mirror strategy**: school/org → NodeBB groups, 3 categories (Public/Campus/Private)
5. **Leakage analysis**: raw NodeBB links bypass LIAN checks, mitigated by category restrictions
6. **5-phase migration**: add field → add schoolId → enforce read → enforce write → NodeBB sync

## What was intentionally not done

- No runtime code changes
- No data schema changes
- No API changes

## Risks

- Design is on paper only; implementation may reveal edge cases
- `canViewPost` performance on large feeds needs caching strategy
- NodeBB group sync complexity depends on NodeBB API capabilities

## Rollback

Delete `docs/agent/domains/AUDIENCE_SYSTEM.md`.

## Next suggested task

Phase 1 implementation: add `audience` field to post-metadata and `schoolId` to user model.
