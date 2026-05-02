# Project Fact Baseline

> Historical baseline. This file records an earlier snapshot of the project and is no longer the highest source of truth for Map v2 or the frontend split. Before acting on any fact here, compare with current code, `docs/agent/README.md`, `docs/agent/ARCHITECTURE_WORKPLAN.md`, `docs/agent/04_DECISIONS.md`, and the latest handoff for the task area.

> Generated: 2026-05-02
> Principle: code is the highest truth source; `docs/agent/` is supplementary.
> No secrets, tokens, or API keys are recorded here.

---

## 1. Real Feature Inventory

| Feature | Frontend Entry | Backend API | Backend File | Status |
|---------|---------------|-------------|--------------|--------|
| Feed recommendation | `app.js` tab switch | `GET /api/feed` | `feed-service.js:487` | Done |
| Feed debug | No frontend | `GET /api/feed-debug` (ADMIN_TOKEN) | `feed-service.js:636` | Done |
| Post detail | Click card | `GET /api/posts/:tid` | `feed-service.js:741` | Done |
| Manual post | `app.js` form | `POST /api/posts` | `post-service.js:129` | Done |
| Reply | Detail page | `POST /api/posts/:tid/replies` | `channel-service.js:120` | Done |
| Image upload | Post/AI flow | `POST /api/upload/image` | `upload.js:56` | Done |
| Image proxy | `<img>` src | `GET /api/image-proxy?url=` | `image-proxy.js:15` | Done |
| AI draft preview | AI flow | `POST /api/ai/post-preview` | `ai-post-preview.js:388` | Done |
| AI draft save | AI flow | `POST /api/ai/post-drafts` | `ai-light-publish.js:116` | Done |
| AI confirmed publish | "发布到 LIAN" | `POST /api/ai/post-publish` | `ai-light-publish.js:142` | Done (rough) |
| User register | Register page | `POST /api/auth/register` | `auth-routes.js` | Done |
| Email verification | Register flow | `POST /api/auth/email-code` | `auth-routes.js` | Done |
| User login | Login page | `POST /api/auth/login` | `auth-routes.js` | Done |
| User logout | Profile page | `POST /api/auth/logout` | `auth-routes.js` | Done |
| Current user | Global | `GET /api/auth/me` | `auth-routes.js` | Done |
| Invite codes | Invite page | `POST /api/auth/invites` | `auth-routes.js` | Done |
| Avatar upload | Settings | `POST /api/auth/avatar` | `auth-routes.js` | Done |
| Channel messages | Channel tab | `GET /api/channel` | `channel-service.js:34` | Done |
| Channel send | Channel input | `POST /api/channel/messages` | `channel-service.js:83` | Done |
| Channel read | Auto | `POST /api/channel/read` | `channel-service.js:63` | Done |
| Notifications | Messages tab | `GET /api/messages` | `channel-service.js:135` | Done |
| Map POI | Map page | `GET /api/map/items` | `api-router.js:69` (hardcoded) | Static |
| Tag list | Post tag picker | `GET /api/tags` | `api-router.js:68` (passthrough) | Done |
| Setup wizard | First deploy | `GET/POST /api/setup/*` | `config.js`, `setup-page.js` | Done |
| Admin management | curl | `GET/PUT/PATCH/DELETE /api/admin/*` | `admin-routes.js` | Done |

---

## 2. Real Directory Structure

