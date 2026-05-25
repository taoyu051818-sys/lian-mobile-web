import type { DisplayActor, FeedItemId, SourceSignal } from "./feed";
import type { PlaceRef } from "./place";
import type { Audience, AudienceVisibility } from "./audience";
import type { MerchantErrandUnavailableReason } from "./merchant";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
  MetadataComponentV2,
  TradePostExtension,
} from "./post-extensions";

export interface PostReply {
  id: FeedItemId;
  content: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  timestampISO: string;
}

export interface PostDetail {
  tid: FeedItemId;
  type?: PostType;
  title: string;
  cover: string;
  primaryTag: string;
  actor?: DisplayActor;
  source?: SourceSignal;
  place?: PlaceRef;
  timeLabel: string;
  timestampISO: string;
  likeCount: number;
  liked: boolean;
  locationArea: string;
  contentHtml: string;
  imageUrls: string[];
  sourceUrl: string;
  replies: PostReply[];
  bookmarked: boolean;
  /** Audience visibility level for the post. */
  visibility?: AudienceVisibility;
  /** PRD V0.1 §6.3 — present iff postType === "event". */
  event?: EventPostExtension;
  /** Whether the current viewer has already joined this event. */
  eventJoined?: boolean;
  /**
   * Issue #703 — backend-driven flag for the creator/admin "结束活动" surface.
   * When the server ships this, the frontend trusts it; when absent, the
   * frontend resolves it client-side via `/api/auth/me` + `/api/admin/me`.
   */
  eventManageable?: boolean;
  /** PRD V0.1 §6.5 — present iff metadata.help exists. */
  help?: HelpPostExtension;
  /** Whether the current viewer has already voted on this help post. */
  helpVoted?: boolean;
  /** PRD V0.1 §6.5 / §11.3 — backend-driven flag for help management surface. */
  helpManageable?: boolean;
  /** PRD V0.1 §6.4 / §10 — present iff metadata.merchant exists. */
  merchant?: MerchantPostExtension;
  /**
   * PRD V0.1 §10 — true iff `merchant.errandSupported`. Hoisted to the top
   * level by the backend DTO so the errand entry can render without
   * destructuring the merchant block.
   */
  errandEntryAvailable?: boolean;
  /**
   * Issue #646 — when the merchant supports errand but the entry is currently
   * unavailable, the backend may attach a reason code so the detail page can
   * explain why. Empty / undefined = no machine-readable reason; the UI falls
   * back to the localized generic copy.
   */
  errandUnavailableReason?: MerchantErrandUnavailableReason | "";
  /**
   * Optional human-readable explanation paired with `errandUnavailableReason`.
   * When present, the UI prefers it over the localized fallback so backend
   * can hand-tailor wording without a frontend release.
   */
  errandUnavailableReasonText?: string;
  /** PRD V0.1 §6.4 / §11 — present iff metadata.trade exists. */
  trade?: TradePostExtension;
  /**
   * Backend-driven author gate for the trade state-transition surface.
   * Frontend can fall back to `/api/auth/me` + actor matching when absent.
   */
  tradeManageable?: boolean;
  /**
   * PRD V0.3 §2.1.3 — V2 components block. When the backend grows to echo raw
   * `metadata` on the wire (currently the post-detail DTO does not), this
   * field carries the version-tagged components array. PostComponentsSlot
   * renders any registered component types it finds here; unregistered types
   * are silently skipped so future component additions do not require a
   * frontend release. Both legacy event/help/merchant/trade extensions above
   * AND this block can coexist — the existing flat fields keep their existing
   * blocks while new component types (delivery / groupbuy / channel / ledger)
   * land via this slot.
   */
  metadata?: PostDetailMetadataV2;
  /**
   * PRD V0.3 §2.1.3 — top-level V2 components mirror of `metadata.components`.
   * Per the team's wire-shape principle (array-only on the wire, see
   * `feedback_v2_metadata_schema_dual_shape`), `components` is always the
   * canonical array form. `normalizePostDetail` preserves whatever the backend
   * shipped (top-level or `metadata.components`) so registry consumers and
   * future relation/availableActions surfaces have the raw graph primitive.
   */
  components?: MetadataComponentV2[];
  /**
   * PRD V0.3 §2.4 — backend-emitted post graph relations. Canonical wire shape
   * is `{ type, target: { kind, id }, role? }` (see lian-platform-server
   * `post-relation-contract.js`). `normalizePostDetail` keeps this array as-is
   * (after coercing the canonical shape) so a future relation registry can
   * dispatch render blocks without re-fetching. mw#967 is the data layer
   * only — UI consumption ships in a separate ticket.
   */
  relations?: PostRelation[];
  /**
   * PRD V0.3 §2.4 — backend-authoritative action availability. When present,
   * the detail page should prefer this list over the client-side action
   * policy registry. Optional; absence falls back to the existing per-action
   * frontend fallbacks. Preserved by `normalizePostDetail`; UI gating ships
   * in a separate ticket.
   */
  availableActions?: PostAvailableAction[];
}

