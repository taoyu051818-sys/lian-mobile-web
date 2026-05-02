# Handoff: NodeBB Native Capability Inventory

Date: 2026-05-02

## What Was Done

Audited all 6 candidate NodeBB native capabilities against the 8-point checklist. Results added to `docs/agent/domains/NODEBB_INTEGRATION.md` under "Native Capability Audit (8-Point Checklist)".

## Key Findings

### Already Integrated

- **Like/Upvote**: First feed-card cut done. Uses `PUT/DELETE /api/v3/posts/:pid/vote` with fallback to `/votes`. Needs detail-page surface.
- **Read State**: Mark-read on detail open works. Uses `PUT /api/v3/topics/:tid/read` with fallback. Needs unread badge and history page.

### Not Integrated

- **Save/Bookmark**: Endpoint is `PUT/DELETE /api/v3/posts/:pid/bookmark`. Clean semantics, good first cut candidate.
- **Report/Flag**: Endpoint is `POST /api/v3/posts/:pid/flag`. Needs moderation queue UI before enabling broadly.
- **Topic Edit/Delete**: Endpoints exist (`PUT/DELETE /api/v3/topics/:tid/state`). Risk: metadata desync with `post-metadata.json`.
- **Groups/Categories**: Full CRUD endpoints exist. Blocked on audience permission design.

## Recommended First Cut Order

Per task doc recommendation:

1. **Report/Flag** — governance is foundational. Needs operator workflow first.
2. **Save/Bookmark** — helps users without changing public ranking. Low risk.
3. **Like (detail page)** — extend existing feed-card implementation to detail.
4. **Read State (unread badge)** — extend existing mark-read to show unread indicators.
5. **Groups/Categories** — blocked on audience implementation.

## Runtime Smoke Tests Needed

All [api]-marked findings need verification against the live NodeBB instance:

```bash
# Bookmark
curl -X PUT "$NODEBB/api/v3/posts/1/bookmark?_uid=2" -H "x-api-token: $TOKEN"
curl -X DELETE "$NODEBB/api/v3/posts/1/bookmark?_uid=2" -H "x-api-token: $TOKEN"

# Report
curl -X POST "$NODEBB/api/v3/posts/1/flag?_uid=2" -H "x-api-token: $TOKEN" -H "content-type: application/json" -d '{"reason":"test"}'

# Topic state
curl -X PUT "$NODEBB/api/v3/topics/1/state?_uid=2" -H "x-api-token: $TOKEN"
```

## Open Questions for Product Owner

1. Which capability is the first product cut? (Recommend: Save/Bookmark for lowest risk)
2. Where do operators see reports? (NodeBB admin only, or build LIAN moderation page?)
3. Should topic delete be soft-delete only, or allow hard delete?
4. What is the saved-list UI? (Profile section? Separate page?)

## Known Risks

- NodeBB endpoint shapes may differ by version. All [api] items need smoke tests.
- Report without moderation queue = dead-end reports. Must build operator workflow.
- Topic edit/delete without metadata sync = orphan metadata entries.
- Groups sync failure could lock users out of restricted content.
