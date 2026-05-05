# Audience System Phase 1-3: Schema + SchoolId + Read Enforcement

Date: 2026-05-02

## Thread Scope

Implemented Phases 1-3 of the audience permission migration plan (`docs/agent/domains/AUDIENCE_SYSTEM.md`):

- Phase 1: Add `audience` field to post metadata (backward-compatible)
- Phase 2: Derive `schoolId` from `institution` at read time
- Phase 3: Enforce `canViewPost` on feed, detail, map endpoints

Also created test infrastructure: 10 test users, 15 test posts, 3 scripts.

## Files Changed

### New files

| File | Purpose |
|---|---|
| `src/server/audience-service.js` | Permission module: `canViewPost`, `canCreatePostWithAudience`, `canReplyToPost`, `canModeratePost`, `canSeeAudienceOption`, `normalizeAudience`, `deriveSchoolId` |
| `scripts/setup-audience-test.js` | Creates 10 test users + 15 test posts with realistic Chinese content |
| `scripts/test-audience.js` | Integration tests: feed/detail/map/reply with 10 users × 15 posts |
| `scripts/cleanup-audience-test.js` | Removes all test data |
| `docs/agent/tasks/audience-test-users-and-posts.md` | Test plan document |
| `docs/agent/tasks/audience-system-test-plan.md` | Unit + integration test matrix |

### Modified files

| File | Change |
|---|---|
| `src/server/feed-service.js` | Import `canViewPost`, `getCurrentUser`. Add `currentUser` param to `isFeedEligible` and `feedFilterReason`. Resolve user in `handleFeed`, `handlePostDetail`, `handleFeedDebug`. Add `audience` to `normalizeTopic` output. `handlePostDetail` returns 403 if access denied. |
| `src/server/map-v2-service.js` | Import `canViewPost`, `getCurrentUser`. `handleMapV2Items` resolves user, passes to `mapPostsFromMetadata` which filters by `canViewPost`. |
| `src/server/post-service.js` | Import `normalizeAudience`, `deriveSchoolId`. `handleCreatePost` builds and writes `audience` to metadata. |
| `src/server/ai-light-publish.js` | Import `normalizeAudience`, `deriveSchoolId`. `normalizeAiPublishMetadata` generates `audience` object. `handleAiPostPublish` populates `schoolIds` for school visibility. |
| `src/server/channel-service.js` | Import `canReplyToPost`, `loadMetadata`. `handleCreateReply` loads post metadata, checks `canReplyToPost`, returns 403 if denied. |
| `src/server/api-router.js` | Pass `req` to `handleFeed(req, reqUrl, res)` and `handlePostDetail(req, tid, res)`. |

## API Changes

| Endpoint | Change |
|---|---|
| `GET /api/feed` | Now filters posts by `canViewPost(currentUser, post)`. Anonymous users only see `visibility: "public"` posts. |
| `GET /api/posts/:tid` | Returns 403 if `canViewPost` denies access. |
| `GET /api/map/v2/items` | Filters map posts by `canViewPost`. |
| `POST /api/posts` | Writes `audience` object to post metadata. |
| `POST /api/ai/post-publish` | Writes `audience` object to post metadata. |
| `POST /api/posts/:tid/replies` | Returns 403 if `canReplyToPost` denies access. |

## Data Schema Changes

### post-metadata.json

New optional field `audience` on post entries:

```json
{
  "audience": {
    "visibility": "public",
    "schoolIds": [],
    "orgIds": [],
    "roleIds": [],
    "userIds": [],
    "linkOnly": false
  }
}
```

Old posts without `audience` are handled by `normalizeAudience()` which falls back to the flat `visibility` string.

### auth-users.json

New optional fields on user objects (derived at read time, not written by this change):

- `schoolId`: mapped from `institution` via `deriveSchoolId()`
- `orgIds`: read from existing `orgIds` field (already present on some users)

## Validation Run

```
node --check src/server/audience-service.js    ✓
node --check src/server/feed-service.js        ✓
node --check src/server/map-v2-service.js      ✓
node --check src/server/post-service.js        ✓
node --check src/server/ai-light-publish.js    ✓
node --check src/server/channel-service.js     ✓
node --check src/server/api-router.js          ✓
node scripts/smoke-frontend.js                 21/21 pass
```

## Second-Round Fixes

Code review identified 4 issues, all resolved:

### 1. linkOnly+private leakage (audience-service.js)

**Bug**: linkOnly detail branch had `default: return Boolean(user)`, allowing any logged-in user to see private+linkOnly posts.

**Fix**: Added proper `private` case with `userIds`/`orgIds` checks; changed `default` to `return false`.

