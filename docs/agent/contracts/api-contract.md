# API Contract: LIAN Frontend ↔ Backend

> [!WARNING]
> Historical / superseded split-era API inventory as of 2026-05-05. Do not use this file as the current API source of truth. Start from `docs/agent/README.md`, `docs/agent/references/PR_DERIVED_STATUS_2026-05-05.md`, and `docs/agent/references/CONTRACTS_OVERRIDE_2026-05-05.md`; then verify current frontend callers and backend routes before using any endpoint status, port, or response shape below.

Date: 2026-05-02
Status: **Frozen** — Phase 0 of repo split. This document is the source of truth for the API surface between the frontend repo and the backend repo.

## Conventions

- All API paths are prefixed with `/api/`.
- Auth uses `lian_session` cookie or `x-session-token` header.
- Admin endpoints use `Bearer <ADMIN_TOKEN>` or `x-admin-token: <ADMIN_TOKEN>` header.
- Responses are JSON. Errors return `{ error: string }` with appropriate HTTP status.
- `getCurrentUser` = soft auth (returns `{ user: null }` if anonymous, never throws).
- `requireUser` = hard auth (returns 401 if no session, 403 if banned).
- `requireAdmin` = admin token check (503 if ADMIN_TOKEN not configured, 401 if mismatch).

## Endpoint Classification

| Label | Meaning |
|-------|---------|
| **frontend-required** | Frontend calls this; must exist in backend repo for split |
| **admin-only** | Only called by admin tools; frontend repo does not need this at runtime |
| **backend-only** | Internal use, not called by frontend |
| **deprecated** | Exists in backend but no frontend caller found; safe to remove after audit |

---

## 1. Feed & Posts

### GET /api/feed

- **Class:** frontend-required
- **Auth:** getCurrentUser (soft)
- **Frontend:** `app-feed.js:356`
- **Backend:** `feed-service.js` → `handleFeed`
- **Query params:**
  - `tab` (string) — tab name, e.g. "此刻", "推荐", category names
  - `page` (number) — 1-based page number
  - `limit` (number) — items per page (frontend uses 12)
  - `read` (string) — comma-separated TIDs the user has already seen
- **Response:**
  ```json
  {
    "tabs": [{ "id": "string", "label": "string" }],
    "items": [FeedItem],
    "hasMore": boolean,
    "nextPage": number
  }
  ```
- **FeedItem shape:**
  ```json
  {
    "tid": number,
    "title": "string",
    "bodyPreview": "string",
    "cover": "string (url)",
    "author": "string",
    "authorAvatarUrl": "string",
    "authorIdentityTag": "string",
    "timeLabel": "string",
    "timestampISO": "string",
    "likeCount": number,
    "liked": boolean,
    "locationArea": "string",
    "contentType": "string"
  }
  ```

### GET /api/posts/:tid

- **Class:** frontend-required
- **Auth:** getCurrentUser (soft)
- **Frontend:** `app-feed.js:411`
- **Backend:** `feed-service.js` → `handlePostDetail`
- **Response:**
  ```json
  {
    "tid": number,
    "title": "string",
    "contentHtml": "string",
    "cover": "string (url)",
    "imageUrls": ["string"],
    "author": "string",
    "authorAvatarUrl": "string",
    "authorIdentityTag": "string",
    "timestampISO": "string",
    "timeLabel": "string",
    "likeCount": number,
    "liked": boolean,
    "bookmarked": boolean,
    "locationArea": "string",
    "sourceUrl": "string",
    "replies": [Reply]
  }
  ```
- **Reply shape:**
  ```json
  {
    "id": number,
    "content": "string",
    "author": "string",
    "authorAvatarUrl": "string",
    "timestampISO": "string"
  }
  ```

### POST /api/posts

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited"
- **Frontend:** `app-messages-profile.js:391`
- **Backend:** `post-service.js` → `handleCreatePost`
- **Request:**
  ```json
  {
    "title": "string",
    "body": "string",
    "content": "string",
    "imageUrls": ["string"],
    "imageUrl": "string",
    "mapLocation": { "x": number, "y": number, "lat": number, "lng": number, "placeName": "string", "mapVersion": "string" },
    "aliasId": "string",
    "occurredAt": "string"
  }
  ```
- **Response:** `{ "tid": number }`

### POST /api/posts/:tid/replies

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited" + audience check
- **Frontend:** `app-messages-profile.js:78`
- **Backend:** `channel-service.js` → `handleCreateReply`
- **Headers:** `x-client-id: <uuid>`
- **Request:** `{ "content": "string" }`
- **Response:** Reply object

---

## 2. Post Interactions

