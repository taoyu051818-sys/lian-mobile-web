# Audience System Test Plan

Date: 2026-05-02

## Scope

Tests cover Phases 1-3 of the audience migration: schema addition, user schoolId derivation, and read-side enforcement.

Files under test:

- `src/server/audience-service.js` (new)
- `src/server/feed-service.js` (modified)
- `src/server/map-v2-service.js` (modified)
- `src/server/post-service.js` (modified)
- `src/server/ai-light-publish.js` (modified)
- `src/server/api-router.js` (modified)

---

## 1. Unit Tests: audience-service.js

### 1.1 normalizeAudience

| Case | Input | Expected |
|---|---|---|
| Full audience object | `{visibility:"school",schoolIds:["cuc-hainan"]}` | Pass through with all fields |
| Partial audience object | `{visibility:"campus"}` | Fill missing fields with defaults |
| No audience, flat "public" | `null, "public"` | `{visibility:"public",linkOnly:false,...}` |
| No audience, flat "linkOnly" | `null, "linkOnly"` | `{visibility:"public",linkOnly:true}` |
| No audience, no flat | `null, null` | `{visibility:"public",linkOnly:false}` |
| Garbage input | `"not-an-object", "public"` | Fallback to flat visibility |

### 1.2 canViewPost

| Case | User | Post | Expected |
|---|---|---|---|
| public post, anonymous | `null` | `{visibility:"public"}` | `true` |
| public post, logged in | `{id:"u1"}` | `{visibility:"public"}` | `true` |
| campus post, anonymous | `null` | `{visibility:"campus"}` | `false` |
| campus post, logged in | `{id:"u1"}` | `{visibility:"campus"}` | `true` |
| school post, anonymous | `null` | `{visibility:"school",schoolIds:["cuc"]}` | `false` |
| school post, matching school | `{id:"u1",schoolId:"cuc"}` | `{visibility:"school",schoolIds:["cuc"]}` | `true` |
| school post, wrong school | `{id:"u1",schoolId:"bupt"}` | `{visibility:"school",schoolIds:["cuc"]}` | `false` |
| school post, empty schoolIds | `{id:"u1",schoolId:"bupt"}` | `{visibility:"school",schoolIds:[]}` | `true` |
| private post, anonymous | `null` | `{visibility:"private",userIds:["u1"]}` | `false` |
| private post, targeted user | `{id:"u1"}` | `{visibility:"private",userIds:["u1"]}` | `true` |
| private post, not targeted | `{id:"u2"}` | `{visibility:"private",userIds:["u1"]}` | `false` |
| private post, matching org | `{id:"u1",orgIds:["org-a"]}` | `{visibility:"private",orgIds:["org-a"]}` | `true` |
| linkOnly post, anonymous | `null` | `{visibility:"public",linkOnly:true}` | `false` |
| linkOnly post, author | `{id:"u1"}` | `{visibility:"public",linkOnly:true,authorUserId:"u1"}` | `true` |
| linkOnly post, admin | `{id:"u2",roleIds:["admin"]}` | `{visibility:"public",linkOnly:true,authorUserId:"u1"}` | `true` |
| linkOnly post, regular user | `{id:"u3"}` | `{visibility:"public",linkOnly:true,authorUserId:"u1"}` | `true` (visibility=public) |
| linkOnly campus, anonymous | `null` | `{visibility:"campus",linkOnly:true}` | `false` |
| linkOnly campus, logged in non-author | `{id:"u3"}` | `{visibility:"campus",linkOnly:true,authorUserId:"u1"}` | `false` |
| No audience, old post | `{id:"u1"}` | `{}` (no audience, no visibility) | `true` (defaults to public) |

### 1.3 canCreatePostWithAudience

| Case | User | Audience | Expected |
|---|---|---|---|
| public | any | `{visibility:"public"}` | `true` |
| campus | any | `{visibility:"campus"}` | `true` |
| school, matching | `{schoolId:"cuc"}` | `{visibility:"school",schoolIds:["cuc"]}` | `true` |
| school, no match | `{schoolId:"bupt"}` | `{visibility:"school",schoolIds:["cuc"]}` | `false` |
| private | any | `{visibility:"private"}` | `true` |

### 1.4 canReplyToPost

| Case | User | Post | Expected |
|---|---|---|---|
| Anonymous on public | `null` | `{visibility:"public"}` | `false` |
| Logged in on public | `{id:"u1"}` | `{visibility:"public"}` | `true` |
| Logged in on campus | `{id:"u1"}` | `{visibility:"campus"}` | `true` |
| Anonymous on campus | `null` | `{visibility:"campus"}` | `false` |

### 1.5 canModeratePost

| Case | User | Post | Expected |
|---|---|---|---|
| Admin | `{id:"u1",roleIds:["admin"]}` | `{authorUserId:"u2"}` | `true` |
| Moderator | `{id:"u1",roleIds:["moderator"]}` | `{authorUserId:"u2"}` | `true` |
| Author | `{id:"u1"}` | `{authorUserId:"u1"}` | `true` |
| Regular user | `{id:"u1"}` | `{authorUserId:"u2"}` | `false` |
| Anonymous | `null` | `{authorUserId:"u2"}` | `false` |

