# Discovery Contract

Frontend contract for search, tag filtering, feed tab semantics, recommendation signals, and read-history transport. Supplements #137 (entity ID normalization), #140 (account privacy/data controls), #141 (search/tags/recommendation UI), and #149 (client ID/reader ID privacy).

---

## 1. Search Query Contract

All search and feed-filter requests share a single query parameter set. Parameters are additive; omitted params mean "no filter."

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | no | Free-text keyword. Trimmed, max 200 chars. Empty string treated as absent. |
| `tags` | `string` | no | Comma-separated canonical tag slugs (see section 2). Max 5 slugs. |
| `placeId` | `string` | no | Canonical place ID (`PlaceId` opaque string per #137). Filters to posts bound to that place. |
| `contentType` | `string` | no | One of the known `ContentType` enum values (see section 2.3). Filters to a single content type. |
| `sort` | `string` | no | Sort/ranking key. Defaults to tab-defined `sortKind` or `"relevance"` when `q` is present, `"time"` otherwise. Known values: `"time"`, `"hot"`, `"relevance"`. |
| `tab` | `string` | yes | Feed tab ID (see section 3). |
| `page` | `number` | yes | 1-based page index. |
| `limit` | `number` | yes | Page size. Default 12, max 50. |
| `read` | `string` | no | Read-history signal (see section 4). |

### 1.1 URL / Deep Link Representation

Search state must be expressible as a URL for shareability and PWA restore:

```
/discover?q=...&tags=...&placeId=...&contentType=...&sort=...&tab=...
```

- All param values are URL-encoded strings.
- Default/empty params may be omitted from the URL.
- On navigation, the view hydrates query state from the URL, not from in-memory state.

### 1.2 API Request Mapping

The frontend adapter builds the API request from the same query object. `fetchFeed()` (currently in `src/api/feed.ts`) will accept the extended `FeedQuery`:

```ts
interface FeedQuery {
  tab: string;
  page: number;
  limit: number;
  q?: string;
  tags?: string;
  placeId?: string;
  contentType?: string;
  sort?: string;
  read?: string;
}
```

The adapter is responsible for:
- Trimming and length-clamping `q`.
- Normalizing `tags` to canonical slugs before sending.
- Dropping unknown `contentType` / `sort` values (fall back to defaults).
- Not sending empty/default params.

### 1.3 Response Shape

Search responses use the same `FeedResponse` shape as tab-based feeds. No separate search result type is needed at the contract level; the adapter normalizes items identically.

---

## 2. Canonical Tag Schema

Tags appear in publish input, feed card display, and filter queries. All three must share a single canonicalization contract.

### 2.1 TagRecord

```ts
interface TagRecord {
  /** Canonical slug: lowercase, hyphen-separated, ASCII-safe. Used in API queries and URLs. */
  slug: string;
  /** Display label: user-facing text, may contain CJK/punctuation. */
  label: string;
  /** Source: who created/curated this tag. */
  source: "system" | "user" | "moderation";
  /** Visibility: whether the tag is publicly browsable. */
  visibility: "public" | "hidden" | "restricted";
  /** Moderation status. */
  moderationStatus: "approved" | "pending" | "rejected";
}
```

### 2.2 Canonicalization Rules

1. **Display label** is the raw user/admin input (may contain CJK, spaces, emoji).
2. **Canonical slug** is derived by the adapter:
   - Lowercase.
   - Trim whitespace.
   - Collapse internal whitespace to `-`.
   - Strip characters outside `[a-z0-9一-鿿-]` (letters, digits, CJK, hyphen).
   - Max 40 chars; truncate with ellipsis awareness.
3. Publish-side normalization and feed-side filter normalization must use the same `canonicalizeTag(label)` helper.
4. The `primaryTag` field on `FeedItem` stores the **display label**. The adapter also attaches the canonical slug when available.

### 2.3 ContentType Enum

Known content types. `FeedItemCard` uses these instead of string-matching titles/tags:

```ts
type ContentType =
  | "post"         // general text/image post
  | "activity"     // event, club, signup
  | "merchant"     // shop, deal, food
  | "help"         // mutual aid, team-up, request
  | "place"        // location review, route
  | "announcement" // official notice
  | "unknown";     // fallback
```

The adapter maps raw API `contentType` string to this enum. Unknown values fall back to `"unknown"`. `FeedItemCard` no longer uses `title.includes(...)` heuristics to pick a card template; it reads `item.contentType` directly.

---

## 3. FeedTab Contract

### 3.1 Current State

`FeedTab` in `src/types/feed.ts`:

```ts
interface FeedTab {
  id: string;
  label: string;
}
```

The backend returns tabs; the frontend renders `label` and switches on `id`. There is no information about what the tab means or how it sorts.

### 3.2 Extended FeedTab

```ts
interface FeedTab {
  id: string;
  label: string;
  /** Human-readable description of what this tab shows and how it is ranked. */
  description?: string;
  /** Default sort kind for this tab. Determines the `sort` param when the user has not explicitly chosen one. */
  sortKind?: "time" | "hot" | "relevance";
  /** Short label explaining the ranking policy, shown in UI or diagnostics. */
  rankingPolicyLabel?: string;
}
```

| Field | Example | Purpose |
|---|---|---|
| `description` | `"按时间倒序展示最新内容"` | Tab-level tooltip or info text. |
| `sortKind` | `"time"` | Frontend default `sort` value when this tab is active and user has not picked a sort. |
| `rankingPolicyLabel` | `"综合热度与新鲜度"` | Short label for recommendation transparency. May be shown in a diagnostics panel or info popover. |

### 3.3 Defaults

When the backend does not provide the extended fields, the adapter fills defaults:

| Tab id pattern | `sortKind` default | `rankingPolicyLabel` default |
|---|---|---|
| Contains `"此刻"` or `"latest"` | `"time"` | `"按时间更新"` |
| Contains `"精选"` or `"featured"` | `"hot"` | `"综合热度与新鲜度"` |
| Anything else | `"relevance"` | `"个性化推荐"` |

### 3.4 Backend Alignment

The backend should eventually return `description`, `sortKind`, and `rankingPolicyLabel` on every tab. Until then, the frontend adapter applies the defaults above and marks them as `/* adapter default */` in diagnostics.

---

## 4. Read History Contract

### 4.1 Current State (FeedView.vue)

- `readHistoryQuery()` reads `localStorage["lian.readHistory"]`, parses a JSON array of `{ tid, lastViewedAt }`, joins `tid` values with commas, and passes the result as the `read` query param.
- `rememberReadItem(id)` appends to the same localStorage key, deduplicating by `Number(tid)`, capped at 500 entries.
- The full comma-separated ID list is sent as a GET query parameter.

### 4.2 Problems

1. **Transport**: 500 IDs in a GET query string can exceed proxy/browser limits (~8 KB typical).
2. **Privacy**: Users are not informed that their browsing history is transmitted to the server.
3. **ID normalization**: `Number(entry.tid) !== Number(id)` breaks for opaque string IDs (see #137).
4. **No control**: No way to clear history or disable the signal.

### 4.3 Contract

#### Max Count

- **Local storage cap**: 500 entries (unchanged).
- **Transmit cap**: Only the most recent **50** IDs are sent to the API. The adapter slices `history.slice(-50)` before joining.

#### Transport

- The `read` param remains a comma-separated string of normalized `PostId` values (opaque strings, not numbers).
- If the joined string exceeds **1024 characters**, the adapter truncates from the oldest end until it fits.
- Future optimization: migrate to a POST body or Bloom filter hash. The contract specifies the GET query format as the initial implementation.

#### Privacy

- `readHistory` is **local-only behavioral data**. The adapter transmits a truncated subset solely for deduplication/recommendation signals.
- The Profile/privacy settings screen must display:
  - Whether read history is used for personalization.
  - A "clear read history" action.
  - A "disable read-history signal" toggle.
- When the toggle is off, `readHistoryQuery()` returns `""` and the `read` param is omitted from the API request.

#### Clear / Disable Entry

```ts
/** Clear all local read history. */
function clearReadHistory(): void {
  try { localStorage.removeItem("lian.readHistory"); } catch {}
}

/** Check if the read-history signal is disabled. */
function isReadHistorySignalDisabled(): boolean {
  try { return localStorage.getItem("lian.readHistoryDisabled") === "1"; } catch { return false; }
}

/** Disable/enable the read-history signal. */
function setReadHistorySignalDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem("lian.readHistoryDisabled", "1");
    else localStorage.removeItem("lian.readHistoryDisabled");
  } catch {}
}
```

These functions live in a shared module (e.g., `src/platform/readHistory.ts`), not inside `FeedView.vue`.

#### ID Normalization

- `rememberReadItem(id)` stores `String(id)` (normalized `PostId`), never `Number(id)`.
- Deduplication uses strict string equality, not `Number()` comparison.
- See #137 for the full `PostId` opaque-string contract.

---

## 5. Relationship to Other Issues

| Issue | Intersection |
|---|---|
| #137 | `PostId`, `PlaceId` are opaque strings. Feed/detail/map adapters normalize IDs. `readHistory` stores normalized `PostId`. |
| #140 | Profile privacy settings host the read-history clear/disable controls. Account deletion clears `lian.readHistory` and `lian.readHistoryDisabled`. |
| #141 | This document is the concrete contract for #141's search query, tag schema, feed tab semantics, and read-history signal items. |
| #149 | `readHistory` and `lian.clientId` share the same privacy control surface. Clearing local data should clear both. |

---

## 6. Out of Scope

- **UI implementation**: no mockups, component changes, or visual design in this document.
- **Server-side ranking logic**: the contract defines what the frontend sends and displays, not how the backend ranks.
- **Telemetry boundaries**: recommendation/search telemetry privacy is tracked in #141 P2 and #126.
- **PWA/offline cache strategy**: tracked in #109 and #134.