### POST /api/posts/:tid/like

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited" + audience check
- **Frontend:** `app-feed.js:137`
- **Backend:** `post-service.js` → `handleTogglePostLike`
- **Request:** `{ "liked": boolean }`
- **Response:** `{ "liked": boolean, "likeCount": number }`

### POST /api/posts/:tid/save

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited" + audience check
- **Frontend:** `app-feed.js:169`
- **Backend:** `post-service.js` → `handleTogglePostSave`
- **Request:** `{ "saved": boolean }`
- **Response:** `{ "saved": boolean }`

### POST /api/posts/:tid/report

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited" + audience check
- **Frontend:** `app-feed.js:204`
- **Backend:** `post-service.js` → `handleReportPost`
- **Request:** `{ "reason": "string", "category": "string" }`
- **Category values:** `"privacy"`, `"false_info"`, `"abuse"`, `"wrong_location"`, `"expired"`, `"other"`
- **Response:** `{ "ok": true, "tid": number }`

---

## 3. Auth

### GET /api/auth/rules

- **Class:** deprecated (no frontend caller found)
- **Auth:** none
- **Backend:** `auth-routes.js` → `handleAuthRules`

### GET /api/auth/me

- **Class:** frontend-required
- **Auth:** getCurrentUser (soft)
- **Frontend:** `app-auth-avatar.js:128`
- **Backend:** `auth-routes.js` → `handleAuthMe`
- **Response:**
  ```json
  {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "avatarUrl": "string",
      "institution": "string",
      "tags": ["string"],
      "status": "string",
      "invitePermission": boolean,
      "aliases": [{ "id": "string", "name": "string", ... }],
      "activeAliasId": "string | null",
      "identityTags": ["string"],
      "nodebbUid": number
    }
  }
  ```
- Returns `{ "user": null }` if not authenticated.

### POST /api/auth/login

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-messages-profile.js:100`
- **Backend:** `auth-routes.js` → `handleAuthLogin`
- **Request:** `{ "login": "string", "password": "string" }`
- **Response:** `{ "user": UserObject }`

### POST /api/auth/register

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-messages-profile.js:100`
- **Backend:** `auth-routes.js` → `handleAuthRegister`
- **Request:** `{ "username": "string", "email": "string", "password": "string", "emailCode": "string", "inviteCode": "string" }`
- **Response:** `{ "user": UserObject }`

### POST /api/auth/email-code

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-messages-profile.js:127`
- **Backend:** `auth-routes.js` → `handleSendEmailCode`
- **Request:** `{ "email": "string" }`
- **Response:** `{ "institution": "string" }`

### POST /api/auth/logout

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-messages-profile.js:153`
- **Backend:** `auth-routes.js` → `handleAuthLogout`
- **Response:** `{ "ok": true }`

### POST /api/auth/avatar

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:318`
- **Backend:** `auth-routes.js` → `handleAuthAvatar`
- **Request:** `{ "avatarUrl": "string" }`
- **Response:** `{ "ok": true, "avatarUrl": "string" }`

### POST /api/auth/invites

- **Class:** frontend-required
- **Auth:** requireUser + invitePermission + active status
- **Frontend:** `app-messages-profile.js:144`
- **Backend:** `auth-routes.js` → `handleCreateInvite`
- **Response:** `{ "code": "string" }`

---

## 4. Aliases

### GET /api/alias-pool

- **Class:** deprecated (no frontend caller found)
- **Auth:** none
- **Backend:** `alias-service.js` → `handleGetAliasPool`

### GET /api/auth/aliases

- **Class:** deprecated (no frontend caller found; aliases come via `/api/auth/me` response)
- **Auth:** requireUser
- **Backend:** `alias-service.js` → `handleGetAliases`

### POST /api/auth/aliases

- **Class:** deprecated (no frontend caller found)
- **Auth:** requireUser
- **Backend:** `alias-service.js` → `handleCreateAlias`

### POST /api/auth/aliases/activate

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:229`
- **Backend:** `alias-service.js` → `handleActivateAlias`
- **Request:** `{ "aliasId": "string" }`
- **Response:** `{ "activeAliasId": "string" }`

