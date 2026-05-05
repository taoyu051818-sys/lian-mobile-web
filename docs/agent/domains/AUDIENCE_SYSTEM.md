# Audience System Design

Date: 2026-05-02

## Overview

LIAN needs multi-school and multi-organization content visibility. This document defines the audience model, permission functions, enforcement points, and migration path.

## Current State

Existing fields in `post-metadata.json`:

- `visibility`: `"public"` | `"campus"` | `"school"` | `"linkOnly"` | `"private"` — Phase 1-3: read-side enforced via `canViewPost`; write-side not yet enforced (Phase 4)
- `distribution`: `["home", "search", "detail", "map"]` — controls which surfaces show the post

Existing user fields in `auth-users.json`:

- `institution`: string (e.g., "海南立国际教育创新区")
- `tags`: string[] (e.g., ["高校认证"])
- `status`: "active" | "limited"

No school/org membership model exists yet. No permission checks exist beyond `status === "limited"`.

## Audience Schema

### Post audience (stored in `post-metadata.json`)

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

| Field | Type | Meaning |
|---|---|---|
| `visibility` | enum | Base visibility level |
| `schoolIds` | string[] | Schools that can see this post |
| `orgIds` | string[] | Organizations that can see this post |
| `roleIds` | string[] | Roles that can see this post (e.g., "admin", "moderator") |
| `userIds` | string[] | Specific user IDs (for private/DM-like posts) |
| `linkOnly` | boolean | If true, post is not distributed to feed/search/map, only accessible by direct link |

### Visibility levels

| Level | Meaning | Default audience |
|---|---|---|
| `public` | Everyone including non-logged-in users | Empty filters |
| `campus` | All logged-in LIAN users | Empty filters |
| `school` | Specific school(s) | `schoolIds` required |
| `private` | Specific users only | `userIds` required |
| `linkOnly` | Not distributed, link-accessible | `linkOnly: true` |

### Canonical schoolId (Phase 1-3)

Current canonical schoolId is the Chinese short name from `authInstitutions.tags[0]`. This is derived at read time by `deriveSchoolId(institution)` in `audience-service.js`.

| institution | canonical schoolId |
|---|---|
| 中国传媒大学海南国际学院 | 中国传媒大学 |
| 北京邮电大学玛丽女王海南学院 | 北京邮电大学 |
| 北京体育大学阿尔伯塔国际休闲体育与旅游学院 | 北京体育大学 |
| 中央民族大学海南国际学院 | 中央民族大学 |
| 北京语言大学 | 北京语言大学 |
| 电子科技大学格拉斯哥海南学院 | 电子科技大学 |

Future migration may introduce slug-based IDs (e.g., `cuc-hainan`), but Phase 1-3 uses Chinese short names exclusively.

### User membership (auth-users.json)

```json
{
  "schoolId": "中国传媒大学",
  "orgIds": ["council", "photo-club"],
  "roleIds": ["user"]
}
```

### Organization definition

Phase 1-3 does not use a separate `organization` visibility level. Organization-scoped posts use `visibility: "private"` with `orgIds` array.

| orgId | name | member schools |
|---|---|---|
| council | 试验区学生会 | 中国传媒大学, 北京邮电大学, 中央民族大学 |
| photo-club | 光影摄影社 | 中国传媒大学 |
| basketball-club | 飞鹰篮球社 | 北京邮电大学 |

## Permission Functions

### `canViewPost(user, post, context)`

Determines if a user can see a post. `context` is `"feed"`, `"map"`, or `"detail"` (default).

- **feed/map**: linkOnly posts always return `false` (never distributed).
- **detail**: linkOnly posts are accessible by direct link, check base visibility.

```javascript
function canViewPost(user, post, context = "detail") {
  const audience = post.audience || {};
  const visibility = audience.visibility || "public";

  if (audience.linkOnly) {
    if (context === "feed" || context === "map") return false;
    // detail: check base visibility + author/admin override
    // ...
  }

  switch (visibility) {
    case "public":
      return true;

    case "campus":
      return Boolean(user);

    case "school":
      if (!user) return false;
      if (!audience.schoolIds?.length) return true;
      return audience.schoolIds.includes(user.schoolId);

    case "private":
      if (!user) return false;
      if (audience.userIds?.length) return audience.userIds.includes(user.id);
      if (audience.orgIds?.length) return audience.orgIds.some((id) => user.orgIds?.includes(id));
      return false;

    default:
      return true;
  }
}
```

### `canCreatePostWithAudience(user, audience)`

Determines if a user can publish with a given audience.

```javascript
function canCreatePostWithAudience(user, audience) {
  const visibility = audience?.visibility || "public";

  if (visibility === "public" || visibility === "campus") return true;

  if (visibility === "school") {
    // Can only post to your own school
    return audience.schoolIds?.includes(user.schoolId);
  }

  if (visibility === "private") {
    // Can create private posts targeting specific users or your org
    return true;
  }

  return true;
}
```

### `canReplyToPost(user, post)`

```javascript
function canReplyToPost(user, post) {
  if (!user) return false;
  return canViewPost(user, post);
}
```

### `canModeratePost(user, post)`

```javascript
function canModeratePost(user, post) {
  if (!user) return false;
  if (user.roleIds?.includes("admin")) return true;
  if (user.roleIds?.includes("moderator")) return true;
  // Post author can moderate their own post
  if (post.authorUserId === user.id) return true;
  return false;
}
```

### `canSeeAudienceOption(user, option)`