```
lian-mobile-web/
├── server.js                    # 29 lines, thin entry
├── package.json                 # ESM ("type": "module"), zero dependencies
├── .env.example                 # env placeholders
├── src/server/                  # 22 modules, ~3,581 lines total
│   ├── api-router.js            # 97 lines, if-else route chain
│   ├── feed-service.js          # 787 lines, recommendation core
│   ├── ai-post-preview.js       # 433 lines, MiMo adapter + mock
│   ├── auth-service.js          # 335 lines, user/password/session/nodebbUid
│   ├── auth-routes.js           # 313 lines, register/login/email/invite
│   ├── content-utils.js         # 240 lines, HTML build / image processing
│   ├── ai-light-publish.js      # 238 lines, draft save + confirmed publish
│   ├── post-service.js          # 195 lines, NodeBB topic creation
│   ├── channel-service.js       # 150 lines, channel messages
│   ├── admin-routes.js          # 142 lines, admin API
│   ├── config.js                # 128 lines, .env parse + config object
│   ├── data-store.js            # 119 lines, JSON file read/write
│   ├── nodebb-client.js         # 94 lines, NodeBB HTTP client
│   ├── setup-page.js            # 91 lines, first-run setup page
│   ├── request-utils.js         # 77 lines, body parse / multipart
│   ├── upload.js                # 74 lines, Cloudinary upload
│   ├── image-proxy.js           # 63 lines, Cloudinary proxy
│   ├── static-data.js           # 57 lines, institution list + map POI
│   ├── static-server.js         # 53 lines, static file serving
│   ├── cache.js                 # 10 lines, in-memory cache object
│   ├── http-response.js         # 13 lines, sendJson / sendText
│   └── paths.js                 # 12 lines, path constants
├── public/                      # Frontend
│   ├── index.html               # Entry HTML
│   ├── app.js                   # 2,151 lines, all frontend logic (single file vanilla JS)
│   ├── styles.css               # Styles
│   ├── menu-prototype*          # Menu prototypes (experimental)
│   └── menu-data.json           # Menu data
├── data/                        # Data files
│   ├── post-metadata.json       # 2,314 lines, post metadata (tid -> metadata)
│   ├── feed-rules.json          # 127 lines, feed configuration
│   ├── auth-users.json          # User/session data (.gitignore)
│   ├── channel-reads.json       # Channel read state
│   ├── clubs.json               # Club data
│   └── study-hn-club-discoveries.json
├── scripts/                     # Utility scripts
│   ├── validate-post-metadata.js
│   ├── snapshot-feed.js
│   ├── validate-project-structure.js
│   └── seed-photo-post-candidates.js
└── docs/agent/                  # Agent collaboration docs
```

---

## 3. NodeBB Integration Status

### Connection

All NodeBB HTTP calls go through `nodebb-client.js`.

- Shared admin token: `config.nodebbToken` sent as `x-api-token` header.
  - Source: `nodebb-client.js:22-24`
- Per-user mapping: `ensureNodebbUid()` finds or creates NodeBB user by username, caches `nodebbUid` in `auth-users.json`.
  - Source: `auth-service.js:102-118`

### NodeBB APIs Used

| Purpose | NodeBB Endpoint | Call Site |
|---------|-----------------|-----------|
| Read topic list | `GET /api/recent?page=` | `nodebb-client.js:76` |
| Read topic detail | `GET /api/topic/:tid` | `feed-service.js:188` |
| Create topic | `POST /api/v3/topics` | `post-service.js:107` |
| Create reply | `POST /api/v3/topics/:tid` or `/:tid/posts` | `post-service.js:171-184` |
| Find user | `GET /api/users?query=` | `auth-service.js:64` |
| Create user | `POST /api/v3/users` | `auth-service.js:88` |
| Mark read | `POST/PUT /api/v3/topics/:tid/read` | `channel-service.js:16-26` |
| Notifications | `GET /api/notifications` | `channel-service.js:137` |
| Tags | `GET /api/tags` | `api-router.js:68` |

### NodeBB Instance

Default base URL configured in `config.js:37`. Actual value lives in `.env` only.

### Key Constraints

- `NODEBB_UID` (default 2) is the system default user for read operations.
- Real users post with their own `nodebbUid` from `ensureNodebbUid()`.
- All topic creation goes through `createNodebbTopicFromPayload()`.
  - Source: `post-service.js:87-127`

---

## 4. AI Publish Status

### Three Endpoints

1. `POST /api/ai/post-preview` — generates editable draft (mock or MiMo)
   - Source: `ai-post-preview.js:388-420`
2. `POST /api/ai/post-drafts` — silently saves draft to `data/ai-post-drafts.jsonl`
   - Source: `ai-light-publish.js:116-140`
3. `POST /api/ai/post-publish` — publishes to NodeBB after user confirmation
   - Source: `ai-light-publish.js:142-236`

### Mode Switching

- No `MIMO_API_KEY` or `AI_POST_PREVIEW_MODE=mock` → mock mode
- Key present → MiMo mode, auto-fallback to mock on failure (`fallbackReason: "mimo_unavailable"`)
  - Source: `ai-post-preview.js:391-419`

### MiMo Configuration

- Endpoint: `{MIMO_BASE_URL}/chat/completions`
- Auth: `api-key` header
- Model: `mimo-v2.5`, temperature `0.3`, max `2048` tokens, thinking disabled
  - Source: `ai-post-preview.js:343-365`

### Publish Flow

