# Actor Identity Presentation Contract

> RFC for #145 — centralize actor display across Feed, Detail, Messages, Profile, and Publish.

Status: proposed
Date: 2026-05-08
Scope: frontend presentation contract only. No runtime implementation.

---

## 1. Problem

Five surfaces (Feed, Detail, Messages, Profile, Publish) each compute actor display independently. This causes:

- inconsistent displayName fallback ("同学" vs "" vs "未登录同学")
- inconsistent avatar fallback (1-char vs 2-char initials)
- identityTag ambiguity (sometimes identity, sometimes signal)
- no contract for deleted / system / anonymous actors
- source / provider leaking into identity UI

## 2. Definitions

| Term | Meaning | Source of truth |
|------|---------|-----------------|
| **actor** | Display identity: who is speaking. | `campus-experiment-commons.md` |
| **identityTag** | Optional trust / contribution signal. Not the speaking subject. | `campus-experiment-commons.md` |
| **source** | Provenance metadata. Must not appear as identity UI. | `campus-experiment-commons.md` |
| **alias** | Lightweight persona identity (马甲). Max 1 per user. | `alias-phase-1.md` |

## 3. Actor kind enum

```
ActorKind = "user" | "alias" | "official" | "system" | "deleted" | "anonymous"
```

| Kind | Description | Example |
|------|-------------|---------|
| `user` | Real authenticated user, no active alias. | Real name or username. |
| `alias` | User speaking through an active alias persona. | "安静观察者" |
| `official` | Official campus / org account. | "教务处" |
| `system` | System-generated notification or event. | "系统通知" |
| `deleted` | Account deleted, content preserved. | "已注销用户" |
| `anonymous` | Anonymous / unauthenticated actor. | "匿名同学" |

## 4. Normalized actor shape

Every surface consumes a normalized `PresentedActor`, never raw API fields directly.

```ts
interface PresentedActor {
  kind: ActorKind
  displayName: string        // resolved display name
  avatarUrl: string | null   // image URL if available
  avatarText: string         // 1–2 char fallback for avatar
  identityTag: string | null // optional signal, not identity
  meta: string | null        // secondary line: "官方马甲" / "校友" / null
  ariaLabel: string          // accessible label for screen readers
}
```

## 5. displayName fallback chain

Unified across all surfaces. Evaluated in order; first non-empty wins.

```
1. kind == "deleted"  → "已注销用户"
2. kind == "system"   → "系统通知"
3. kind == "anonymous" → "匿名同学"
4. actor.displayName   (if non-empty)
5. actor.username       (if non-empty)
6. actor.name           (if non-empty)
7. "同学"               (final fallback)
```

Rules:

- Never render `[object Object]`.
- Never render empty string in visible UI; fall through to "同学".
- `source`, provider, and NodeBB labels are never in this chain.
- Legacy flat `author` string fields are not accepted fallbacks.

## 6. Avatar fallback chain

Unified across all surfaces.

```
1. actor.avatarUrl   (if non-empty string, use <img>)
2. actor.avatarText  (if non-empty, render as text avatar)
3. first char of displayName  (final fallback, 1 char)
```

Rules:

- `avatarText` is always exactly 1 character (first grapheme of the name).
- All text avatars use the same visual token (background, radius, font size).
- `<img>` avatars include `alt` text equal to displayName.
- Text avatars use `aria-hidden="true"` (displayName covers accessibility).
- Image proxy: `avatarUrl` is rewritten through `displayImageUrl()` when applicable.

## 7. Alias and identity semantics

### 7.1 Identity kind resolution

```
if user is deleted          → kind = "deleted"
if user is system           → kind = "system"
if no session / anonymous   → kind = "anonymous"
if activeAliasId is set     → kind = "alias"
if user has official flag   → kind = "official"
else                        → kind = "user"
```

### 7.2 identityTag vs actor kind

| Concept | What it is | UI role |
|---------|-----------|---------|
| `kind` | Who is speaking right now | Primary identity display |
| `identityTag` | Optional signal attached to a contribution | Secondary badge, never primary identity |