Determines if a user can select a specific audience option when posting.

```javascript
function canSeeAudienceOption(user, option) {
  if (option.visibility === "public") return true;
  if (option.visibility === "campus") return true;
  if (option.visibility === "school") return user.schoolId != null;
  if (option.visibility === "private") return true;
  return false;
}
```

## Enforcement Points

Every surface that returns post data must apply `canViewPost`:

| Surface | Current behavior | Required change |
|---|---|---|
| `GET /api/feed` | No audience filtering | Filter by `canViewPost(currentUser, post)` |
| `GET /api/feed-debug` | No audience filtering | Same filter, or show "hidden by audience" |
| `GET /api/posts/:tid` | No audience filtering | Return 403/404 if `!canViewPost` |
| `POST /api/posts/:tid/replies` | No audience check | Reject if `!canReplyToPost` |
| `GET /api/map/v2/items` | No audience filtering | Filter items by `canViewPost` |
| Search (if implemented) | N/A | Filter by `canViewPost` |
| `GET /api/channel` | No audience filtering | Filter messages by `canViewPost` on linked topic |
| `GET /api/messages` | No audience filtering | Filter notifications by `canViewPost` on linked topic |

### Feed filtering

```javascript
// In feed-service.js, after isFeedEligible()
if (!canViewPost(currentUser, item)) return false;
```

For anonymous users (`currentUser === null`), only `visibility: "public"` posts pass.

### Detail access

```javascript
// In handlePostDetail()
const post = normalizeTopic(topic, detail, metadata);
if (!canViewPost(currentUser, post)) {
  return sendJson(res, 403, { error: "access denied" });
}
```

### Map filtering

```javascript
// In map-v2-service.js, before returning items
items = items.filter((item) => canViewPost(currentUser, item));
```

## linkOnly Behavior

`linkOnly: true` means:

- Post is NOT distributed to home feed, search results, or map overlays
- Post IS accessible via direct link (`/api/posts/:tid`) if `canViewPost` passes
- `distribution` field should be overridden to `[]` (empty) when `linkOnly` is true
- Channel and notifications still work for the post

Implementation:

```javascript
if (audience.linkOnly) {
  distribution = []; // No surface distribution
}
```

## NodeBB Mirror Strategy

### Groups

Mirror LIAN school/org membership to NodeBB groups (Phase 5 — not yet implemented):

| LIAN entity | NodeBB group |
|---|---|
| `schoolId: "中国传媒大学"` | `group: "school:中国传媒大学"` |
| `orgId: "council"` | `group: "org:council"` |
| Admin | `group: "role:admin"` |

Sync triggers:
- On user login / `ensureNodebbUid()`: sync group membership
- On org join/leave: add/remove from NodeBB group

### Categories

Do NOT create one NodeBB category per audience combination. Instead:

| Category | Content |
|---|---|
| `LIAN Public` | `visibility: "public"` |
| `LIAN Campus` | `visibility: "campus"` or `visibility: "school"` |
| `LIAN Private` | `visibility: "private"` or `linkOnly: true` |

Routing:

```javascript
function nodebbCategoryForAudience(audience) {
  if (audience.visibility === "private" || audience.linkOnly) return PRIVATE_CID;
  if (audience.visibility === "school" || audience.visibility === "campus") return CAMPUS_CID;
  return PUBLIC_CID;
}
```

## Raw NodeBB Link Leakage

Risk: Users can access posts directly via `nodebbPublicBaseUrl/topic/:tid`, bypassing LIAN audience checks.

Mitigation options (in order of priority):

1. **LIAN audience check on detail endpoint** — `GET /api/posts/:tid` returns 403, so LIAN web users can't access
2. **Restricted NodeBB categories** — put private/school content in categories that require group membership
3. **NodeBB plugin** (future) — intercept topic views and check LIAN audience

Priority: Option 1 is sufficient for MVP. Option 2 adds defense-in-depth. Option 3 is a future enhancement.

## Migration Plan

### Phase 1: Add audience field (non-breaking)

- Add `audience` field to `post-metadata.json` with default `{"visibility": "public"}`
- Existing posts without `audience` default to `visibility: "public"`
- No behavior change

### Phase 2: Add user schoolId

- Add `schoolId` field to `auth-users.json`
- Populate from `institution` field or new registration flow
- No behavior change

### Phase 3: Enforce on read

- Add `canViewPost` checks to feed, detail, map, search
- `visibility: "school"` posts only visible to matching school users
- `visibility: "private"` posts only visible to targeted users

### Phase 4: Enforce on write

- Add `canCreatePostWithAudience` checks on post creation
- Add audience picker to publish form

### Phase 5: NodeBB sync

- Mirror school/org membership to NodeBB groups
- Route posts to appropriate NodeBB categories

### Current `visibility` to `audience` mapping

| Current `visibility` | Future `audience` |
|---|---|
| `"public"` | `{"visibility": "public"}` |
| `"campus"` | `{"visibility": "campus"}` |
| `"school"` | `{"visibility": "school", "schoolIds": [user.schoolId]}` |
| `"linkOnly"` | `{"visibility": "public", "linkOnly": true}` |
| `"private"` | `{"visibility": "private", "userIds": [...]}` |

## Non-Goals

- Per-post ACLs beyond the audience model
- End-to-end encryption
- Anonymous posting with audience restrictions
- Dynamic audience rules (e.g., "all students who joined after date X")
- NodeBB plugin before LIAN-side checks are proven