`handleAiPostPublish()` → `normalizeAiPostPayload()` → `createNodebbTopicFromPayload()` → `patchPostMetadata()` → append JSONL

- Source: `ai-light-publish.js:142-236`
- AI posts use the logged-in user's `nodebbUid`, not `NODEBB_UID`
- After publish: writes to `data/post-metadata.json` and `data/ai-post-records.jsonl`

### Hard Boundaries

- AI only generates drafts, never auto-publishes
- Preview endpoint does not write metadata or create topics
- `locationId` is only filled when matched against `static-data.js:mapItems`
- `locationDraft.mapVersion` is always `"legacy"`
  - Source: `ai-post-preview.js:98-101`, `ai-post-preview.js:165`

### Known Rough Edges

- Single image only
- JSONL files (`ai-post-drafts.jsonl`, `ai-post-records.jsonl`) may not exist yet until first use
- MiMo mode requires a real `MIMO_API_KEY`

---

## 5. Feed / Map / Channel Status

### Feed

**Tab structure**: `此刻`, `推荐`, `校园活动`, `报名机会`, `图书馆学习`, `周边玩乐`, `安全通知`, `试验区社团`, `美食菜单`

- Source: `data/feed-rules.json:2-11`

**Three feed modes**:

1. **此刻 (moment)**: independent scoring, higher recency weight (halfLife 48h), vibe/scene tag boosts
   - Source: `feed-service.js:414-443`
2. **推荐 (curated + ranked)**: `curatedSlotsPerPage: 3` + ranked rest hybrid
   - Source: `feed-service.js:520-565`
3. **Category tabs**: filter by tag
   - Source: `feed-service.js:516-519`

**Scoring signals** (from `data/feed-rules.json:57-119`):

- `contentTypeWeights`: `campus_moment` +180, `food` +76, `general` -32
- `missingLocationAreaPenalty`: -26
- `momentContentTypeWeights`: `campus_moment` +46, `general` -24
- `momentMissingLocationAreaPenalty`: -18
- `vibeWeights`: 真实 +30, 在地 +24, 有网感 +20
- `sceneWeights`: 饭点 +18, 夜宵 +18, 路况 +16

**Diversity limits**: `maxSameContentType: 2`, `maxSameLocationArea: 2`, `maxSamePrimaryTag: 4`

- Source: `data/feed-rules.json:121-126`

**Feature flags** (all `true`): `eligibility`, `enhancedScoring`, `diversity`, `momentTab`

- Source: `data/feed-rules.json:51-56`

### Map

**Current state**: static POI list, 10 hardcoded locations (teaching building, canteen, library, dorms, etc.)

- Source: `static-data.js:46-57`

**API**: `GET /api/map/items` returns fixed bounds + items array

- Source: `api-router.js:69-74`

**Map version**: `mapVersion: "legacy"`, no Leaflet, no interactive map

- Source: `ai-post-preview.js:55`

**Planned**: AMap (高德地图) to be introduced. `MAP_V2_TECH_PLAN.md` is the next deliverable. Not yet implemented.

- Source: `docs/agent/05_TASK_BOARD.md:101-114`

### Channel

**Implementation**: reuses NodeBB topic as channel message container

- If `NODEBB_CHANNEL_TOPIC_Tid` exists → reply to that topic
- Otherwise → create new topic (title: "校园频道"), subsequent messages reply to it
  - Source: `channel-service.js:83-118`

**Read tracking**: local JSON file `data/channel-reads.json`, per readerId

- Source: `channel-service.js:63-81`

**Channel identification**: multiple signals — `nodebbChannelTopicTid`, `nodebbChannelCid`, title "校园频道", tag "频道消息", content contains `lian-channel-meta`

- Source: `feed-service.js:124-139`

---

## 6. High-Conflict Files

| File | Lines | Conflict Reason | Lock Level |
|------|-------|-----------------|------------|
| `public/app.js` | 2,151 | All frontend logic in single file, highest conflict risk | **hard-lock** |
| `data/post-metadata.json` | 2,314 | Concurrent writes lose data, only modify own tids | **hard-lock** |
| `src/server/feed-service.js` | 787 | Recommendation core, scoring changes affect all users | **soft-lock** |
| `src/server/post-service.js` | 195 | Publishing core, changes NodeBB creation logic | **soft-lock** |
| `src/server/api-router.js` | 97 | Route mounting, wrong change takes down entire site | **soft-lock** |