### POST /api/auth/aliases/deactivate

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:236`
- **Backend:** `alias-service.js` → `handleDeactivateAlias`
- **Response:** `{ "activeAliasId": null }`

---

## 5. AI Publish

### POST /api/ai/post-preview

- **Class:** frontend-required
- **Auth:** none (runs before setup gate)
- **Frontend:** `app-ai-publish.js:327`, `publish-page.js:287`
- **Backend:** `ai-post-preview.js` → `handleAiPostPreview`
- **Request:**
  ```json
  {
    "imageUrl": "string",
    "imageUrls": ["string"],
    "template": "campus_moment",
    "locationHint": "string",
    "visibilityHint": "string"
  }
  ```
- **Response:**
  ```json
  {
    "draft": {
      "title": "string",
      "body": "string",
      "tags": ["string"],
      "metadata": { "visibility": "string", "locationArea": "string" }
    },
    "mode": "string",
    "riskFlags": [{ "code": "string", "message": "string" }],
    "confidence": number,
    "needsHumanReview": boolean,
    "locationDraft": { ... }
  }
  ```

### POST /api/ai/post-drafts

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-ai-publish.js:396`, `publish-page.js:368`
- **Backend:** `ai-light-publish.js` → `handleAiPostDraft`
- **Request:**
  ```json
  {
    "imageUrl": "string",
    "imageUrls": ["string"],
    "title": "string",
    "body": "string",
    "tags": ["string"],
    "metadata": {
      "locationArea": "string",
      "visibility": "string",
      "distribution": ["string"],
      "lat": number,
      "lng": number,
      "mapVersion": "string"
    },
    "locationDraft": { ... },
    "riskFlags": [{ "code": "string", "message": "string" }],
    "confidence": number,
    "needsHumanReview": boolean,
    "aiMode": "string",
    "aliasId": "string"
  }
  ```
- **Response:** `{ "draftId": "string" }`

### POST /api/ai/post-publish

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited"
- **Frontend:** `app-ai-publish.js:422`, `publish-page.js:396`
- **Backend:** `ai-light-publish.js` → `handleAiPostPublish`
- **Request:** same as `/api/ai/post-drafts`
- **Response:** `{ "tid": number }`

---

## 6. User Profile & Activity

### GET /api/me

- **Class:** frontend-required
- **Auth:** getCurrentUser (soft)
- **Frontend:** `app-messages-profile.js:247`
- **Backend:** `auth-routes.js` → `handleMe`
- **Response:** similar to `/api/auth/me` but falls back to default uid if no user

### GET /api/me/saved

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:294`
- **Backend:** `post-service.js` → `handleGetSavedPosts`
- **Response:** `{ "items": [ProfileListItem] }`

### GET /api/me/liked

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:297`
- **Backend:** `post-service.js` → `handleGetLikedPosts`
- **Response:** `{ "items": [ProfileListItem] }`

### POST /api/me/history

- **Class:** frontend-required
- **Auth:** requireUser
- **Frontend:** `app-messages-profile.js:286`
- **Backend:** `post-service.js` → `handleGetHistory`
- **Request:** `{ "tids": [number] }` (up to 50)
- **Response:** `{ "items": [ProfileListItem] }`

**ProfileListItem shape:**
```json
{
  "tid": number,
  "title": "string",
  "cover": "string (url)",
  "timeLabel": "string",
  "locationArea": "string"
}
```

---

## 7. Channel & Messages

### GET /api/channel

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-messages-profile.js:13`
- **Backend:** `channel-service.js` → `handleChannel`
- **Query params:** `limit` (number), `offset` (number)
- **Response:** `{ "items": [ChannelMessage], "nextOffset": number, "hasMore": boolean }`

### POST /api/channel/messages

- **Class:** frontend-required
- **Auth:** requireUser + status != "limited"
- **Frontend:** `app-messages-profile.js:53`
- **Backend:** `channel-service.js` → `handleChannelMessage`
- **Headers:** `x-client-id: <uuid>`
- **Request:** `{ "readerId": "string", "content": "string", "identityTag": "string" }`
- **Response:** ChannelMessage object

### POST /api/channel/read

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-ai-publish.js:31`
- **Backend:** `channel-service.js` → `handleChannelRead`
- **Headers:** `x-client-id: <uuid>`
- **Request:** `{ "readerId": "string", "eventIds": ["string"], "tids": [number] }`
- **Response:** `{ "ok": true }`

### GET /api/messages

- **Class:** deprecated (no frontend caller found; `/api/channel` is used instead)
- **Auth:** none
- **Backend:** `channel-service.js` → `handleMessages`

---

## 8. Map

### GET /api/map/items

- **Class:** deprecated (frontend uses `/api/map/v2/items`; legacy static data endpoint)
- **Auth:** none
- **Backend:** inline in `api-router.js`, uses `static-data.js`

### GET /api/map/v2/items

- **Class:** frontend-required
- **Auth:** getCurrentUser (soft)
- **Frontend:** `map-v2.js:209`, `tools/map-v2-editor.js:997`
- **Backend:** `map-v2-service.js` → `handleMapV2Items`
- **Response:**
  ```json
  {
    "center": { "lat": number, "lng": number },
    "zoom": number,
    "bounds": { "south": number, "west": number, "north": number, "east": number },
    "layers": { "areas": [], "routes": [] },
    "locations": [Location],
    "posts": [MapPost]
  }
  ```

