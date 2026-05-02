# NodeBB Integration

Date: 2026-05-02
Updated: 2026-05-02 — added Failure Modes section

This document defines the current and future integration boundary between LIAN and NodeBB.

## Strategic Role

NodeBB remains the content backend and community system of record.

LIAN should not rebuild core forum infrastructure. LIAN should use NodeBB for:

- topics;
- replies;
- NodeBB users;
- tags;
- categories;
- notifications;
- future groups / privileges / moderation primitives.

LIAN owns the campus product layer:

- feed ranking and feed-debug;
- `post-metadata.json` and future metadata DB;
- Map v2 locations, areas, routes, icons, and post overlays;
- AI post preview, AI drafts, and AI publish records;
- identity/alias presentation in the mobile web layer;
- future audience rules, school/org membership, and campus-specific access model.

## Current Configuration

Source: `src/server/config.js`

| Env | Meaning |
|---|---|
| `NODEBB_BASE_URL` | Server-side NodeBB API base URL. May be private/internal. |
| `NODEBB_PUBLIC_BASE_URL` | Browser-facing NodeBB base URL for links/assets. Must not be `127.0.0.1` in production. |
| `NODEBB_API_TOKEN` | API token used for NodeBB write operations. Never return to frontend. |
| `NODEBB_UID` | Default/fallback NodeBB uid. Current product publish flows should use logged-in user's uid. |
| `NODEBB_CID` | Default topic category id for regular posts. |
| `NODEBB_CHANNEL_CID` | Optional category id for channel topic creation. |
| `NODEBB_CHANNEL_TOPIC_TID` | Optional fixed channel topic tid. If set, channel messages reply to this topic. |

## Current NodeBB Client

Source: `src/server/nodebb-client.js`

`nodebbFetch(apiPath, options)` is the only generic NodeBB HTTP helper.

Current behavior:

- resolves `apiPath` relative to `config.nodebbBaseUrl`;
- appends `_uid=config.nodebbUid` unless `_uid` already exists;
- adds `x-api-token: NODEBB_API_TOKEN` when no explicit `authorization` header is present;
- parses JSON responses;
- throws a 502-style error when LIAN cannot connect to NodeBB;
- throws an HTTP-status error when NodeBB returns non-2xx.

`withNodebbUid(apiPath, uid)` is used when a request must run as a specific NodeBB user. It adds `_uid=<uid>` to the API path.

## Current Endpoint Usage

| LIAN area | LIAN file/helper | NodeBB endpoint |
|---|---|---|
| Feed topic index | `fetchNodebbTopicIndex()` / `getRecentTopics()` | `GET /api/recent?page=<page>` |
| Topic detail | `getTopicDetail(tid)` | `GET /api/topic/:tid` |
| Tags | route in `api-router.js` | `GET /api/tags` |
| Regular topic create | `createNodebbTopicFromPayload()` | `POST /api/v3/topics?_uid=<userUid>` |
| AI confirmed publish | `handleAiPostPublish()` -> `createNodebbTopicFromPayload()` | `POST /api/v3/topics?_uid=<userUid>` |
| Replies | `replyToNodebbTopic()` | `POST /api/v3/topics/:tid` then fallback `POST /api/v3/topics/:tid/posts` |
| Mark topic read | `markNodebbTopicRead()` | `POST/PUT /api/v3/topics/:tid/read` then fallback `/api/topic/:tid/read` |
| Notifications | `handleMessages()` | `GET /api/notifications` |
| Current fallback user | `handleMe()` | `GET /api/user/uid/:uid` |
| Find NodeBB user | `findNodebbUserByUsername()` | `GET /api/users?query=...`, fallback `GET /api/search/users?query=...` |
| Create NodeBB user | `createNodebbUserForLian()` | `POST /api/v3/users` |

## Publish Path

### Regular post

```text
POST /api/posts
  -> handleCreatePost()
  -> requireUser()
  -> createNodebbTopicFromPayload(auth, payload)
  -> ensureNodebbUid(auth)
  -> nodebbFetch(POST /api/v3/topics?_uid=<current user's nodebbUid>)
  -> patchPostMetadata(tid, image/map metadata)
  -> clear feed cache
```

### AI confirmed publish

```text
POST /api/ai/post-publish
  -> handleAiPostPublish()
  -> requireUser()
  -> normalize AI payload
  -> createNodebbTopicFromPayload(auth, normalized payload)
  -> ensureNodebbUid(auth)
  -> nodebbFetch(POST /api/v3/topics?_uid=<current user's nodebbUid>)
  -> patchPostMetadata(tid, normalized metadata)
  -> append ai-post-records.jsonl
  -> clear feed cache
```