Source: `CLAUDE.md` high-conflict files definition

---

## 7. Safe Small Tasks

These tasks do not touch high-conflict files, or are additive-only changes:

1. **Multi-image support**: AI publish flow is currently single-image. `post-service.js:51-57` already has `imageUrls` traversal logic; AI flow only passes the first image.
2. **`validate-locations.js` script**: referenced in task board but does not exist yet. Location model is a sketch; can create a placeholder.
3. **JSONL cleanup script**: `ai-post-drafts.jsonl` and `ai-post-records.jsonl` paths are referenced in code but files may not exist. Can add archive/cleanup tools.
4. **Admin API extensions**: new admin-only stats/query endpoints, no impact on existing logic. `admin-routes.js` already has the pattern.
5. **Feed snapshot script improvements**: `scripts/snapshot-feed.js` exists, can add diff functionality.
6. **Menu prototype iteration**: `menu-prototype*` files are independent experiments, no impact on main app.
7. **Static data expansion**: `static-data.js` `mapItems` and `authInstitutions` are pure data, safe to add entries.

---

## 8. Areas Not Suitable for Immediate Refactoring

1. **`public/app.js`**: 2,151 lines single file. Refactoring to component-based requires full regression testing, and there is no automated test coverage. Unless there is a clear UI framework migration task, do not split.
   - Source: `CLAUDE.md` forbids unauthorized modification of `app.js`

2. **`feed-service.js` scoring logic**: 787 lines, scoring weights have been tuned through measured snapshot comparisons. Refactoring requires before/after snapshot verification first.
   - Source: `docs/agent/handoffs/feed-optimization.md` has complete snapshot data

3. **NodeBB integration layer**: `nodebb-client.js` + `post-service.js` `createNodebbTopicFromPayload()` is the unified entry for both publishing paths. Refactoring affects both manual and AI posting.
   - Source: `post-service.js:87` is shared by `handleCreatePost` and `handleAiPostPublish`

4. **Auth system**: `auth-service.js` 335 lines, contains password hashing, email verification, session management, NodeBB uid mapping, invite codes. Changing one part affects many others.
   - Source: `auth-service.js` is depended on by all authenticated APIs

5. **`data/post-metadata.json`**: 2,314 lines, read by `loadMetadata()` and written by `patchPostMetadata()` in multiple files. Any format change requires syncing all consumers.
   - Source: `data-store.js` `loadMetadata`/`patchPostMetadata` used by `feed-service.js`, `post-service.js`, `ai-light-publish.js`, `admin-routes.js`

6. **`api-router.js` route structure**: currently if-else chain. Switching to Express/Koa-style routing requires changing all handler signatures and middleware logic. Benefit is unclear, risk is high.
   - Source: `api-router.js:27-94` all handlers use `async (req, reqUrl, res)` signature

---

## Appendix: Technology Stack

- **Runtime**: Node.js ESM (`"type": "module"`)
- **Dependencies**: zero npm dependencies (`package.json` has no `dependencies`)
- **Frontend**: vanilla JS, single file 2,151 lines, no framework
- **Backend**: native `http.createServer`, no Express/Koa
- **Images**: Cloudinary upload + LIAN image proxy
- **Email**: Resend API or raw SMTP (`auth-service.js:128-235`)
- **Data storage**: JSON files + in-memory cache (`cache.js`)
- **Testing**: no automated tests, verification via manual `node --check` + curl

Source: `package.json`, `server.js`, `cache.js`

---

## Appendix: Data Files

| File | Lines | Purpose |
|------|-------|---------|
| `data/post-metadata.json` | 2,314 | Post metadata (tid → metadata object) |
| `data/feed-rules.json` | 127 | Feed configuration, scoring weights, tabs |
| `data/auth-users.json` | (gitignored) | User accounts, sessions, nodebbUid mapping |
| `data/channel-reads.json` | needs verification | Channel read state per readerId |
| `data/clubs.json` | needs verification | Club data |
| `data/study-hn-club-discoveries.json` | needs verification | Study group discoveries |

## Appendix: Scripts

| Script | Purpose |
|--------|---------|
| `scripts/validate-post-metadata.js` | Validates `post-metadata.json` structure |
| `scripts/snapshot-feed.js` | Generates feed snapshot for comparison |
| `scripts/validate-project-structure.js` | Read-only project health checks |
| `scripts/seed-photo-post-candidates.js` | Seeds photo post candidates (needs verification on exact purpose) |
