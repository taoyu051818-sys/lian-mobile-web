import type { DisplayActor, FeedItemId, SourceSignal } from "./feed";
import type { PlaceRef } from "./place";
import type { Audience } from "./audience";
import type { MerchantErrandUnavailableReason } from "./merchant";
import type {
  EventPostExtension,
  HelpPostExtension,
  MerchantPostExtension,
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
export type PostType = "image" | "text" | "event" | "merchant" | "trade" | "help" | "place";

export const POST_TYPES: ReadonlySet<PostType> = new Set([
  "image",
  "text",
  "event",
  "merchant",
  "trade",
  "help",
  "place",
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
 * Optional cross-references to other posts. PRD V0.1 §7.1.2 calls out that
 * `help` posts may resolve into `event` posts; that relation lives here.
 */
export interface PostRelation {
  type: "help_event_link" | "trade_offer_link" | "event_followup";
  targetTid: number;
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