Rules:

- `identityTag` is never the speaking subject.
- `identityTag` may appear as a small chip or suffix after the actor name.
- Switching alias changes `kind` and `displayName`, not just `identityTag`.

### 7.3 Alias display

When `kind = "alias"`:

- `displayName` = alias name (e.g., "安静观察者").
- `meta` = "马甲身份" (or localized equivalent).
- `identityTag` may still be present as a signal.

## 8. Special actor states

### 8.1 Deleted actor

```
kind        = "deleted"
displayName = "已注销用户"
avatarUrl   = null
avatarText  = "注"
meta        = null
identityTag = null
ariaLabel   = "已注销用户"
```

Content is preserved. Actor name and avatar are replaced with the fixed deleted placeholder. No link to profile.

### 8.2 System actor

```
kind        = "system"
displayName = "系统通知"  (or contextual: "官方公告")
avatarUrl   = null        (or system icon asset)
avatarText  = "系"
meta        = null
identityTag = null
ariaLabel   = "系统通知"
```

System actors use a distinct visual identity (e.g., system icon). Never confused with user actors.

### 8.3 Anonymous actor

```
kind        = "anonymous"
displayName = "匿名同学"
avatarUrl   = null
avatarText  = "匿"
meta        = null
identityTag = null
ariaLabel   = "匿名用户"
```

Anonymous actors hide all personal identity. No profile link. No identityTag.

## 9. Presenter function

A single `presentActor(rawActor, options?)` function produces `PresentedActor`.

### 9.1 Input

```ts
interface RawActor {
  displayName?: string
  username?: string
  name?: string
  avatarUrl?: string
  avatarText?: string
  identityTag?: string
  kind?: string         // "user" | "alias" | "official" | "system" | "deleted" | "anonymous"
  status?: string       // "deleted" | "banned" | etc.
  activeAliasId?: string | null
  nodebbUid?: number
  // ... other raw fields
}

interface PresentOptions {
  surface?: "feed" | "detail" | "messages" | "profile" | "publish"
  context?: "post" | "reply" | "message" | "composer" | "header"
}
```

### 9.2 Output

Returns `PresentedActor` as defined in section 4.

### 9.3 Responsibilities

- Apply displayName fallback chain (section 5).
- Apply avatar fallback chain (section 6).
- Resolve actor kind (section 7.1).
- Generate `ariaLabel` from displayName + kind.
- Generate `meta` based on kind and identityTag.
- Never expose `source`, provider, or NodeBB fields.

### 9.4 Non-responsibilities

