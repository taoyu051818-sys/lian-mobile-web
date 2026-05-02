# NodeBB Integration

Date: 2026-05-02
Updated: 2026-05-02 — added Failure Modes section, added Native Capability Audit (8-Point Checklist)

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
- likes/upvotes, if product semantics match;
- bookmarks/favorites, if product semantics match;
- read state / browsing history, with LIAN privacy rules;
- reports/flags;
- moderation queues;
- user groups and category privileges;
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
| Like/upvote first post | `handleTogglePostLike()` | `PUT /api/v3/posts/:pid/vote` with `{ "delta": 1 }`, `DELETE /api/v3/posts/:pid/vote` to undo |
| Bookmark/save first post | `handleTogglePostSave()` | `PUT /api/v3/posts/:pid/bookmark`, `DELETE /api/v3/posts/:pid/bookmark` |
| Report/flag post | `handleReportPost()` | `POST /api/v3/posts/:pid/flag` with `{ reason }` |
| User bookmarks list | `handleGetSavedPosts()` | `GET /api/user/:slug/bookmarks` |
| User upvoted list | `handleGetLikedPosts()` | `GET /api/user/:slug/upvoted` |
| Mark topic read | `markNodebbTopicRead()` | `POST/PUT /api/v3/topics/:tid/read` then fallback `/api/topic/:tid/read` |
| Notifications | `handleMessages()` | `GET /api/notifications` |
| Current fallback user | `handleMe()` | `GET /api/user/uid/:uid` |
| Find NodeBB user | `findNodebbUserByUsername()` | `GET /api/users?query=...`, fallback `GET /api/search/users?query=...` |
| Create NodeBB user | `createNodebbUserForLian()` | `POST /api/v3/users` |

## Native Capability Inventory

This is a planning inventory. Do not implement all items at once. Pick one integration cut, write a task doc, and validate the NodeBB endpoint shape before touching product UI.

### P0/P1 Candidates

| Capability | NodeBB role | LIAN product meaning | Suggested LIAN surface | Integration status | Priority |
|---|---|---|---|---|---|
| Reply/comment | Source of truth for replies | Post discussion | Detail page | partially integrated | P0 polish |
| Notifications | Source of truth for topic/user notifications | Message center and activity reminders | Messages page | partially integrated | P0 polish |
| Read state | Tracks topic read/unread state | Browsing history, unread badges, continue reading | Feed/detail/messages | partially integrated via mark read | P1 |
| Likes/upvotes | Source of truth if LIAN treats it as appreciation | Lightweight positive feedback | Feed cards, detail page | first feed-card cut implemented | P1 |
| Bookmarks/favorites | Source of truth if NodeBB bookmark semantics fit | Save post for later | Detail page, profile "我的收藏" | detail + profile list implemented | P1 |
| Reports/flags | Source of truth for moderation signals | Report privacy issue, false info, abuse | Detail page only | detail implemented, needs operator workflow | P1 |
| Topic edit/delete | NodeBB durable content operations | Author correction, admin takedown | Detail author menu/admin | not integrated | P1/P2 |
| Groups | Hard permission mirror | school/org/category boundaries | auth/admin/audience | planned | P1/P2 |
| Category privileges | Hard forum-level access boundary | public/campus/restricted categories | publish/audience | planned | P1/P2 |

### P2 / Later Candidates

| Capability | NodeBB role | LIAN product meaning | Suggested LIAN surface | Reason to wait |
|---|---|---|---|---|
| Polls | Native/plugin feature depending on NodeBB setup | Campus voting / activity decisions | Post composer/detail | Needs product rules and moderation |
| Topic following/watching | Notification preference | Follow a post/location/org | Detail and location pages | Needs notification strategy |
| User reputation | Native community signal | Contributor trust, not gamification | Profile/admin | Risk of noisy gamification |
| Private messages/chat | Native messaging | Direct communication | Messages | Brings harassment, transaction, and moderation risk |
| Badges/achievements | Native or plugin feature | Map contributor badges | Profile/tasks | Better after contribution model is stable |

## Native Capability Audit (8-Point Checklist)

Date: 2026-05-02

Each capability below is audited against the 8-point checklist from the task doc. Items verified from LIAN code are marked [code]. Items from NodeBB v3 API knowledge are marked [api] and need runtime smoke tests.