Product rule:

- AI does not automatically publish.
- AI publish uses the same formal user-owned NodeBB path as regular publish.
- `NODEBB_UID=2` may be useful for local smoke tests or platform fallback experiments, but it is not the default product behavior.

## User Mapping

Source: `src/server/auth-service.js`

LIAN users are stored in LIAN auth storage. NodeBB users are linked lazily.

Current mapping logic:

1. `ensureNodebbUid(auth)` checks `auth.user.nodebbUid`.
2. If missing, LIAN searches NodeBB by username.
3. If no matching NodeBB user is found, LIAN creates one through `POST /api/v3/users`.
4. LIAN stores `nodebbUid`, `nodebbUsername`, and `nodebbLinkedAt` in the local auth store.

Architecture rule:

- LIAN remains the source for campus auth, school/institution tags, aliases, and future org membership.
- NodeBB uid is the bridge for topic/reply ownership.

## Feed Path

```text
NodeBB /api/recent
  -> normalizeTopic()
  -> load post-metadata.json
  -> merge LIAN metadata
  -> isFeedEligible()
  -> score / curate / diversify
  -> hydrate selected items with /api/topic/:tid
  -> /api/feed response
```

NodeBB owns raw topic/reply content.

LIAN owns:

- content type;
- vibe/scene tags;
- location metadata;
- risk/official scores;
- distribution;
- visibility display field;
- feed ranking;
- feed-debug explanation.

## Replies, Channel, And Messages

Replies:

- `POST /api/posts/:tid/replies`
- uses current LIAN user;
- resolves current user's NodeBB uid;
- posts through `replyToNodebbTopic()`.

Channel messages:

- `POST /api/channel/messages`
- if `NODEBB_CHANNEL_TOPIC_TID` exists, writes a reply to that topic;
- otherwise creates a topic in `NODEBB_CHANNEL_CID`;
- embeds `lian-channel-meta` in the post HTML.

Messages:

- `GET /api/messages`
- reads NodeBB `/api/notifications`;
- LIAN currently returns a simplified notification list.

## What NodeBB Should Own Long Term

NodeBB is a good fit for:

- durable topic and reply storage;
- topic edit/delete/moderation primitives;
- NodeBB user identities and posting ownership;
- notifications;
- reports/flags;
- category-level hard access boundaries;
- group membership mirrors for hard permissions;
- tags/categories when they are forum-level concepts.

## What LIAN Should Own Long Term

LIAN should keep these out of NodeBB as first-class business data:

- Map v2 locations, polygons, routes, icons, cards;
- AI post previews, drafts, and publish records;
- feed ranking and feed-debug;
- metadata and distribution rules;
- campus-specific content type taxonomy;
- school/org membership as the primary product model;
- future audience rules;
- analytics, snapshots, and operational reports.

NodeBB can mirror parts of these concepts for enforcement, but it should not become the only source of truth for LIAN-specific product state.

## Future Architecture: Audience And Permissions

For multi-school and multi-organization LIAN, use a hybrid model.

### LIAN-owned audience model

LIAN should define:

```json
{
  "visibility": "school",
  "schoolIds": ["cuc-hainan"],
  "orgIds": [],
  "roleIds": [],
  "userIds": [],
  "linkOnly": false
}
```

LIAN should evaluate:

- `canViewPost(user, post)`;
- `canCreatePostWithAudience(user, audience)`;
- `canReplyToPost(user, post)`;
- `canModeratePost(user, post)`;
- `canSeeAudienceOption(user, option)`.

### NodeBB hard-boundary mirrors

NodeBB groups/categories should be used where a hard forum-level boundary is needed:

- `school:<schoolId>`;
- `org:<orgId>`;
- `role:lian-admin`;
- `role:lian-moderator`;
- `role:map-editor`.

Possible category split:

- `LIAN Public`;
- `LIAN Campus Verified`;
- `LIAN Restricted`;
- `LIAN Archive`;
- `LIAN Channel`.

Recommended approach:

- public/campus content can live in public or campus categories;
- organization, private, linkOnly, or test content should use a restricted category and LIAN audience filtering;
- do not create one NodeBB category for every dynamic audience combination.

## Future Plugin Boundary

A NodeBB plugin may eventually be useful for:

- enforcing LIAN audience checks inside NodeBB topic views;
- syncing LIAN groups to NodeBB groups;
- customizing reports/moderation metadata;
- preventing raw NodeBB links from bypassing LIAN permissions.

Do not start with a plugin.

First implement LIAN-side audience checks and NodeBB restricted categories. Only write a NodeBB plugin when raw NodeBB access becomes a proven leak or moderation need.

## Failure Modes

### Connection failure

`nodebbFetch` throws `502` when NodeBB is unreachable. LIAN API returns 502 to the client.

### Auth behavior

| Scenario | Auth header |
|---|---|
| Read operations (feed, tags, notifications, user lookup) | `x-api-token: NODEBB_API_TOKEN` (auto-added by `nodebbFetch`) |
| Topic/reply creation | Explicit `Authorization: Bearer NODEBB_API_TOKEN` (overrides auto-add) |
| User creation | Explicit `Authorization: Bearer NODEBB_API_TOKEN` |

When `NODEBB_API_TOKEN` is missing, all write operations return 500 ("LIAN API token is missing"). Read operations may still work if NodeBB allows anonymous access.

### Topic creation failure

- NodeBB returns non-2xx → `nodebbFetch` throws with NodeBB's error message
- NodeBB returns `status.code !== "ok"` → LIAN throws 400
- `patchPostMetadata` not called → no metadata written, no orphan metadata
- AI publish: error record appended to `ai-post-records.jsonl` with status "error"

### Metadata write failure after successful topic creation

- `patchPostMetadata` fails after topic is created in NodeBB
- AI publish: error record appended with status "metadata_error", includes `tid` and `url`
- API returns 500 with `tid` and `url` so the topic is not lost
- Regular publish (`handleCreatePost`): similar pattern — topic exists in NodeBB but metadata may be incomplete

### Reply fallback

`replyToNodebbTopic` tries two endpoints in order:
1. `POST /api/v3/topics/:tid` (NodeBB v3 write API)
2. `POST /api/v3/topics/:tid/posts` (legacy API)

If endpoint 1 returns 404 or 405, tries endpoint 2. Other errors propagate immediately.

### Channel topic creation

- If `NODEBB_CHANNEL_TOPIC_TID` is set, channel messages reply to that topic
- If not set, first channel message creates a new topic in `NODEBB_CHANNEL_CID`
- Created topic tid is cached in `config.nodebbChannelTopicTid` for subsequent messages

### Feed read failure

- `getRecentTopics` / `getTopicDetail` cache results for 60s / 180s
- On fetch failure, stale cache is NOT returned — error propagates
- `fetchNodebbTopicIndex` uses `retryApi` with 3 attempts and 450ms backoff

### Notifications

- `handleMessages` catches all errors and returns empty `items: []`
- Never fails the request

## Current Gaps

- `visibility` is metadata today, not full access control.
- `/api/posts/:tid` does not yet apply audience checks.
- `/api/feed` does not yet filter by school/org visibility.
- `/api/map/v2/items` can expose posts with coordinates without audience filtering.
- `/api/messages` currently proxies NodeBB notifications without LIAN audience filtering.
- NodeBB groups/categories are not yet synchronized from LIAN school/org state.
- `auth-users.json` and JSON metadata are prototype storage, not a long-term multi-school permission store.

## Near-Term Work Packages

### nodebb-integration-audit

Confirm every NodeBB endpoint, method, auth header, `_uid` behavior, and error path.

Deliverable:

- endpoint audit table;
- smoke commands;
- failure-mode notes.

### audience-permission-design

Design the LIAN audience model before implementing multi-school/org visibility.

Deliverable:

- audience schema;
- permission functions;
- API surfaces that must call `canViewPost`;
- feed/detail/map/search/channel/notification filtering rules.

### nodebb-groups-sync-plan

Design how LIAN school/org membership will mirror into NodeBB groups.

Deliverable:

- group naming convention;
- sync triggers;
- failure handling;
- migration plan for existing users.

### nodebb-restricted-category-plan

Plan which LIAN content goes into public/campus/restricted NodeBB categories.

Deliverable:

- category matrix;
- content routing rules;
- raw NodeBB link leakage analysis.

## Non-Goals For Now

- Replacing NodeBB.
- Moving feed ranking into NodeBB.
- Moving Map v2 data into NodeBB.
- Rebuilding NodeBB notification system.
- Writing a NodeBB plugin before LIAN-side audience checks exist.
- Adding payments, task markets, errands, or drone workflows.