- Does not handle privacy filtering (caller's job).
- Does not render components (component's job).
- Does not manage alias switching state (store's job).

## 10. Per-surface contract

### 10.1 Feed card

| Field | Source | Fallback |
|-------|--------|----------|
| Author name | `presentedActor.displayName` | "同学" |
| Author avatar | `presentedActor.avatarUrl` → `avatarText` | 1-char initial |
| Identity signal | `presentedActor.identityTag` (if present) | hidden |
| Meta | `presentedActor.meta` (if present) | hidden |

Rules:

- Card author area uses presenter output directly.
- No independent fallback logic in FeedItemCard.
- `source` / provider never appears as author.

### 10.2 Detail (post author & replies)

| Field | Source | Fallback |
|-------|--------|----------|
| Post author | `presentedActor.displayName` | "同学" |
| Post avatar | `presentedActor.avatarUrl` → `avatarText` | 1-char initial |
| Reply author | `presentedActor.displayName` per reply | "同学" |
| Reply avatar | `presentedActor.avatarUrl` → `avatarText` | 1-char initial |

Rules:

- Post detail and reply detail both use presenter.
- No duplicate `actorDisplayName()` / `actorAvatarUrl()` logic in PostDetailPanel.
- `identityTag` reads as signal, not as speaking subject.

### 10.3 Messages (channel)

| Field | Source | Fallback |
|-------|--------|----------|
| Sender name | `presentedActor.displayName` | "同学" |
| Sender avatar | `presentedActor.avatarUrl` → `avatarText` | 1-char initial |
| Composer name | `presentedActor.displayName` (current user) | "同学" |
| Composer signal | `presentedActor.identityTag` (if present) | hidden |

Rules:

- Channel sender uses presenter for each message item.
- Composer shows the current user's active identity via presenter.
- No duplicate `actorDisplayName()` / `actorAvatarText()` logic in MessagesView.

### 10.4 Profile

| Field | Source | Fallback |
|-------|--------|----------|
| Display name | `presentedActor.displayName` | "未登录同学" |
| Avatar | `presentedActor.avatarUrl` → `avatarText` | 1-char initial |
| Active alias | `presentedActor.meta` (when kind = "alias") | hidden |
| Identity meta | `presentedActor.identityTag` (if present) | hidden |

Rules:

- Profile header uses presenter with current user's data.
- Active alias hint is a meta field, not a separate computation.
- No independent `displayName` / `avatarText` logic in ProfileView.

### 10.5 Publish (composer)

| Field | Source | Fallback |
|-------|--------|----------|
| Publish identity | `presentedActor.displayName` | "同学" |
| Identity hint | `presentedActor.meta` + `presentedActor.identityTag` | hidden |

Rules:

- Publish view shows which identity the user is publishing as.
- Copy example: "你将以 [马甲名 · 马甲身份] 发布"
- Identity switch updates the composer via presenter, not inline logic.

## 11. Cross-cutting rules

### 11.1 Source / provider isolation

- `source`, provider labels, NodeBB-style platform labels must never appear as actor identity, author UI, or trust badge.
- This is an absolute rule across all surfaces.

### 11.2 Accessibility

- `ariaLabel` is always present and always human-readable.
- Text avatars are `aria-hidden="true"`.
- Image avatars carry `alt` = displayName.
- Screen readers announce: `{displayName}, {meta}` when meta is present.

### 11.3 Testing contract

- Presenter unit tests cover the full fallback matrix for each ActorKind.
- Component tests verify that surfaces consume presenter output, not raw fields.
- Fixture data must include: missing displayName, username-only, alias name, deleted actor, system actor, anonymous actor.

## 12. Migration path

This contract is docs-only. Implementation proceeds in phases:

1. **Phase A**: Add `presentActor()` as a pure function alongside existing code. No callers change.
2. **Phase B**: Migrate Feed and Detail to consume presenter. Remove duplicate fallback logic.
3. **Phase C**: Migrate Messages and Profile. Remove duplicate fallback logic.
4. **Phase D**: Migrate Publish composer. Wire identity switch through presenter.
5. **Phase E**: Add `kind` / `status` to API adapter normalization. Remove legacy flat field fallbacks.

Each phase is a separate PR. No phase modifies the contract document.

## 13. Non-goals

This document does not implement:

- runtime presenter code
- component changes
- API DTO changes
- backend changes
- badge / trust system
- privacy filtering rules
- alias creation / switching UI
- image proxy changes

## 14. Traceability

| Reference | Relationship |
|-----------|-------------|
| #145 | This contract addresses the presentation layer scope of #145 |
| #129 | Anonymous / content safety — anonymous actor kind defined here |
| #140 | Account privacy / alias visibility — alias kind defined here |
| #143 | Channel message identity signal — identityTag semantics defined here |
| #137 | API model normalize — presenter consumes normalized shape |
| `campus-experiment-commons.md` | Conceptual foundation for actor / identityTag / source |
| `E2E_ACCEPTANCE_ACTOR_PLACESHEET_2026-05-06.md` | Acceptance criteria this contract codifies |
| `api-contract.md` | Raw API shapes that the presenter normalizes |
| `alias-phase-1.md` | Alias data model that feeds into kind resolution |
| `LIAN-Campus-UI-UX-Guidelines-V0.1.md` §5 | Identity display rules this contract formalizes |
| `HOMEPAGE_FEED_PRINCIPLES_V0.2.md` | Card identity area layout this contract supports |