### 1.6 canSeeAudienceOption

| Case | User | Option | Expected |
|---|---|---|---|
| public | any | `{visibility:"public"}` | `true` |
| campus | any | `{visibility:"campus"}` | `true` |
| school, has schoolId | `{schoolId:"cuc"}` | `{visibility:"school"}` | `true` |
| school, no schoolId | `{}` | `{visibility:"school"}` | `false` |
| private | any | `{visibility:"private"}` | `true` |

### 1.7 deriveSchoolId

| Case | Input | Expected |
|---|---|---|
| Exact match | "中国传媒大学海南国际学院" | "中国传媒大学" |
| Partial match | "中国传媒大学" | "中国传媒大学" |
| No match | "某某大学" | "" |
| Empty string | "" | "" |
| Null | null | "" |

---

## 2. Integration Tests: Feed

### 2.1 Feed with audience filtering

| Case | Setup | Expected |
|---|---|---|
| Public posts visible to anonymous | Feed has public posts | All public posts returned |
| Campus posts hidden from anonymous | Feed has campus posts | Campus posts not in response |
| Campus posts visible to logged-in | Login, request feed | Campus posts appear |
| School posts filtered by school | Login as cuc user, feed has bupt school post | Bupt post not shown |
| linkOnly posts not in feed | Feed has linkOnly post | Not in feed response |
| Old posts without audience | Feed has old posts (no audience field) | Visible (defaults to public) |

### 2.2 Post detail access control

| Case | Setup | Expected |
|---|---|---|
| Public post, anonymous | GET /api/posts/:tid | 200, full detail |
| Campus post, anonymous | GET /api/posts/:tid | 403, access denied |
| Campus post, logged-in | GET /api/posts/:tid with session | 200, full detail |
| Private post, not targeted | GET /api/posts/:tid | 403, access denied |
| Private post, targeted user | GET /api/posts/:tid with session | 200, full detail |
| Nonexistent post | GET /api/posts/99999 | 404, topic not found |

---

## 3. Integration Tests: Map

### 3.1 Map items filtering

| Case | Setup | Expected |
|---|---|---|
| Public posts on map, anonymous | GET /api/map/v2/items | Public posts with coords appear |
| Campus posts hidden from anonymous | GET /api/map/v2/items | Campus posts not in response |
| Campus posts visible to logged-in | GET /api/map/v2/items with session | Campus posts appear |
| Old posts without audience | GET /api/map/v2/items | Visible (defaults to public) |

---

## 4. Integration Tests: Publish

### 4.1 Manual post creation writes audience

| Case | Setup | Expected |
|---|---|---|
| Public post | POST /api/posts with `visibility:"public"` | metadata has `audience:{visibility:"public",...}` |
| Campus post | POST /api/posts with `visibility:"campus"` | metadata has `audience:{visibility:"campus",...}` |
| School post | POST /api/posts with `visibility:"school"` | metadata has `audience:{schoolIds:["中国传媒大学"],...}` |
| No visibility specified | POST /api/posts without visibility | Defaults to public |

### 4.2 AI publish writes audience

| Case | Setup | Expected |
|---|---|---|
| AI publish with campus | POST /api/ai/post-publish with `visibility:"campus"` | metadata has audience with campus |
| AI publish with school | POST /api/ai/post-publish with `visibility:"school"` | audience.schoolIds populated from user institution |
| AI publish with visibilityHint | POST /api/ai/post-preview with `visibilityHint:"campus"` | Draft metadata suggests campus |

---

## 5. Regression Checks

| Case | Command | Expected |
|---|---|---|
| All server files syntax | `node --check src/server/*.js` | No errors |
| Frontend smoke | `node scripts/smoke-frontend.js` | 21/21 pass |
| Feed loads | GET /api/feed | 200, items returned |
| Feed debug loads | GET /api/feed-debug (admin) | 200, debug table returned |
| Map loads | GET /api/map/v2/items | 200, posts and locations returned |
| Post detail loads | GET /api/posts/:tid (public post) | 200, full detail |

---

## 6. Manual Browser Verification

1. Open app as anonymous user → feed loads, only public posts visible
2. Login → feed now shows campus posts
3. Open a campus post detail → 200, content visible
4. Logout → open same post detail → 403 or redirected
5. Map view → only shows posts matching viewer's access level
6. Create a new post with `visibility: "campus"` → check `data/post-metadata.json` has `audience` field
7. Feed debug page → `audience-denied` appears as filter reason for hidden posts

---

## 7. Edge Cases

| Case | Risk | Test |
|---|---|---|
| Post with `visibility:"linkOnly"` and no audience object | `normalizeAudience` must build correct audience from flat visibility | Verify linkOnly=true, visibility=public |
| Post with both `audience` and flat `visibility` | `audience` object takes priority | Verify audience object is used |
| User with no `schoolId` field | `canViewPost` for school posts | school with empty schoolIds = visible to all |
| User with no `orgIds` field | `canViewPost` for private posts | org check returns false safely |
| Metadata cache TTL (15s) | Audience changes may take up to 15s to reflect | Acceptable for MVP |