### Like / Upvote

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `PUT /api/v3/posts/:pid/vote` (like), `DELETE /api/v3/posts/:pid/vote` (unlike). Fallback: `/api/v3/posts/:pid/votes`. [code] |
| 2 | Level | Post-level. LIAN operates on the first post of a topic. [code] |
| 3 | Auth | `Authorization: Bearer NODEBB_API_TOKEN` + `_uid=<real user>`. [code] |
| 4 | Response | `{ status: { code: "ok" }, ... }`. LIAN re-fetches topic to get synced count. [code] |
| 5 | Idempotent | PUT is idempotent (repeated PUT = still liked). DELETE is idempotent. [api] |
| 6 | No permission | Returns 401/403 if `_uid` is invalid or token is wrong. [api] |
| 7 | Source of truth | NodeBB is source of truth for like state and count. LIAN does not cache. [code] |
| 8 | Failure mode | Connection fail → 502. Non-2xx → error propagated. Feed cache cleared on toggle. [code] |

Status: **First feed-card cut implemented.** Needs detail-page surface and validation.

### Save / Bookmark

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `PUT /api/v3/posts/:pid/bookmark` (save), `DELETE /api/v3/posts/:pid/bookmark` (unsave). [api] |
| 2 | Level | Post-level. Bookmark is on individual posts, not topics. [api] |
| 3 | Auth | `x-api-token` + `_uid=<real user>`. [api] |
| 4 | Response | `{ status: { code: "ok" } }`. Bookmarked state available in topic detail response (`posts[].bookmarked`). [api] |
| 5 | Idempotent | PUT is idempotent. DELETE is idempotent. [api] |
| 6 | No permission | 401 if not logged in. No special permission otherwise. [api] |
| 7 | Source of truth | NodeBB is source of truth. LIAN should NOT duplicate bookmark state. |
| 8 | Failure mode | Connection fail → 502. Saved list needs audience filter (saved post may become inaccessible). |

Status: **Not integrated.** Needs: endpoint smoke test, saved-list UI, audience enforcement on saved list.

Product placement:

- Save/bookmark belongs on the post detail page, not on homepage cards.
- Homepage cards should not receive more actions beyond the existing like cut.
- Saved posts appear in profile under "我的收藏".
- Posts are the core saved unit. If a post includes a location, users navigate to that location from the post detail page.
- Do not create a separate location collection/favorite model in this phase.

### Read State / Browsing History

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `PUT /api/v3/topics/:tid/read` (mark read). Fallback: `POST /api/topic/:tid/read`. [code] |
| 2 | Level | Topic-level. Marks entire topic as read. [code] |
| 3 | Auth | `x-api-token` + `_uid=<real user>`. [code] |
| 4 | Response | `{ status: { code: "ok" } }`. Read state available in topic index (`topics[].teaser.timestamp` comparison). [api] |
| 5 | Idempotent | Yes, marking read is idempotent. [api] |
| 6 | No permission | 401 if not logged in. No special permission. [api] |
| 7 | Source of truth | NodeBB is source of truth for read/unread. LIAN should not duplicate. |
| 8 | Failure mode | Current `markNodebbTopicRead()` silently catches errors. Feed card visited state is LIAN-side only. |

Status: **Partially integrated** (mark-read on detail open). Needs: unread badge on feed cards, optional history page.

Privacy rule: mark read on detail open only, not on card impression. Do not expose other users' read history.

Product placement:

- Browsing history belongs in profile.
- Only the current user can see their own browsing history.
- Feed cards should not show browsing-history controls.

### Report / Flag

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `POST /api/v3/posts/:pid/flag` with body `{ reason: "..." }`. [api] |
| 2 | Level | Post-level. Flags a specific post. [api] |
| 3 | Auth | `x-api-token` + `_uid=<real user>` (the reporter). [api] |
| 4 | Response | `{ status: { code: "ok" } }`. Report goes to NodeBB moderation queue. [api] |
| 5 | Idempotent | Not idempotent — may create duplicate flags. Check NodeBB behavior. [api] |
| 6 | No permission | 401 if not logged in. May require minimum reputation on some setups. [api] |
| 7 | Source of truth | NodeBB moderation queue is source of truth. LIAN should add campus-specific metadata (report category, location context). |
| 8 | Failure mode | Connection fail → 502. No moderation queue UI in LIAN yet — reports go to NodeBB admin only. |

Status: **Not integrated.** Needs: runtime smoke test, report UI in detail page, LIAN-side report category metadata, operator moderation workflow.

Risk: must define where operators see reports before enabling broad reporting.

Product placement:

- Report/flag belongs on the post detail page only.
- Do not put report actions on homepage cards in the first version.
- Detail page report categories should include privacy issue, false information, abuse, wrong location, expired content, and visibility/audience mistake.