```javascript
// Before (bug):
default: return Boolean(user);

// After (fixed):
case "private":
  if (!user) return false;
  if (audience.userIds.length && audience.userIds.includes(user.id)) return true;
  if (audience.orgIds.length && user.orgIds && audience.orgIds.some((id) => user.orgIds.includes(id))) return true;
  return false;
default: return false;
```

### 2. Test expectation D18 (test-audience.js, audience-test-users-and-posts.md)

**Bug**: D18 expected 403 for anonymous accessing public+linkOnly detail. T12 is `visibility: "public"` + `linkOnly: true`. linkOnly is a distribution restriction (no feed/map), not an access restriction (detail uses base visibility). Anonymous should get 200.

**Fix**: Changed D18 expected from 403 to 200 in both test script and test plan doc.

### 3. Reply enforcement (channel-service.js)

**Bug**: `handleCreateReply` had no `canReplyToPost` check. Tests R3/R4/R5 would fail.

**Fix**: Added import of `canReplyToPost` and `loadMetadata`. After auth check, loads post metadata and calls `canReplyToPost(auth.user, postMeta)`. Returns 403 if denied.

### 4. Stale doc descriptions (AUDIENCE_SYSTEM.md)

**Bug**: Doc still said "display-only, not enforced" and used slug-based schoolIds (`cuc-hainan`) in NodeBB groups table.

**Fix**:
- Updated visibility description to "Phase 1-3: read-side enforced via `canViewPost`; write-side not yet enforced (Phase 4)"
- Updated NodeBB groups table to use Chinese short names, marked as Phase 5

## Decisions

1. **Backward compatibility via `normalizeAudience`**: Old posts without `audience` field are handled at read time by building an audience from the flat `visibility` string. No bulk migration needed.

2. **Canonical schoolId = Chinese short name**: `deriveSchoolId()` maps institution strings to `authInstitutions.tags[0]` (e.g., `中国传媒大学海南国际学院` → `中国传媒大学`). Not the future slug format (`cuc-hainan`).

3. **`handleFeed` signature change**: Added `req` as first parameter. Updated `api-router.js` call site accordingly.

4. **`handlePostDetail` signature change**: Added `req` as first parameter. Updated `api-router.js` call site.

5. **linkOnly = distribution restriction, not access restriction**: `canViewPost(user, post, context)` takes a `context` parameter:
   - `"feed"` / `"map"`: linkOnly always returns `false` (never distributed)
   - `"detail"` (default): linkOnly checks base visibility; public+linkOnly accessible to anyone with the link
   - Feed and map callers pass `"feed"` / `"map"` context; detail handler uses default

6. **Organization posts = `private` + `orgIds`**: Phase 1-3 does not introduce a separate `organization` visibility enum. Organization-scoped posts use `visibility: "private"` with `orgIds` array.

7. **Write-side not enforced**: `canCreatePostWithAudience()` exists but is NOT called in publish handlers. Phase 4 work.

## Risks

1. **Metadata cache TTL (15s)**: Audience changes may take up to 15 seconds to reflect in feed/map. Acceptable for MVP.

2. **No `schoolId` on existing users**: `deriveSchoolId()` handles this at read time. Future: write `schoolId` on registration.

3. **Write-side enforcement missing**: Publish handlers write `audience` but don't validate it. A user could craft a `schoolIds` array targeting a school they don't belong to. Phase 4 blocker.

4. **NodeBB raw link leakage**: Users can still access posts via `nodebbPublicBaseUrl/topic/:tid` bypassing LIAN audience checks. Mitigated by LIAN-side checks for web users.

~~5. **linkOnly+private leakage**~~: Fixed in second-round review. `canViewPost` linkOnly detail branch now properly checks `private` visibility with `userIds`/`orgIds`.

~~6. **Reply enforcement missing**~~: Fixed in second-round review. `handleCreateReply` now calls `canReplyToPost` before posting.

## Rollback

```bash
git checkout -- src/server/audience-service.js
git checkout -- src/server/feed-service.js
git checkout -- src/server/map-v2-service.js
git checkout -- src/server/post-service.js
git checkout -- src/server/ai-light-publish.js
git checkout -- src/server/api-router.js
rm scripts/setup-audience-test.js scripts/test-audience.js scripts/cleanup-audience-test.js
```

## Next Thread

1. **Run tests**: `node scripts/setup-audience-test.js` then `node scripts/test-audience.js`
2. **Phase 4**: Add `canCreatePostWithAudience` check in publish handlers
3. **Phase 5**: NodeBB group sync for school/org membership
4. **Publish V2 Page**: Audience picker UI on the dedicated publish page

## Status

**待审核** — 二次修正完成。4 个 review 问题已修复（linkOnly+private 泄漏、测试期望 D18、回复权限强制、文档过时描述）。代码通过语法检查，前端 smoke test 21/21 通过。需运行集成测试验证。