/**
 * Optional V2 metadata block surfaced on the post-detail DTO. Mirrors the
 * backend storage shape (`_v` discriminator + `components` array). The
 * `components` field is array-shaped on the wire — backend dual-write
 * normalization converts internal object-map storage to this canonical
 * array form before serialization.
 */
export interface PostDetailMetadataV2 {
  _v?: number;
  components?: MetadataComponentV2[];
}

/**
 * Unified PostType vocabulary (PRD V0.1 §6.1).
 *
 *   - data model (server)         → `PostType` (here)
 *   - feed/card presentation      → `FeedPresentationIntent` (in types/feed)
 *   - publish input               → `PublishVisibility` (in types/publish)
 *
 * `event` is canonical; `activity` is kept only as a card-template label
 * (PRD §3.2) so existing Feed cards keep rendering during migration.
 */
export type PostType =
  | "image"
  | "text"
  | "event"
  | "merchant"
  | "trade"
  | "help"
  | "place"
  | "club";

export const POST_TYPES: ReadonlySet<PostType> = new Set([
  "image",
  "text",
  "event",
  "merchant",
  "trade",
  "help",
  "place",
  "club",
]);

export type PostStatus = "active" | "hidden" | "deleted" | "pending_review";

export interface PostLocation {
  /** Canonical place id when one is bound; empty string otherwise. */
  placeId: string;
  /** Display label — may be free-text when no place is bound. */
  label: string;
  lat: number | null;
  lng: number | null;
  place?: PlaceRef;
}

/**
 * Canonical relation wire shape (PRD V0.3 §2.1 / lian-platform-server
 * `post-relation-contract.js`). The backend emits relations as
 *   `{ type, target: { kind, id }, role? }`
 * — see e.g. the `help_event_link` surface settled by stage A6:
 *   `{ type: "help_event_link", target: { kind: "post", id: "<eventId>" }, role: "source" }`.
 *
 * `type` is intentionally `string` rather than a fixed union: the post graph
 * is meant to grow new relation kinds without forcing a frontend release.
 * Concrete renderers narrow on `type` via the relation registry (separate
 * ticket — this type only preserves data flowing through normalization).
 */
export interface PostRelationTarget {
  /** Target node kind (e.g. `"post"`, `"user"`, `"place"`). */
  kind: string;
  /** Target node id. String on the wire; backends sometimes emit numbers. */
  id: string;
}

export interface PostRelation {
  /** Relation kind (e.g. `"help_event_link"`, `"trade_offer_link"`). */
  type: string;
  /** Target node reference. */
  target: PostRelationTarget;
  /** Optional role of the current post within the relation. */
  role?: string;
}

/**
 * Optional backend-driven action descriptor (PRD V0.3 §2.4). When the backend
 * ships an `availableActions[]` array on the detail DTO, the frontend honors
 * it as authoritative for action availability; absence falls back to the
 * client-side action policy registry. Preserved by `normalizePostDetail` so
 * the data is available to any future renderer — this PR does not yet wire
 * a UI consumer (separate ticket).
 */
export interface PostAvailableAction {
  /** Action identifier (e.g. `"join_event"`, `"vote_help"`, `"trade_reserve"`). */
  type: string;
  /** Whether the action is currently enabled for the viewer. Defaults to true when absent. */
  enabled?: boolean;
  /** Machine-readable reason when `enabled` is false. */
  reason?: string;
  /** Optional human-readable explanation paired with `reason`. */
  reasonText?: string;
}

export interface BasePostShape {
  tid: number;
  type: PostType;
  title: string;
  body: string;
  bodyPreview: string;
  cover?: string;
  imageUrls?: string[];
  tags: string[];
  authorUserId: string;
  aliasId?: string;
  identityTag?: string;
  location?: PostLocation;
  audience: Audience;
  relations?: PostRelation[];
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

export function isKnownPostType(value: unknown): value is PostType {
  return typeof value === "string" && POST_TYPES.has(value as PostType);
}

/**
 * Coerce a raw value into a known PostType, falling back to `image`/`text`
 * based on the presence of a cover. Mirrors the Feed cardTemplate fallback.
 */
export function normalizePostType(value: unknown, hasCover: boolean): PostType {
  if (isKnownPostType(value)) return value;
  return hasCover ? "image" : "text";
}

// ---------------------------------------------------------------------------
// Club (社团) metadata
// ---------------------------------------------------------------------------

/**
 * Club category taxonomy. Maps to backend `metadata.club.category`.
 */
export type ClubCategory =
  | "academic"
  | "sports"
  | "arts"
  | "volunteer"
  | "tech"
  | "culture"
  | "other";

/**
 * Read-side club extension as returned by `GET /api/posts/:tid` when
 * `contentType === "club"`. Wire shape mirrors `metadata.club` exactly.
 */
export interface ClubMetadata {
  /** Unique club identifier. */
  clubId: string;
  /** Display name of the club. */
  name: string;
  /** Club category for filtering/display. */
  category: ClubCategory;
  /** Display name of the club president/leader. */
  president: string;
  /** ISO date string when the club was founded. */
  foundedAt: string;
  /** Current member count. */
  memberCount: number;
  /** Optional brief description. */
  description?: string;
  /** Optional logo/avatar URL. */
  logoUrl?: string;
}
