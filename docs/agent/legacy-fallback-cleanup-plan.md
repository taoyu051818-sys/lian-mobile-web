# Canonical Actor/Place Cleanup Execution Plan

Status: active execution for #68  
Date: 2026-05-06  
Scope: frontend cleanup after backend DTO contract freeze

## Current contract status

The backend migration window is closed for actor/source response DTOs.

Authoritative backend references:

- `taoyu051818-sys/lian-platform-server#71`: removed legacy author/avatar/identity/alias response fields from FeedItem, PostDetail, Reply, and Channel DTOs.
- `taoyu051818-sys/lian-platform-server#72`: documented the current canonical DTO contract.
- `taoyu051818-sys/lian-platform-server#73`: frontend/product review accepted the contract freeze.
- `taoyu051818-sys/lian-platform-server#67`: backend cleanup closed as completed.

Canonical identity contract:

```text
actor = display identity
actor.identityTag = optional trust/contribution signal
source = platform/import/provider metadata
```

Canonical place relation contract:

```text
PlaceRef = stable place identity used to open PlaceSheet
PlaceSheet = stable place surface
locationArea/manual text = display fallback only
relation identity = stable id only via locationId/placeId
```

## Removed backend response fields

Do not rely on these fields in new frontend code:

```text
author
authorAvatarUrl
authorIdentityTag
username
identityTag
avatarText
avatarUrl
authorAvatarText
authorAliasId
authorAliasName
authorActorSource
```

`locationArea` remains allowed only as display text when no stable `PlaceRef` exists. It must not be used as place identity.

## Active frontend work

Current PR:

- `#81 refactor(detail): remove legacy PostDetail author fields`

Committed in #81:

- `src/types/post.ts`: removed legacy `PostDetail` / `PostReply` flat author fields.
- `src/types/feed.ts`: removed legacy `FeedItem.author`.

Still required before #81 can leave draft:

### PostDetailPanel.vue

Update `src/views/detail/PostDetailPanel.vue` so Detail main post and replies depend only on canonical `actor`:

```diff
- const authorLabel = computed(() => actorDisplayName(props.post?.actor, props.post?.author));
- const authorAvatarUrl = computed(() => actorAvatarUrl(props.post?.actor, props.post?.authorAvatarUrl));
+ const authorLabel = computed(() => actorDisplayName(props.post?.actor));
+ const authorAvatarUrl = computed(() => actorAvatarUrl(props.post?.actor));

- function actorDisplayName(actor?: DisplayActor | null, fallback = "") {
-   return actor?.displayName || actor?.username || actor?.name || fallback || "同学";
- }
+ function actorDisplayName(actor?: DisplayActor | null) {
+   return actor?.displayName || actor?.username || actor?.name || "同学";
+ }

- function actorAvatarUrl(actor?: DisplayActor | null, fallback = "") {
-   return actor?.avatarUrl || fallback || "";
- }
+ function actorAvatarUrl(actor?: DisplayActor | null) {
+   return actor?.avatarUrl || "";
+ }

- return actorDisplayName(reply.actor, reply.author);
+ return actorDisplayName(reply.actor);
```

### FeedItemCard.vue

Update `src/views/feed/FeedItemCard.vue` so Feed cards depend only on canonical `actor`:

```diff
- const actor = computed<DisplayActor>(() => props.item.actor || props.item.author || {});
+ const actor = computed<DisplayActor>(() => props.item.actor || {});
```

## Cleanup stages

### Stage 1: Feed

Goal: Feed cards no longer read `item.author` or flat author fields.

Status:

- Types cleanup started in #81.
- Component cleanup still needs the `FeedItemCard.vue` patch listed above.

Acceptance:

- Feed author display uses `item.actor.displayName` / `username` / `name` only.
- Feed card does not reference `item.author`, `authorAvatarUrl`, or `authorIdentityTag`.
- Feed e2e item in #63/#67 passes.

### Stage 2: Post Detail

Goal: Detail main post and replies no longer read flat legacy author fields.

Status:

- Types cleanup started in #81.
- Component cleanup still needs the `PostDetailPanel.vue` patch listed above.

Acceptance:

- Detail header author uses `post.actor` only.
- Reply author uses `reply.actor` only.
- Detail UI does not reference `post.author`, `post.authorAvatarUrl`, `post.authorIdentityTag`, `reply.author`, `reply.authorAvatarUrl`, or `reply.authorIdentityTag`.
- `post.place?.id` opens PlaceSheet.
- `locationArea` is displayed only when no stable `post.place.id` exists.

### Stage 3: Map

Goal: Map/place UI does not infer PlaceRef from display text.

Status:

- Verify after Detail/Feed cleanup.

Acceptance:

- Map selected location opens PlaceSheet from stable place id.
- Map nearby content still opens PostDetail.
- `locationArea`, marker text, color, provider, and source labels are not used as relation identity.

### Stage 4: Publish

Goal: Publish uses structured place binding and does not create fake stable ids from manual text.

Status:

- Verify after Detail/Feed cleanup.

Acceptance:

- Known location sends `locationDraft.placeId` / `locationDraft.place`.
- Manual location text remains display fallback only.
- Publish success prefers `response.place.name` when backend returns `place?: PlaceRef`.

## Search checklist before marking #68 complete

Run repository searches or equivalent checks for runtime references to:

```text
authorAvatarUrl
authorIdentityTag
authorAliasId
authorAliasName
authorActorSource
props.post?.author
props.post?.authorAvatarUrl
reply.author
props.item.author
item.author
```

Expected result:

- No runtime component/type dependency on removed backend fields.
- Historical docs may mention these fields only as removed/stale contract references.

## Validation checklist

Use frontend #67 as the e2e acceptance checklist.

Minimum checks after #81:

- Feed card author displays from `actor` and never shows `[object Object]`.
- Detail main post author displays from `post.actor`.
- Detail reply author displays from `reply.actor`.
- Source/provider/NodeBB labels do not appear as identity UI.
- Detail `post.place.id` opens PlaceSheet.
- Detail without `post.place.id` shows `locationArea` only as plain fallback text.
- Publish known location sends structured place binding.
- Publish manual location does not create stable PlaceRef.

## Non-goals

- Do not change PlaceSheet product shape in this cleanup PR.
- Do not mix with auth, motion, deploy, or strategy issues.
- Do not reintroduce legacy backend DTO fields for convenience.
- Do not guess runtime commands, ports, or service names.