---

## 9. Upload & Image Proxy

### POST /api/upload/image

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-utils.js:64`
- **Backend:** `upload.js` → `handleUploadImage`
- **Query params:** `purpose` (string, optional — "publish-v2", "ai-light-publish", "avatar", "")
- **Request:** `FormData` with `image` field (File)
- **Response:** `{ "url": "string" }`

### GET :4101/api/image-proxy

- **Class:** frontend-required
- **Auth:** none
- **Frontend:** `app-utils.js`, `map-v2.js`, and `public/tools/map-v2-editor.js` (via `displayImageUrl()`)
- **Port:** standalone image proxy server on `IMAGE_PROXY_PORT` (default `4101`)
- **Backend:** `image-proxy.js` → `handleImageProxy`
- **Query params:** `url` (string — Cloudinary URL)
- **Response:** proxied image binary (image/*)
- **Boundary:** the main app server on `PORT=4100` must not serve `/api/image-proxy`; that path should 404 on 4100.

---

## 10. Setup

### GET /api/setup/status

- **Class:** backend-only (setup wizard, not called by main frontend)
- **Auth:** none
- **Backend:** inline in `api-router.js`

### POST /api/setup

- **Class:** backend-only (setup wizard)
- **Auth:** none
- **Backend:** inline in `api-router.js`

---

## 11. Tags

### GET /api/tags

- **Class:** deprecated (no frontend caller found)
- **Auth:** none
- **Backend:** inline in `api-router.js`, delegates to `nodebbFetch("/api/tags")`

---

## 12. Admin

All admin endpoints require `x-admin-token` or `Bearer <ADMIN_TOKEN>`.

### GET /api/admin/map-v2

- **Class:** admin-only
- **Frontend:** `tools/map-v2-editor.js:986` (admin editor tool)
- **Backend:** `map-v2-service.js` → `handleAdminMapV2`
- **Response:** full admin map data (locations + layers with extended properties)

### PUT /api/admin/map-v2

- **Class:** admin-only
- **Frontend:** `tools/map-v2-editor.js:1187`
- **Backend:** `map-v2-service.js` → `handleAdminMapV2`
- **Request:** `{ "locations": object, "layers": object }`
- **Response:** `{ "ok": true }`

### PATCH /api/admin/auth/users/:id/status

- **Class:** admin-only
- **Backend:** `admin-routes.js` → `handleAdminUserStatus`

### GET /api/admin/feed-rules

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### PUT /api/admin/feed-rules

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### PUT /api/admin/feed-edition

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### GET /api/admin/post-metadata

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### PUT /api/admin/post-metadata

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### PATCH /api/admin/post-metadata/:tid

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### DELETE /api/admin/post-metadata/:tid

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

### POST /api/admin/reload

- **Class:** admin-only
- **Backend:** `admin-routes.js` (inline)

---

## 13. Non-API Routes

These are served by `server.js` directly, not through `api-router.js`:

| Path | Handler | Notes |
|------|---------|-------|
| `/lian-assets/*` | `static-server.js` → `proxyLianAsset` | Proxies LIAN asset requests |
| `*` (catch-all) | `static-server.js` → `serveStatic` | Serves `public/` static files |

After repo split, the frontend repo serves static files directly (via nginx, CDN, or a minimal dev server). The backend repo does not need to serve `public/`.

---

## Summary Counts

| Classification | Count |
|----------------|-------|
| frontend-required | 29 |
| admin-only | 11 |
| backend-only | 2 (setup endpoints) |
| deprecated | 6 (auth/rules, alias-pool, auth/aliases GET+POST, messages, map/items, tags) |
| **Total** | **48** |

## Frontend API Helper Contract

The frontend uses three patterns to call the backend:

1. **`api(path, options)`** — defined in `app-utils.js:53`. Thin `fetch` wrapper with `credentials: "include"`, JSON parsing, and error throwing. Used for all JSON API calls.

2. **`uploadImage(file, purpose)`** — defined in `app-utils.js:60`. Direct `fetch` with `FormData`. Returns `{ url }`.

3. **`displayImageUrl(url)`** — defined in `app-utils.js:30`. Rewrites Cloudinary URLs to `/api/image-proxy?url=...`. Used in `<img src>` attributes.

After repo split, the `api()` helper must support a configurable base URL:

```javascript
const API_BASE = window.LIAN_API_BASE_URL || "";
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options
  });
  // ...
}
```

Default `LIAN_API_BASE_URL` is empty string (same-origin), preserving current behavior during staged migration.