### Topic Edit / Delete / Hide

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `PUT /api/v3/topics/:tid` (edit title/tags), `PUT /api/v3/topics/:tid/state` (soft delete/restore), `DELETE /api/v3/topics/:tid` (hard delete). [api] |
| 2 | Level | Topic-level. Affects the whole topic, not individual posts. [api] |
| 3 | Auth | `Authorization: Bearer NODEBB_API_TOKEN` + `_uid=<user>`. Owner or admin. [api] |
| 4 | Response | `{ status: { code: "ok" } }`. [api] |
| 5 | Idempotent | State toggle is idempotent (repeated delete = still deleted). Edit is not idempotent. [api] |
| 6 | No permission | 403 if user is not owner and not admin. [api] |
| 7 | Source of truth | NodeBB is source of truth for topic state. LIAN `post-metadata.json` must be synced on edit/delete. |
| 8 | Failure mode | Metadata desync: topic deleted in NodeBB but metadata remains in LIAN. Need cleanup strategy. |

Status: **Not integrated.** Needs: author menu in detail page, admin moderation UI, metadata sync on edit/delete.

Risk: LIAN metadata and NodeBB topic state must stay in sync. Consider soft-delete only for first cut.

### Groups / Category Privileges

| # | Item | Finding |
|---|---|---|
| 1 | Endpoint | `POST /api/v3/groups` (create), `PUT /api/v3/groups/:slug/membership` (add member), `DELETE /api/v3/groups/:slug/membership` (remove). Category: `PUT /api/v3/categories/:cid/privileges`. [api] |
| 2 | Level | Group-level and category-level. Groups are global; privileges are per-category. [api] |
| 3 | Auth | `Authorization: Bearer NODEBB_API_TOKEN` + `_uid=<admin>`. Admin-only for group/privilege management. [api] |
| 4 | Response | `{ status: { code: "ok" } }`. [api] |
| 5 | Idempotent | Add membership is idempotent. Remove membership is idempotent. [api] |
| 6 | No permission | 403 if user is not admin. [api] |
| 7 | Source of truth | LIAN owns school/org membership. NodeBB groups mirror hard access boundaries. |
| 8 | Failure mode | Group sync failure → user loses access to restricted content. Need reconciliation job. |

Status: **Planned, not integrated.** Blocked on: audience permission design, school/org membership model.

Rule: LIAN owns school/org membership first. NodeBB groups/categories mirror hard access boundaries.

## Integration Cut Options

Wait for an explicit product cut before implementation. Good first cuts:

### Cut A: Like Button

Goal:

- Add a simple "like" or "useful" action to feed/detail.
- Use NodeBB's native vote/like capability if the endpoint matches the installed NodeBB version.
- LIAN can later use count as a ranking signal, but the first cut must not change feed ranking.

First implementation:

- feed cards replace the old right-side time label with a like button;
- empty heart `♡` means not liked;
- filled red heart `♥` means liked;
- count is shown next to the heart;
- LIAN calls `POST /api/posts/:tid/like`, which toggles the first post's NodeBB vote state;
- feed ranking is unchanged.

Surfaces:

- feed card action;
- post detail action;
- optional count display.

Risks:

- NodeBB endpoint/version differences;
- duplicate local state if LIAN stores counts separately;
- feed ranking should not change in the first PR.

### Cut B: Save / Favorite

Goal:

- Let users save posts.
- Prefer NodeBB bookmark/favorite if it maps cleanly.
- LIAN may later show saved posts in profile.

Surfaces:

- detail action;
- "Saved" section in profile.
- no homepage card action.

Risks:

- NodeBB bookmark semantics may be per-post or per-topic depending on version/plugins;
- private/audience posts must not leak through saved list.

### Cut C: Browsing History / Read State

Goal:

- Use NodeBB read-state primitives to track topic read/unread.
- LIAN can show visited/read markers and continue-reading history.

Surfaces:

- messages/unread badge;
- profile browsing-history page/list.
- no homepage card control.

Risks:

- privacy expectations;
- read-state calls on every card impression would be too noisy. Only mark on actual detail open.

### Cut D: Report / Flag

Goal:

- Add a report action for privacy, false information, abuse, wrong location, expired content, or organization visibility mistake.
- Use NodeBB report/flag primitives when possible.
- LIAN should attach campus-specific report metadata if supported or store a LIAN-side audit record.

Surfaces:

- detail page overflow menu;
- admin moderation page later.

Risks:

- moderation queue ownership;
- reports need operator workflow, not just an API call.

## Endpoint Verification Rule

Before implementing any new NodeBB native capability:

1. Inspect the installed NodeBB API docs/version or test against the local instance.
2. Add an endpoint row to this document.
3. Confirm auth mode and `_uid` behavior.
4. Confirm failure shape and status codes.
5. Decide whether LIAN stores only a mirror/cache or treats NodeBB as the source of truth.
6. Add a narrow task doc.

Do not infer endpoint names from memory inside product code.

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
- likes/upvotes, bookmarks, read-state, reports, and notifications when NodeBB's native semantics match LIAN's product intent.

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
- Adding all native NodeBB features at once without a product cut.
