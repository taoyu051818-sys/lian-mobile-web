# NodeBB Contract Smoke Tests

Date: 2026-05-02

## Thread Scope

Created diagnostic smoke script for NodeBB endpoint verification. Read-only by default, optional write mode.

## Files Created

| File | Purpose |
|---|---|
| `scripts/smoke-nodebb-contracts.js` | Diagnostic smoke script for NodeBB endpoints |

## Files Modified

| File | Change |
|---|---|
| `docs/agent/domains/NODEBB_INTEGRATION.md` | Added smoke test findings, corrected auth behavior table |

## Key Findings

### Auth Requirements (CRITICAL)

| Endpoint | x-api-token | Bearer |
|---|---|---|
| `GET /api/recent` | ✓ | ✓ |
| `GET /api/topic/:tid` | ✓ | ✓ |
| `GET /api/tags` | ✓ | ✓ |
| `GET /api/notifications` | ✗ 401 | ✓ |
| `GET /api/user/:slug/bookmarks` | ✗ 401 | ✓ |
| `GET /api/user/:slug/upvoted` | ✗ 401 | ✓ |

`nodebbFetch` auto-adds `x-api-token` which works for feed/topic reads. Notifications, bookmarks, and upvoted require `Authorization: Bearer`. LIAN code calling these endpoints must pass explicit Bearer header.

### Endpoint Shapes

**Notifications** (`GET /api/notifications`):
- Response: `{ notifications: [...], pagination: {...}, filters: [...] }`
- Notification keys: `from`, `bodyShort`, `nid`, `path`, `bodyLong`, `type`, `datetime`, `user`, `image`, `read`, `readClass`

**Topic Detail** (`GET /api/topic/:tid`):
- First post includes: `pid`, `upvotes`, `downvotes`, `votes`, `bookmarked`, `upvoted`, `downvoted`, `selfPost`, `topicOwnerPost`, `display_edit_tools`, `display_delete_tools`, `display_moderator_tools`
- `bookmarked`/`upvoted` are boolean per current `_uid` user

**Bookmarks/Upvoted** (`GET /api/user/:slug/bookmarks`, `/upvoted`):
- Response is user profile object; bookmark/upvote list may be in sub-property or empty

## Validation

```
node --check scripts/smoke-nodebb-contracts.js    ✓
node scripts/smoke-nodebb-contracts.js             4/4 pass (read-only)
```

Write mode: `NODEBB_SMOKE_WRITE=1 node scripts/smoke-nodebb-contracts.js`

## Safety

- Read-only by default — no mutations
- Write mode gated by `NODEBB_SMOKE_WRITE=1`
- Write mode labels test artifacts with `[LIAN SMOKE TEST]`
- No tokens printed in output (redacted in error messages)
- Test reply/pid printed for manual cleanup if write mode was used

## Next Steps

- Lane F (Messages) can use findings to correctly call notifications endpoint with Bearer auth
- Lane G (Channel) can proceed
- Lane H (Map picker) can proceed
