# PlaceSheet Product Surface Decision

Status: proposal for #69  
Date: 2026-05-06  
Scope: product/design decision only

## Decision

Use PlaceSheet as the primary MVP place surface across Detail, Map, and Publish success.

The default product shape should be a bottom-sheet style surface, not a full dedicated place route for MVP.

A dedicated Place page can be introduced later when places become durable co-building objects with deeper history, contribution review, correction threads, and shareable canonical URLs.

## Why

PlaceSheet is already integrated into the MVP flows:

- Detail place pill opens a place surface when `post.place.id` exists.
- Map selected location opens a place surface from structured `place` / `placeId`.
- Publish can bind a selected known place through `locationDraft.placeId` / `locationDraft.place`.

Keeping the first product surface as PlaceSheet avoids turning the #63 contract review into a broader navigation redesign. It also gives LIAN a contained place-object experiment without overbuilding a full GitHub-like object system too early.

## Product principle

PlaceSheet should behave like a durable object preview, not just a tooltip.

It should answer:

1. What is this place?
2. Why is LIAN showing this place?
3. What recent campus content is connected to it?
4. How can a user correct or contribute to it later?

It should not treat provider/source metadata as identity or trust UI.

## MVP surface model

### Detail

When `post.place.id` exists:

- location pill is interactive;
- tapping opens PlaceSheet;
- PlaceSheet title comes from structured place data;
- fallback `locationArea` may be visible only as supporting display text.

When `post.place.id` is absent:

- `locationArea` remains plain text;
- no stable PlaceRef is fabricated;
- no PlaceSheet opens from fallback-only text.

### Map

When selected location has structured place data:

- selected place can open PlaceSheet;
- `查看附近内容` remains a separate path to post detail;
- PlaceSheet should not replace the nearby-content path.

When selected location lacks structured place data:

- show fallback location display only;
- do not infer stable place identity from text, color, provider, or status copy.

### Publish success

When publishing with a known selected place:

- success UI should prefer `response.place.name` if the backend returns `place?: PlaceRef`;
- the success state may offer `查看地点` only if a stable `place.id` exists;
- otherwise, show submitted display text without creating PlaceRef client-side.

## Surface anatomy

Recommended MVP anatomy:

1. Header
   - place name
   - compact type/status text when available
   - close action

2. Summary
   - short description or empty-state copy: `这个地点还在沉淀信息。`
   - no provider/source-as-identity label

3. Stats
   - post count
   - correction count, if available
   - saved count, if available

4. Recent content
   - first 3 recent posts
   - author display uses actor contract
   - tapping a recent post opens post detail, not nested sheet recursion

5. Future contribution affordance
   - disabled or low-prominence entry for correction/contribution until backend review flow exists
   - copy should frame this as `补充 / 纠错`, not as points or identity ranking

## Metadata visibility

### Status

Status may be shown as a neutral state label when it is structured backend data:

- confirmed -> 已确认
- pending -> 待确认
- disputed -> 有争议
- expired -> 可能过期
- ai-organized -> AI 整理
- official -> 官方

Status should not be inferred by frontend from color, text, provider name, or source label.

### Source

Source is provenance metadata.

MVP recommendation:

- do not show raw source/provider in primary UI;
- do not show `NodeBB`, import source, provider name, or scraper name as identity;
- if provenance must be exposed later, use a secondary disclosure area such as `信息来源说明`, not author/trust/chip UI.

## Contribution/save/correction policy

### Save

Can be introduced once the product confirms what saving a place means:

- save for personal campus map;
- save for later visit;
- save for following updates.

Do not add save as part of #63 or #69 documentation-only work.

### Correction

Correction should eventually support:

- wrong location;
- outdated info;
- duplicate place;
- missing metadata;
- safety/accessibility notes.

Correction should enter a review queue or moderation flow before changing canonical place identity.

### Contribution

Contribution should start small:

- add a note;
- add a tip;
- suggest a tag/type;
- attach a related post.

Do not introduce scores, ranks, strong identity, or competitive contribution mechanics in MVP.

### Recent-post pagination

MVP PlaceSheet can show a small recent-post preview.

Pagination or a full feed of place-related content should wait for a dedicated Place page or route.

## Dedicated Place page trigger

Introduce a dedicated route/page only when at least two of these are true:

- places have canonical shareable URLs;
- correction/contribution history exists;
- recent posts need pagination/search/filtering;
- place follows/saves become core behavior;
- moderation/review workflow is visible to contributors;
- PlaceSheet interaction becomes too dense for a compact surface.

## Non-goals

This decision does not implement:

- backend DTO changes;
- route changes;
- full Place page;
- save/correction/contribution APIs;
- provider/source badges;
- points, levels, ranks, or strong identity systems;
- legacy fallback cleanup.

## Acceptance mapping for #69

- Inline/bottom sheet/dedicated page decision: bottom-sheet PlaceSheet for MVP; dedicated page later.
- Detail/Map/Publish flow consistency: all structured `place.id` paths can open or reference PlaceSheet; fallback text cannot.
- Contribution/save/correction/recent-posts: documented as staged affordances, not MVP blockers.
- Metadata visibility: status can be neutral structured label; source remains provenance metadata, not identity UI.
- Mockups/artifacts: text anatomy above is sufficient for current product decision; visual mockups can follow if implementation expands.
